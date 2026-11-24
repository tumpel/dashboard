import { execFileSync } from "node:child_process";

const EXCLUDE = ["doc/**", "**/*.md", "rules/**", ".github/**", "packages/*/test/**"];

export const releaseSource = (root) => {
  const run = (command, ...args) =>
    execFileSync(command, args, { cwd: root, encoding: "utf8", timeout: 30_000 }).trim();
  const stable = run("convco", "version", "--ignore-prereleases");
  const next = run("convco", "version", "--ignore-prereleases", "--bump");
  const nearest = run("git", "describe", "--tags", "--abbrev=0", "--match", "v[0-9]*", "HEAD^");
  const paths = EXCLUDE.map((pattern) => `:(exclude,glob)${pattern}`);
  const changed = run("git", "diff", "--name-only", nearest, "HEAD", "--", ".", ...paths);
  return {
    stable,
    next,
    commitCount: Number(run("git", "rev-list", "--count", `v${stable}..HEAD`)),
    shippedChanged: changed !== "",
  };
};

export const candidatePlan = ({ stable, next, commitCount, shippedChanged }) => {
  if (next === stable || !shippedChanged) return null;
  const version = `${next}-rc.${commitCount}`;
  return { tag: `v${version}`, version };
};
