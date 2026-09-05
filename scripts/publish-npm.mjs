#!/usr/bin/env node
import { execSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function run(command, cwd = root) {
  execSync(command, { cwd, stdio: "inherit" });
}

function readPkg(dir) {
  return JSON.parse(readFileSync(join(dir, "package.json"), "utf8"));
}

function writePkg(dir, pkg) {
  writeFileSync(join(dir, "package.json"), `${JSON.stringify(pkg, null, 2)}\n`);
}

function publishedVersion(name) {
  try {
    return execSync(`npm view ${name} version`, {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return null;
  }
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
  return cmp(local, remote) > 0 ? local : bumpPatch(remote);
}

function publish(name, dir) {
  const original = readFileSync(join(dir, "package.json"), "utf8");
  const pkg = JSON.parse(original);
  const version = nextVersion(pkg.version, publishedVersion(name));
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
    run("npm publish --access public", dir);
    // Guard against registry metadata without a tarball (breaks @latest installs).
    // npm can 404 briefly after publish — retry before failing the workflow.
    const tarball = `https://registry.npmjs.org/${name}/-/${name}-${version}.tgz`;
    let status = "000";
    for (let attempt = 1; attempt <= 8; attempt += 1) {
      status = execSync(`curl -s -o /dev/null -w "%{http_code}" ${JSON.stringify(tarball)}`, {
        encoding: "utf8",
      }).trim();
      if (status === "200") break;
      execSync(`sleep ${Math.min(12, attempt * 2)}`);
    }
    if (status !== "200") {
      throw new Error(`${name}@${version} published but tarball returned HTTP ${status}: ${tarball}`);
    }
    console.log(`${name}@${version} tarball ok`);
  } finally {
    writeFileSync(join(dir, "package.json"), original);
  }
}

run("npm run build --workspace=promptimizer");
publish("promptimizer", join(root, "packages/sdk"));
publish("promptimizer-cli", join(root, "packages/cli"));
