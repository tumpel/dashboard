import { execFileSync, spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const SHIPPED = [
  "packages/dashboard/src",
  "packages/dashboard/public",
  "packages/dashboard/index.html",
  "packages/dashboard/package.json",
  "packages/dashboard/tsconfig.json",
  "packages/dashboard/vite.config.ts",
  "packages/pages/src",
  "packages/pages/package.json",
  "packages/pages/tsconfig.build.json",
  "package.json",
  "package-lock.json",
  "npm-scripts/pack.mjs",
  "npm-scripts/pack-check.mjs",
];
const PACKAGES = ["packages/dashboard", "packages/pages"];
const RELEASE_TAG = /^v\d+\.\d+\.\d+(?:-rc\.\d+)?$/;
const read = (root, path) => JSON.parse(readFileSync(join(root, path), "utf8"));
const write = (root, path, value) => writeFileSync(join(root, path), `${JSON.stringify(value, null, 2)}\n`);

const git = (root, ...args) => execFileSync("git", args, { cwd: root, encoding: "utf8", timeout: 30_000 }).trim();

export const requireReleaseSha = (root, sha) => {
  if (git(root, "rev-parse", "HEAD") !== sha)
    throw new Error("The checkout does not match the release source SHA. Check out the triggering SHA.");
};

export const remoteTagShas = (root) => {
  const refs = git(root, "ls-remote", "--tags", "origin", "refs/tags/v[0-9]*");
  const commits = new Map();
  for (const line of refs.split("\n").filter(Boolean)) {
    const [sha, ref] = line.split("\t");
    const tag = ref.slice("refs/tags/".length).replace(/\^\{\}$/, "");
    if (!RELEASE_TAG.test(tag)) continue;
    if (ref.endsWith("^{}") || !commits.has(tag)) commits.set(tag, sha);
  }
  return commits;
};

export const releaseSource = ({ root, sha, ref, repository, pendingTags = [] }) => {
  const source = { sha, ref, repository };
  if (ref.startsWith("refs/tags/"))
    return { ...source, versions: PACKAGES.map((path) => read(root, `${path}/package.json`).version) };
  const convco = (...args) =>
    execFileSync("convco", ["version", ...args], { cwd: root, encoding: "utf8", timeout: 30_000 }).trim();
  const stable = convco("--ignore-prereleases");
  const next = convco("--bump", "--ignore-prereleases", ...SHIPPED.flatMap((path) => ["-P", path]));
  const nearest = git(
    root,
    "describe",
    "--tags",
    "--abbrev=0",
    "--match",
    "v[0-9]*",
    ...pendingTags.flatMap((tag) => ["--exclude", tag]),
  );
  const diff = spawnSync("git", ["diff", "--quiet", nearest, "HEAD", "--", ...SHIPPED], { cwd: root, timeout: 30_000 });
  if (diff.error) throw diff.error;
  if (![0, 1].includes(diff.status))
    throw new Error("The shipped-file comparison failed. Fetch the release tags and retry.");
  return {
    ...source,
    stable,
    next,
    commitCount: Number(git(root, "rev-list", "--count", `v${stable}..HEAD`)),
    shippedChanged: diff.status === 1,
  };
};

export const releaseDecision = ({
  sha,
  ref,
  repository,
  conclusion,
  versions,
  stable,
  next,
  commitCount,
  shippedChanged,
}) => {
  if (ref.startsWith("refs/tags/")) {
    if (!conclusion) throw new Error(`Checks are incomplete for ${sha}. Release only after this SHA passes checks.`);
    if (conclusion !== "success")
      throw new Error(`Checks failed for ${sha}. Fix the checks before releasing this SHA.`);
    const tag = ref.slice("refs/tags/".length);
    if (!RELEASE_TAG.test(tag)) throw new Error("The release tag is not a version. Use vX.Y.Z or vX.Y.Z-rc.N.");
    if (versions.some((version) => `v${version}` !== tag))
      throw new Error(`The package versions do not match ${tag}. Match both package versions before tagging.`);
    return { sha, tag, version: tag.slice(1), prerelease: tag.includes("-rc."), repository };
  }
  if (next === stable || !shippedChanged) return null;
  const version = `${next}-rc.${commitCount}`;
  return { sha, tag: `v${version}`, version, prerelease: true, repository };
};

export const stampRelease = (root, plan) => {
  const lock = read(root, "package-lock.json");
  for (const path of PACKAGES) {
    const manifest = read(root, `${path}/package.json`);
    manifest.version = plan.version;
    write(root, `${path}/package.json`, manifest);
    lock.packages[path].version = plan.version;
  }
  write(root, "package-lock.json", lock);
};
