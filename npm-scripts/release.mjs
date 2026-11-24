import { execFileSync, spawnSync } from "node:child_process";
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { candidatePlan, releaseSource } from "./release-plan.mjs";

const { GITHUB_REF_TYPE, GITHUB_REF_NAME, GITHUB_REPOSITORY, CONTROL_PLANE_DISPATCH_TOKEN } = process.env;
const tagPush = GITHUB_REF_TYPE === "tag";
const plan = tagPush
  ? { tag: GITHUB_REF_NAME, version: GITHUB_REF_NAME.slice(1) }
  : candidatePlan(releaseSource(process.cwd()));
if (!plan) process.exit(0);

const { tag, version } = plan;
const sha = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8", timeout: 30_000 }).trim();
const gh = (args, options) => execFileSync("gh", args, { encoding: "utf8", timeout: 120_000, ...options });
const endpoint = `repos/${GITHUB_REPOSITORY}/releases/tags/${encodeURIComponent(tag)}`;
const lookup = spawnSync("gh", ["api", "--include", endpoint], { encoding: "utf8", timeout: 120_000 });
if (lookup.error) throw lookup.error;
const status = /^HTTP\/\S+ (\d{3})\b/.exec(lookup.stdout)?.[1];

let release;
if (lookup.status === 0 && status === "200") {
  release = JSON.parse(lookup.stdout.replace(/^[\s\S]*?\r?\n\r?\n/, ""));
} else if (lookup.status === 1 && status === "404") {
  for (const path of ["packages/dashboard/package.json", "packages/pages/package.json"]) {
    const manifest = JSON.parse(readFileSync(path, "utf8"));
    if (tagPush && manifest.version !== version)
      throw new Error(`The version in ${path} must match ${tag}. Update both package versions before tagging.`);
    manifest.version = version;
    writeFileSync(path, `${JSON.stringify(manifest, null, 2)}\n`);
  }
  execFileSync("npm", ["run", "pack"], { stdio: "inherit", timeout: 600_000 });
  execFileSync("npm", ["run", "pack:check"], { stdio: "inherit", timeout: 120_000 });
  const files = readdirSync("release")
    .sort()
    .map((file) => `release/${file}`);
  const prerelease = version.includes("-rc.") ? ["--prerelease"] : [];
  gh(["release", "create", tag, ...files, "--target", sha, "--generate-notes", ...prerelease]);
  release = JSON.parse(gh(["api", endpoint]));
} else {
  throw new Error(`GitHub release lookup failed for ${tag}. ${lookup.stderr.trim()}`);
}

if (!CONTROL_PLANE_DISPATCH_TOKEN) {
  console.log("::warning::Set CONTROL_PLANE_DISPATCH_TOKEN to dispatch this release to control-plane.");
  process.exit(0);
}

const client_payload = {
  component: "dashboard",
  repository: GITHUB_REPOSITORY,
  tag,
  sha,
  assets: release.assets.map((asset) => asset.browser_download_url),
};
gh(["api", "--method", "POST", "/repos/tumpel/control-plane/dispatches", "--input", "-"], {
  env: { ...process.env, GH_TOKEN: CONTROL_PLANE_DISPATCH_TOKEN },
  input: JSON.stringify({ event_type: "component-released", client_payload }),
});
