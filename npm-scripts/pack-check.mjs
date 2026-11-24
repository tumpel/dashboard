#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const release = join(root, "release");
const scratch = join(root, ".tmp", "pack-check");
const tarballs = readdirSync(release)
  .filter((name) => name.endsWith(".tgz"))
  .map((name) => join(release, name));
if (tarballs.length !== 2) throw new Error(`release holds ${tarballs.length} tarballs, not 2; run npm run pack first`);

rmSync(scratch, { recursive: true, force: true });
mkdirSync(scratch, { recursive: true });
writeFileSync(join(scratch, "package.json"), '{ "private": true, "type": "module" }\n');
execFileSync("npm", ["install", "--no-audit", "--no-fund", ...tarballs], {
  cwd: scratch,
  stdio: "inherit",
  timeout: 120_000,
});

const dashboard = join(scratch, "node_modules", "@tumpel", "dashboard");
const manifest = JSON.parse(readFileSync(join(dashboard, "package.json"), "utf8"));
if (manifest.dependencies !== undefined) {
  throw new Error("the dashboard tarball names dependencies; keep every dashboard package in devDependencies");
}
const index = readFileSync(join(dashboard, "dist", "index.html"), "utf8");
if (index.includes("tumpel-api-origin")) {
  throw new Error(
    "the built index.html carries a tumpel-api-origin tag; the hosting server inserts it, never the build",
  );
}
if (!existsSync(join(dashboard, "dist", "fonts", "inter-latin-wght-normal.woff2"))) {
  throw new Error("the dashboard tarball has no dist/fonts; the control plane pages load their fonts from there");
}

writeFileSync(
  join(scratch, "check.ts"),
  [
    'import { linksFor, shellDocument } from "@tumpel/pages";',
    'const links = linksFor({ dashboard: "https://tumpel.example.com", api: "https://api.example.com" });',
    'if (links.cli !== "https://api.example.com/v1/releases/cli/Amd64" || typeof shellDocument !== "function")',
    '  throw new Error("the installed @tumpel/pages tarball does not export its links and shell");',
    'console.log("pack-check: both tarballs install, and @tumpel/pages typechecks and imports with plain node");',
    "",
  ].join("\n"),
);
writeFileSync(
  join(scratch, "tsconfig.json"),
  `${JSON.stringify({
    compilerOptions: {
      target: "es2023",
      module: "nodenext",
      moduleResolution: "nodenext",
      strict: true,
      noEmit: true,
      types: [],
    },
    files: ["check.ts"],
  })}\n`,
);
execFileSync(join(root, "node_modules", ".bin", "tsc"), ["-p", scratch], { stdio: "inherit", timeout: 120_000 });
const requireFromScratch = createRequire(join(scratch, "package.json"));
for (const css of ["tokens.css", "shell.css"]) requireFromScratch.resolve(`@tumpel/pages/${css}`);
execFileSync(process.execPath, ["check.ts"], { cwd: scratch, stdio: "inherit", timeout: 30_000 });
