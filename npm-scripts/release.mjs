import { execFileSync } from "node:child_process";
import { appendFileSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { candidatePlan, releaseSource } from "./release-plan.mjs";

const { GITHUB_REF_TYPE, GITHUB_REF_NAME, GITHUB_OUTPUT } = process.env;
const tagPush = GITHUB_REF_TYPE === "tag";
const plan = tagPush
  ? { tag: GITHUB_REF_NAME, version: GITHUB_REF_NAME.slice(1) }
  : candidatePlan(releaseSource(process.cwd()));
if (!plan) process.exit(0);
const { tag, version } = plan;
for (const path of ["packages/dashboard/package.json", "packages/pages/package.json"]) {
  const manifest = JSON.parse(readFileSync(path, "utf8"));
  if (tagPush && manifest.version !== version)
    throw new Error(`The version in ${path} must match ${tag}. Update both package versions before tagging.`);
  writeFileSync(path, `${JSON.stringify({ ...manifest, version }, null, 2)}\n`);
}

execFileSync("npm", ["run", "pack"], { stdio: "inherit", timeout: 600_000 });
execFileSync("npm", ["run", "pack:check"], { stdio: "inherit", timeout: 120_000 });
const sha = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8", timeout: 30_000 }).trim();
const files = readdirSync("release").map((file) => `release/${file}`);
const prerelease = version.includes("-rc.") ? ["--prerelease"] : [];
execFileSync("gh", ["release", "create", tag, ...files, "--target", sha, "--generate-notes", ...prerelease], {
  stdio: "inherit",
  timeout: 120_000,
});
appendFileSync(GITHUB_OUTPUT, `tag=${tag}\n`);
