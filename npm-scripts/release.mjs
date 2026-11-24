import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";
import { planCandidate } from "./release-plan.mjs";

const { GITHUB_REF_TYPE, GITHUB_REF_NAME } = process.env;
const tagPush = GITHUB_REF_TYPE === "tag";
const plan = tagPush ? { tag: GITHUB_REF_NAME, version: GITHUB_REF_NAME.slice(1) } : planCandidate(process.cwd());
if (!plan) process.exit(0);
const { tag, version } = plan;
if (tagPush) {
  for (const path of ["packages/dashboard/package.json", "packages/pages/package.json"]) {
    const manifest = JSON.parse(readFileSync(path, "utf8"));
    if (manifest.version !== version)
      throw new Error(`The version in ${path} must match ${tag}. Update both package versions before tagging.`);
  }
} else {
  execFileSync("npm", ["version", version, "--workspaces", "--no-git-tag-version"], {
    stdio: "inherit",
    timeout: 120_000,
  });
}

execFileSync("npm", ["run", "pack"], { stdio: "inherit", timeout: 600_000 });
const sha = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8", timeout: 30_000 }).trim();
const files = readdirSync("release").map((file) => `release/${file}`);
const prerelease = tagPush ? [] : ["--prerelease"];
execFileSync("gh", ["release", "create", tag, ...files, "--target", sha, "--generate-notes", ...prerelease], {
  stdio: "inherit",
  timeout: 120_000,
});
