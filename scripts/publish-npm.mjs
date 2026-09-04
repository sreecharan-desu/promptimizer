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
  } finally {
    writeFileSync(join(dir, "package.json"), original);
  }
}

run("npm run build --workspace=promptimizer");
publish("promptimizer", join(root, "packages/sdk"));
publish("promptimizer-cli", join(root, "packages/cli"));
