#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const release = join(root, "release");
const ARTIFACTS = [
  ["@tumpel/dashboard", "packages/dashboard", "dashboard"],
  ["@tumpel/pages", "packages/pages", "pages"],
];

const versionOf = (directory) => JSON.parse(readFileSync(join(root, directory, "package.json"), "utf8")).version;
const versions = new Set(ARTIFACTS.map(([, directory]) => versionOf(directory)));
if (versions.size !== 1) {
  throw new Error(
    `the packages name different versions (${[...versions].join(", ")}); set the same version in every packages/*/package.json`,
  );
}
const [version] = versions;

rmSync(release, { recursive: true, force: true });
mkdirSync(release, { recursive: true });

for (const [name, , artifact] of ARTIFACTS) {
  const [packed] = JSON.parse(
    execFileSync("npm", ["pack", "-w", name, "--pack-destination", release, "--json"], { cwd: root, encoding: "utf8" }),
  );
  const tarball = `${artifact}-${version}.tgz`;
  renameSync(join(release, packed.filename), join(release, tarball));
  const digest = createHash("sha256")
    .update(readFileSync(join(release, tarball)))
    .digest("hex");
  writeFileSync(join(release, `${tarball}.sha256`), `${digest}  ${tarball}\n`);
  console.log(`pack: release/${tarball} ${digest}`);
}
