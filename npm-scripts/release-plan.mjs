import { execFileSync, spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { waitFor } from "./release-wait.mjs";

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
const read = (root, path) => JSON.parse(readFileSync(join(root, path), "utf8"));
const write = (root, path, value) => writeFileSync(join(root, path), `${JSON.stringify(value, null, 2)}\n`);

export const planRelease = async ({ root, sha, ref, repository, github, clock }) => {
  const git = (...args) => execFileSync("git", args, { cwd: root, encoding: "utf8", timeout: 30_000 }).trim();
  if (git("rev-parse", "HEAD") !== sha)
    throw new Error("The checkout does not match the release source SHA. Check out the triggering SHA.");
  await waitFor(async () => {
    const result = await github(
      `/repos/${repository}/actions/workflows/checks.yml/runs?head_sha=${sha}&event=push&per_page=100`,
    );
    const [run] = result.workflow_runs
      .filter((run) => run.head_sha === sha && run.event === "push" && run.head_branch === "main")
      .sort((left, right) => right.id - left.id);
    if (run?.status !== "completed") return null;
    if (run.conclusion !== "success")
      throw new Error(`Checks failed for ${sha}. Fix the checks before releasing this SHA.`);
    return run;
  }, clock);
  if (ref.startsWith("refs/tags/")) {
    const tag = ref.slice("refs/tags/".length);
    if (!/^v\d+\.\d+\.\d+(?:-rc\.\d+)?$/.test(tag))
      throw new Error("The release tag is not a version. Use vX.Y.Z or vX.Y.Z-rc.N.");
    for (const path of PACKAGES) {
      if (`v${read(root, `${path}/package.json`).version}` !== tag)
        throw new Error(`The ${path} version does not match ${tag}. Match both package versions before tagging.`);
    }
    return { sha, tag, version: tag.slice(1), prerelease: tag.includes("-rc."), repository };
  }
  const convco = (...args) =>
    execFileSync("convco", ["version", ...args], { cwd: root, encoding: "utf8", timeout: 30_000 }).trim();
  const stable = convco("--ignore-prereleases");
  const next = convco("--bump", "--ignore-prereleases", ...SHIPPED.flatMap((path) => ["-P", path]));
  const nearest = git("describe", "--tags", "--abbrev=0", "--match", "v[0-9]*", "--exclude", "v*-main.*");
  const diff = spawnSync("git", ["diff", "--quiet", nearest, "HEAD", "--", ...SHIPPED], { cwd: root, timeout: 30_000 });
  if (diff.error) throw diff.error;
  if (![0, 1].includes(diff.status))
    throw new Error("The shipped-file comparison failed. Fetch the release tags and retry.");
  if (next === stable || diff.status === 0) return null;
  const version = `${next}-rc.${git("rev-list", "--count", `v${stable}..HEAD`)}`;
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
