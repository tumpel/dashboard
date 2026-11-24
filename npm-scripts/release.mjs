import { execFileSync } from "node:child_process";
import { appendFileSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { releaseDecision, releaseSource, remoteTagSha, requireReleaseSha, stampRelease } from "./release-plan.mjs";

const root = process.cwd();
const state = join(root, ".tmp", "release");
const read = (name) => JSON.parse(readFileSync(join(state, `${name}.json`), "utf8"));
const write = (name, value) => writeFileSync(join(state, `${name}.json`), `${JSON.stringify(value, null, 2)}\n`);
const gh = (args, options) => execFileSync("gh", args, { cwd: root, encoding: "utf8", timeout: 120_000, ...options });

const prepare = () => {
  const event = JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH, "utf8"));
  const run = event.workflow_run;
  const source = releaseSource({
    root,
    sha: run?.head_sha ?? process.env.GITHUB_SHA,
    ref: run ? "refs/heads/main" : process.env.GITHUB_REF,
    repository: process.env.GITHUB_REPOSITORY,
  });
  const tagCheck = run
    ? undefined
    : JSON.parse(
        gh([
          "api",
          `/repos/${source.repository}/actions/workflows/checks.yml/runs?head_sha=${source.sha}&event=push&branch=main&per_page=1`,
        ]),
      ).workflow_runs[0];
  const plan = releaseDecision({
    ...source,
    conclusion: run ? run.conclusion : tagCheck?.status === "completed" ? tagCheck.conclusion : undefined,
  });
  mkdirSync(state, { recursive: true });
  write("plan", plan);
  if (plan) stampRelease(root, plan);
  else console.log("release: no shipped change needs a new version");
  appendFileSync(process.env.GITHUB_OUTPUT, `version=${plan?.version ?? ""}\n`);
};

const command = process.argv[2];
if (command === "prepare") prepare();
else if (command === "publish") {
  const plan = read("plan");
  requireReleaseSha(root, plan.sha);
  const existingSha = remoteTagSha(root, plan.tag);
  if (existingSha !== undefined && existingSha !== plan.sha)
    throw new Error(`Release tag ${plan.tag} does not point to the checked SHA ${plan.sha}.`);
  execFileSync("npm", ["run", "pack"], { cwd: root, stdio: "inherit", timeout: 600_000 });
  execFileSync("npm", ["run", "pack:check"], { cwd: root, stdio: "inherit", timeout: 120_000 });
  const assets = readdirSync(join(root, "release"))
    .sort()
    .map((name) => join(root, "release", name));
  gh([
    "release",
    "create",
    plan.tag,
    ...assets,
    "--repo",
    plan.repository,
    "--target",
    plan.sha,
    "--title",
    plan.tag,
    "--generate-notes",
    `--latest=${!plan.prerelease}`,
    ...(plan.prerelease ? ["--prerelease"] : []),
  ]);
  const publishedAssets = JSON.parse(
    gh(["release", "view", plan.tag, "--repo", plan.repository, "--json", "assets", "--jq", "[.assets[].url]"]),
  );
  write("published", {
    component: "dashboard",
    repository: plan.repository,
    sha: plan.sha,
    tag: plan.tag,
    assets: publishedAssets,
  });
} else if (command === "dispatch") {
  const token = process.env.CONTROL_PLANE_DISPATCH_TOKEN;
  if (!token) throw new Error("Release dispatch failed. Set CONTROL_PLANE_DISPATCH_TOKEN.");
  gh(["api", "--method", "POST", "/repos/tumpel/control-plane/dispatches", "--input", "-"], {
    env: { ...process.env, GH_TOKEN: token },
    input: JSON.stringify({ event_type: "component-released", client_payload: read("published") }),
  });
} else throw new Error("Unknown release command. Run release:prepare, release:publish or release:dispatch.");
