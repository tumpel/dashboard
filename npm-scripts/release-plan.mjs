import { execFileSync } from "node:child_process";

const exclude = (patterns) => patterns.map((pattern) => `:(exclude,glob)${pattern}`);
export const DOCS = exclude(["doc/**", "**/*.md", "LICENSE", ".github/ISSUE_TEMPLATE/**"]);
export const NOT_SHIPPED = [...DOCS, ...exclude(["rules/**", ".github/**", "packages/*/test/**"])];

export const releaseSource = (root) => {
  const run = (command, ...args) =>
    execFileSync(command, args, { cwd: root, encoding: "utf8", timeout: 30_000 }).trim();
  const stable = run("convco", "version", "--ignore-prereleases");
  const next = run("convco", "version", "--ignore-prereleases", "--bump");
  const nearest = run("git", "describe", "--tags", "--abbrev=0", "--match", "v[0-9]*", "HEAD^");
  const changed = run("git", "diff", "--name-only", nearest, "HEAD", "--", ".", ...NOT_SHIPPED);
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
