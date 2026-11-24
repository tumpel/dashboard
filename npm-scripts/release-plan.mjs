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
const read = (root, path) => JSON.parse(readFileSync(join(root, path), "utf8"));
const write = (root, path, value) => writeFileSync(join(root, path), `${JSON.stringify(value, null, 2)}\n`);

export const releaseSource = ({ root, sha, ref, repository }) => {
  const git = (...args) => execFileSync("git", args, { cwd: root, encoding: "utf8", timeout: 30_000 }).trim();
  if (git("rev-parse", "HEAD") !== sha)
    throw new Error("The checkout does not match the release source SHA. Check out the triggering SHA.");
  const source = { sha, ref, repository };
  if (ref.startsWith("refs/tags/"))
    return { ...source, versions: PACKAGES.map((path) => read(root, `${path}/package.json`).version) };
  const convco = (...args) =>
    execFileSync("convco", ["version", ...args], { cwd: root, encoding: "utf8", timeout: 30_000 }).trim();
  const stable = convco("--ignore-prereleases");
  const next = convco("--bump", "--ignore-prereleases", ...SHIPPED.flatMap((path) => ["-P", path]));
  const nearest = git("describe", "--tags", "--abbrev=0", "--match", "v[0-9]*", "--exclude", "v*-main.*");
  const diff = spawnSync("git", ["diff", "--quiet", nearest, "HEAD", "--", ...SHIPPED], { cwd: root, timeout: 30_000 });
  if (diff.error) throw diff.error;
  if (![0, 1].includes(diff.status))
    throw new Error("The shipped-file comparison failed. Fetch the release tags and retry.");
  return {
    ...source,
    tags: { stable: `v${stable}`, nearest },
    next,
    commits: git("rev-list", `v${stable}..HEAD`).split("\n").filter(Boolean),
    shippedChanged: diff.status === 1,
  };
};

export const releaseDecision = ({ sha, ref, repository, checks, versions, tags, next, commits, shippedChanged }) => {
  const [run] = checks
    .filter((run) => run.head_sha === sha && run.event === "push" && run.head_branch === "main")
    .sort((left, right) => right.id - left.id);
  if (run?.status !== "completed")
    throw new Error(`Checks are incomplete for ${sha}. Release only after this SHA passes checks.`);
  if (run.conclusion !== "success")
    throw new Error(`Checks failed for ${sha}. Fix the checks before releasing this SHA.`);
  if (ref.startsWith("refs/tags/")) {
    const tag = ref.slice("refs/tags/".length);
    if (!/^v\d+\.\d+\.\d+(?:-rc\.\d+)?$/.test(tag))
      throw new Error("The release tag is not a version. Use vX.Y.Z or vX.Y.Z-rc.N.");
    if (versions.some((version) => `v${version}` !== tag))
      throw new Error(`The package versions do not match ${tag}. Match both package versions before tagging.`);
    return { sha, tag, version: tag.slice(1), prerelease: tag.includes("-rc."), repository };
  }
  if (`v${next}` === tags.stable || !shippedChanged) return null;
  const version = `${next}-rc.${commits.length}`;
  return { sha, tag: `v${version}`, version, prerelease: true, repository };
};

export const planRelease = async ({ github, run, ...source }) => {
  if (run) return releaseDecision({ ...source, checks: [run] });
  const result = await github(
    `/repos/${source.repository}/actions/workflows/checks.yml/runs?head_sha=${source.sha}&event=push&per_page=100`,
  );
  return releaseDecision({ ...source, checks: result.workflow_runs });
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
