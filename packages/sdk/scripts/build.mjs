import { mkdirSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";
import { execSync } from "node:child_process";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dist = join(root, "dist");

rmSync(dist, { recursive: true, force: true });
mkdirSync(dist, { recursive: true });

const entries = [
  ["src/index.ts", "index"],
  ["src/providers.ts", "providers"],
];

for (const [entry, name] of entries) {
  await build({
    absWorkingDir: root,
    entryPoints: [entry],
    outfile: join(dist, `${name}.js`),
    bundle: true,
    format: "esm",
    platform: "neutral",
    target: "es2022",
  });
  await build({
    absWorkingDir: root,
    entryPoints: [entry],
    outfile: join(dist, `${name}.cjs`),
    bundle: true,
    format: "cjs",
    platform: "node",
    target: "es2022",
  });
}

execSync("npx tsc --emitDeclarationOnly -p tsconfig.json", { cwd: root, stdio: "inherit" });
