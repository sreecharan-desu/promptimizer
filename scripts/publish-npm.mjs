#!/usr/bin/env node
/**
 * Publish SDK + CLI to npm.
 *
 * npm often exposes version metadata before the tarball is downloadable.
 * Never leave @latest on a non-installable version — retag to the last
 * good release while CDN/registry catches up, then move @latest forward.
 */
import { execSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function run(command, cwd = root) {
  execSync(command, { cwd, stdio: "inherit", encoding: "utf8" });
}

function runCapture(command) {
  try {
    return execSync(command, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
  } catch {
    return null;
  }
}

function writePkg(dir, pkg) {
  writeFileSync(join(dir, "package.json"), `${JSON.stringify(pkg, null, 2)}\n`);
}

function publishedVersion(name) {
  return runCapture(`npm view ${name} version`);
}

function versionExists(name, version) {
  return Boolean(runCapture(`npm view ${name}@${version} version`));
}

function tarballUrl(name, version) {
  return `https://registry.npmjs.org/${name}/-/${name}-${version}.tgz`;
}

function httpStatus(url) {
  try {
    return execSync(`curl -sL -o /dev/null -w "%{http_code}" ${JSON.stringify(url)}`, {
      encoding: "utf8",
    }).trim();
  } catch {
    return "000";
  }
}

function tarballOk(name, version) {
  return httpStatus(tarballUrl(name, version)) === "200";
}

function installable(name, version) {
  if (!tarballOk(name, version)) return false;
  const dir = mkdtempSync(join(tmpdir(), "pmz-npm-"));
  try {
    return Boolean(runCapture(`npm pack ${name}@${version} --pack-destination ${JSON.stringify(dir)}`));
  } catch {
    return false;
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

function sleep(seconds) {
  execSync(`sleep ${seconds}`);
}

function waitUntilInstallable(name, version, { attempts, label = "tarball" }) {
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    if (installable(name, version)) {
      console.log(`${name}@${version} ${label} ok (attempt ${attempt})`);
      return true;
    }
    console.log(
      `waiting for ${name}@${version} ${label} (attempt ${attempt}/${attempts}, http ${httpStatus(tarballUrl(name, version))})…`,
    );
    sleep(Math.min(20, 2 + attempt));
  }
  return false;
}

function bumpPatch(version) {
  const [major, minor, patch] = version.split(".").map(Number);
  return `${major}.${minor}.${patch + 1}`;
}

function cmp(a, b) {
  const left = a.split(".").map(Number);
  const right = b.split(".").map(Number);
  for (let i = 0; i < 3; i += 1) {
    if (left[i] !== right[i]) return left[i] - right[i];
  }
  return 0;
}

function nextVersion(local, remote) {
  if (!remote) return local;
  return cmp(local, remote) > 0 ? local : bumpPatch(remote);
}

function listVersions(name) {
  const raw = runCapture(`npm view ${name} versions --json`);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function lastInstallableVersion(name, exclude) {
  const versions = listVersions(name);
  for (let i = versions.length - 1; i >= 0; i -= 1) {
    const v = versions[i];
    if (v === exclude) continue;
    if (tarballOk(name, v)) return v;
  }
  return null;
}

function setLatest(name, version) {
  console.log(`npm dist-tag add ${name}@${version} latest`);
  run(`npm dist-tag add ${name}@${version} latest`);
}

/** Make sure `npm i <name>` works. Retags @latest backward if needed. */
function ensureLatestInstallable(name) {
  const latest = publishedVersion(name);
  if (!latest) return null;
  if (installable(name, latest)) {
    // Prefer the newest installable version (skip ghost newer releases).
    const versions = listVersions(name);
    for (let i = versions.length - 1; i >= 0; i -= 1) {
      const v = versions[i];
      if (!tarballOk(name, v)) continue;
      if (v !== latest) {
        console.log(`Promoting ${name}@latest ${latest} → ${v} (newer installable)`);
        setLatest(name, v);
      }
      return v;
    }
    return latest;
  }
  if (waitUntilInstallable(name, latest, { attempts: 4, label: "latest-quick" })) return latest;

  const fallback = lastInstallableVersion(name, latest);
  if (!fallback) {
    throw new Error(`${name}@${latest} is @latest but not installable, and no fallback found`);
  }
  console.warn(`Protecting installs: ${name}@latest ${latest} not ready → ${fallback}`);
  setLatest(name, fallback);
  if (!installable(name, fallback)) {
    throw new Error(`Failed to point ${name}@latest at installable ${fallback}`);
  }
  return fallback;
}

/**
 * After publishing `version`, confirm installability quickly.
 * If the tarball is still missing, point @latest at the last good release and
 * continue (do not block CI for many minutes on CDN lag).
 */
function finalizePublish(name, version) {
  if (waitUntilInstallable(name, version, { attempts: 6, label: "post-publish" })) {
    const latest = publishedVersion(name);
    if (latest !== version) setLatest(name, version);
    return true;
  }

  // Protect users immediately; ghost @latest breaks `npm i`.
  const safe = ensureLatestInstallable(name);
  console.warn(
    `${name}@${version} published but tarball not ready yet; @latest → ${safe}. ` +
      `Re-run this workflow later to promote ${version} once the blob appears.`,
  );
  return true;
}

function publish(name, dir) {
  // Repair any broken @latest before bumping again.
  ensureLatestInstallable(name);

  const original = readFileSync(join(dir, "package.json"), "utf8");
  const pkg = JSON.parse(original);
  const remote = publishedVersion(name);
  let version = nextVersion(pkg.version, remote);

  if (versionExists(name, version) && installable(name, version)) {
    console.log(`${name}@${version} already installable — skip publish`);
    const latest = publishedVersion(name);
    if (latest !== version && installable(name, version)) {
      // Optional: promote if we're behind a ghost newer latest that was retagged away.
      console.log(`${name}@${version} available; current latest is ${latest}`);
    }
    writeFileSync(join(dir, "package.json"), original);
    return { name, version, skipped: true, ok: true };
  }

  // Metadata without blob — cannot overwrite; bump.
  if (versionExists(name, version) && !tarballOk(name, version)) {
    console.warn(`${name}@${version} metadata exists without tarball — bumping`);
    version = bumpPatch(version);
  }

  const publishConfig = pkg.publishConfig ?? {};
  const { access: _access, ...publishedFields } = publishConfig;
  const outgoing = { ...pkg, ...publishedFields, version };
  writePkg(dir, outgoing);
  console.log(`${name} ${version}`);

  try {
    run("npm publish --access public", dir);
    finalizePublish(name, version);
    return { name, version, skipped: false, ok: true };
  } finally {
    writeFileSync(join(dir, "package.json"), original);
  }
}

run("npm run build --workspace=promptimizer");

const results = [];
const packages = [
  ["promptimizer", join(root, "packages/sdk")],
  ["promptimizer-cli", join(root, "packages/cli")],
];

for (const [name, dir] of packages) {
  try {
    results.push(publish(name, dir));
  } catch (err) {
    console.error(err instanceof Error ? err.message : err);
    try {
      ensureLatestInstallable(name);
    } catch (repairErr) {
      console.error(repairErr instanceof Error ? repairErr.message : repairErr);
    }
    results.push({ name, ok: false, error: String(err) });
  }
}

for (const [name] of packages) {
  try {
    ensureLatestInstallable(name);
  } catch (err) {
    console.error(err instanceof Error ? err.message : err);
    results.push({ name, ok: false, error: String(err) });
  }
}

console.log("publish results:", JSON.stringify(results, null, 2));
if (results.some((r) => r.ok === false)) process.exit(1);
