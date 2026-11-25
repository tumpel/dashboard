import { execFileSync } from "node:child_process";

const NOT_SHIPPED = ["doc/**", "docs/**", "**/*.md", "LICENSE", "rules/**", ".github/**", "packages/*/test/**"].map(
  (pattern) => `:(exclude,glob)${pattern}`,
);

export const planCandidate = (root) => {
  const git = (...args) => execFileSync("git", args, { cwd: root, encoding: "utf8", timeout: 30_000 }).trim();
  const describe = ["describe", "--tags", "--abbrev=0", "--match", "v[0-9]*"];
  const nearest = git(...describe, "HEAD^");
  if (!git("diff", "--name-only", nearest, "HEAD", "--", ".", ...NOT_SHIPPED)) return null;

  const stable = git(...describe, "--exclude", "*-*", "HEAD^");
  const [major, minor] = stable.slice(1).split(".");
  const count = git("rev-list", "--count", `${stable}..HEAD`);
  const version = `${major}.${Number(minor) + 1}.0-rc.${count}`;
  return { tag: `v${version}`, version };
};
