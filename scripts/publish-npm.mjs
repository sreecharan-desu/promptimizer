#!/usr/bin/env node
/**
 * Publish SDK + CLI to npm.
 *
 * Important: a successful `npm publish` can briefly (or, rarely, permanently)
 * leave metadata without a downloadable tarball. We must not leave @latest on
 * a broken version — that breaks `npm i promptimizer`.
 */
import { execSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function run(command, cwd = root, opts = {}) {
  return execSync(command, { cwd, stdio: opts.quiet ? "pipe" : "inherit", encoding: "utf8" });
}

function runCapture(command, cwd = root) {
  try {
    return execSync(command, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
  } catch {
    return null;
  }
}

function readPkg(dir) {
  return JSON.parse(readFileSync(join(dir, "package.json"), "utf8"));
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

/** Prefer an installable probe — CDN HEAD can lag behind registry metadata. */
function installable(name, version) {
  if (!tarballOk(name, version)) return false;
  const dir = mkdtempSync(join(tmpdir(), "pmz-npm-"));
  try {
    runCapture(`npm pack ${name}@${version} --pack-destination ${JSON.stringify(dir)}`);
    return true;
  } catch {
    return false;
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

function waitUntilInstallable(name, version, { attempts = 24, label = "tarball" } = {}) {
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    if (installable(name, version)) {
      console.log(`${name}@${version} ${label} ok (attempt ${attempt})`);
      return true;
    }
    const status = httpStatus(tarballUrl(name, version));
    console.log(
      `waiting for ${name}@${version} ${label} (attempt ${attempt}/${attempts}, http ${status})…`,
    );
    execSync(`sleep ${Math.min(20, 3 + attempt)}`);
  }
  return false;
}

function bumpPatch(version) {
  const [major, minor, patch] = version.split(".").map((part) => Number(part));
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
  // If @latest exists but is not installable, still bump so we can repair latest.
  return cmp(local, remote) > 0 ? local : bumpPatch(remote);
}

function lastInstallableVersion(name, current) {
  const versionsRaw = runCapture(`npm view ${name} versions --json`);
  if (!versionsRaw) return null;
  let versions;
  try {
    versions = JSON.parse(versionsRaw);
  } catch {
    return null;
  }
  if (!Array.isArray(versions)) return null;
  for (let i = versions.length - 1; i >= 0; i -= 1) {
    const v = versions[i];
    if (v === current) continue;
    if (tarballOk(name, v)) return v;
  }
  return null;
}

function ensureLatestInstallable(name) {
  const latest = publishedVersion(name);
  if (!latest) return;
  if (installable(name, latest) || waitUntilInstallable(name, latest, { attempts: 6, label: "latest" })) {
    return;
  }
  const fallback = lastInstallableVersion(name, latest);
  if (!fallback) {
    throw new Error(`${name}@${latest} is @latest but not installable, and no fallback version found`);
  }
  console.warn(`Repairing ${name}: @latest ${latest} not installable → tagging ${fallback}`);
  run(`npm dist-tag add ${name}@${fallback} latest`);
  if (!installable(name, fallback)) {
    throw new Error(`Failed to repair ${name} @latest → ${fallback}`);
  }
  console.log(`${name}@latest -> ${fallback}`);
}

function publish(name, dir) {
  const original = readFileSync(join(dir, "package.json"), "utf8");
  const pkg = JSON.parse(original);
  const remote = publishedVersion(name);
  const version = nextVersion(pkg.version, remote);

  // Already published and installable — nothing to do.
  if (versionExists(name, version) && (installable(name, version) || waitUntilInstallable(name, version, { attempts: 8 }))) {
    console.log(`${name}@${version} already published and installable — skip`);
    writeFileSync(join(dir, "package.json"), original);
    return { name, version, skipped: true, ok: true };
  }

  const publishConfig = pkg.publishConfig ?? {};
  const { access: _access, ...publishedFields } = publishConfig;
  const outgoing = {
    ...pkg,
    ...publishedFields,
    version,
  };
  writePkg(dir, outgoing);
  console.log(`${name} ${version}`);

  try {
    if (versionExists(name, version) && !tarballOk(name, version)) {
      // Metadata-only / broken prior publish — cannot overwrite; bump again.
      const repaired = bumpPatch(version);
      console.warn(`${name}@${version} exists but tarball missing — publishing ${repaired} instead`);
      outgoing.version = repaired;
      writePkg(dir, outgoing);
      run("npm publish --access public", dir);
      const ok = waitUntilInstallable(name, repaired, { attempts: 24 });
      if (!ok) {
        ensureLatestInstallable(name);
        throw new Error(`${name}@${repaired} published but still not installable`);
      }
      return { name, version: repaired, skipped: false, ok: true };
    }

    run("npm publish --access public", dir);
    const ok = waitUntilInstallable(name, outgoing.version, { attempts: 24 });
    if (!ok) {
      ensureLatestInstallable(name);
      throw new Error(
        `${name}@${outgoing.version} published but tarball not installable: ${tarballUrl(name, outgoing.version)}`,
      );
    }
    return { name, version: outgoing.version, skipped: false, ok: true };
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
    results.push({ name, ok: false, error: String(err) });
    // Always try to leave @latest installable even when this package failed.
    try {
      ensureLatestInstallable(name);
    } catch (repairErr) {
      console.error(repairErr instanceof Error ? repairErr.message : repairErr);
    }
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
