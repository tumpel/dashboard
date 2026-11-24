import { execFileSync } from "node:child_process";
import { DOCS } from "./docs-paths.mjs";

const NOT_SHIPPED = [
  ...DOCS,
  ":(exclude,glob)rules/**",
  ":(exclude,glob).github/**",
  ":(exclude,glob)packages/*/test/**",
];

export const planCandidate = (root) => {
  const run = (command, ...args) =>
    execFileSync(command, args, { cwd: root, encoding: "utf8", timeout: 30_000 }).trim();
  const stable = run("convco", "version", "--ignore-prereleases");
  const next = run("convco", "version", "--ignore-prereleases", "--bump");
  const nearest = run("git", "describe", "--tags", "--abbrev=0", "--match", "v[0-9]*", "HEAD^");
  const changed = run("git", "diff", "--name-only", nearest, "HEAD", "--", ".", ...NOT_SHIPPED);
  if (next === stable || !changed) return null;
  const commitCount = Number(run("git", "rev-list", "--count", `v${stable}..HEAD`));
  const version = `${next}-rc.${commitCount}`;
  return { tag: `v${version}`, version };
};
