#!/usr/bin/env node
/**
 * Publish SDK + CLI to npm.
 *
 * - Publish under temporary tag `release`, promote to `latest` only when installable
 * - Never stack a new version while a prior `release` is still settling on the CDN
 * - Retry 403 "already published" by bumping
 * - Exit 0 when latest is healthy (CDN lag is not a hard failure)
 */
import { execSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const RELEASE_TAG = "release";
const MAX_PUBLISH_ATTEMPTS = 8;

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

function publishedLatest(name) {
  return runCapture(`npm view ${name} version`);
}

function distTag(name, tag) {
  const raw = runCapture(`npm view ${name} dist-tags --json`);
  if (!raw) return null;
  try {
    const tags = JSON.parse(raw);
    return typeof tags?.[tag] === "string" ? tags[tag] : null;
  } catch {
    return null;
  }
}

function versionExists(name, version) {
  return Boolean(runCapture(`npm view ${name}@${version} version`));
}

function tarballUrl(name, version) {
  return `https://registry.npmjs.org/${name}/-/${name}-${version}.tgz`;
}

function httpStatus(url) {
  try {
    return execSync(`curl -sL -o /dev/null -w "%{http_code}" --max-time 20 ${JSON.stringify(url)}`, {
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
    sleep(Math.min(20, 2 + attempt * 2));
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
    if ((left[i] || 0) !== (right[i] || 0)) return (left[i] || 0) - (right[i] || 0);
  }
  return 0;
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

function highestPublishedVersion(name) {
  const versions = listVersions(name);
  if (!versions.length) return null;
  return versions.reduce((best, cur) => (cmp(cur, best) > 0 ? cur : best));
}

function allocateVersion(name, local) {
  const highest = highestPublishedVersion(name);
  let version = highest ? (cmp(local, highest) > 0 ? local : bumpPatch(highest)) : local;
  for (let i = 0; i < 50 && versionExists(name, version); i += 1) {
    console.warn(`${name}@${version} already on registry — bumping`);
    version = bumpPatch(version);
  }
  return version;
}

function setDistTag(name, version, tag) {
  console.log(`npm dist-tag add ${name}@${version} ${tag}`);
  run(`npm dist-tag add ${name}@${version} ${tag}`);
}

function isPublishConflict(err) {
  const msg = String(err?.message || err);
  return /previously published|cannot publish over|EPUBLISHCONFLICT|E403/i.test(msg);
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

function ensureLatestInstallable(name) {
  const latest = publishedLatest(name);
  if (!latest) return null;

  if (!installable(name, latest)) {
    if (!waitUntilInstallable(name, latest, { attempts: 4, label: "latest-quick" })) {
      const fallback = lastInstallableVersion(name, latest);
      if (!fallback) {
        throw new Error(`${name}@${latest} is @latest but not installable, and no fallback found`);
      }
      console.warn(`Protecting installs: ${name}@latest ${latest} not ready → ${fallback}`);
      setDistTag(name, fallback, "latest");
      return fallback;
    }
  }

  // Prefer newest installable (may be on `release` ahead of `latest`).
  const versions = listVersions(name);
  for (let i = versions.length - 1; i >= 0; i -= 1) {
    const v = versions[i];
    if (!tarballOk(name, v)) continue;
    const current = publishedLatest(name);
    if (v !== current) {
      console.log(`Promoting ${name}@latest ${current} → ${v} (newer installable)`);
      setDistTag(name, v, "latest");
    }
    return v;
  }
  return publishedLatest(name);
}

/**
 * If a prior publish is still settling, wait/promote it instead of stacking ghosts.
 * Returns a result object when we should skip a new publish, else null.
 */
function settlePendingRelease(name) {
  const pending = distTag(name, RELEASE_TAG);
  const latest = publishedLatest(name);
  if (!pending) return null;
  if (latest && cmp(pending, latest) <= 0 && installable(name, latest)) {
    // release tag is not ahead — nothing pending
    return null;
  }
  if (installable(name, pending)) {
    setDistTag(name, pending, "latest");
    return { name, version: pending, skipped: true, ok: true, promoted: true };
  }
  console.log(`${name}@${pending} (${RELEASE_TAG}) still settling — waiting before any new publish`);
  if (waitUntilInstallable(name, pending, { attempts: 8, label: "pending-release" })) {
    setDistTag(name, pending, "latest");
    return { name, version: pending, skipped: true, ok: true, promoted: true };
  }
  // Ghost / stuck metadata: point release back at healthy latest, then allow a fresh bump.
  const safe = ensureLatestInstallable(name);
  if (safe) {
    console.warn(`Abandoning unsettled ${name}@${pending}; ${RELEASE_TAG} → ${safe}`);
    try {
      setDistTag(name, safe, RELEASE_TAG);
    } catch (err) {
      console.warn(String(err?.message || err));
    }
  }
  return null;
}

function finalizePublish(name, version) {
  if (waitUntilInstallable(name, version, { attempts: 8, label: "post-publish" })) {
    setDistTag(name, version, "latest");
    return true;
  }
  const safe = ensureLatestInstallable(name);
  console.warn(
    `${name}@${version} published as ${RELEASE_TAG} but CDN lag; @latest stays ${safe}. Next run will promote.`,
  );
  return true;
}

function publishPackage(name, dir) {
  ensureLatestInstallable(name);

  const settled = settlePendingRelease(name);
  if (settled) return settled;

  // If latest already matches the newest installable and FORCE_PUBLISH is unset, still
  // publish a bump when this workflow was intentionally triggered for package changes.
  // (Path filters + workflow_dispatch mean we always intend a release here.)

  const original = readFileSync(join(dir, "package.json"), "utf8");
  const pkg = JSON.parse(original);
  let version = allocateVersion(name, pkg.version);

  const publishConfig = pkg.publishConfig ?? {};
  const { access: _access, ...publishedFields } = publishConfig;

  try {
    for (let attempt = 1; attempt <= MAX_PUBLISH_ATTEMPTS; attempt += 1) {
      writePkg(dir, { ...pkg, ...publishedFields, version });
      console.log(`${name} ${version} (attempt ${attempt}/${MAX_PUBLISH_ATTEMPTS})`);

      try {
        run(`npm publish --access public --tag ${RELEASE_TAG}`, dir);
        finalizePublish(name, version);
        return { name, version, skipped: false, ok: true };
      } catch (err) {
        if (!isPublishConflict(err) || attempt === MAX_PUBLISH_ATTEMPTS) throw err;
        console.warn(`${name}@${version} publish conflict — bumping and retrying`);
        version = bumpPatch(version);
        while (versionExists(name, version)) version = bumpPatch(version);
      }
    }
    throw new Error(`${name}: exhausted publish retries`);
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
    results.push(publishPackage(name, dir));
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

const latestOk = packages.every(([name]) => {
  const v = publishedLatest(name);
  const ok = Boolean(v && installable(name, v));
  console.log(`${name}@${v || "?"} latest-installable=${ok}`);
  return ok;
});

console.log("publish results:", JSON.stringify(results, null, 2));
if (!latestOk || results.some((r) => r.ok === false)) process.exit(1);
