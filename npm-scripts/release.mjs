import { execFileSync } from "node:child_process";
import { appendFileSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { planRelease, releaseSource, stampRelease } from "./release-plan.mjs";

const root = process.cwd();
const state = join(root, ".tmp", "release");
const read = (name) => JSON.parse(readFileSync(join(state, `${name}.json`), "utf8"));
const write = (name, value) => writeFileSync(join(state, `${name}.json`), `${JSON.stringify(value, null, 2)}\n`);
const gh = (args, options) => execFileSync("gh", args, { cwd: root, encoding: "utf8", timeout: 120_000, ...options });

const prepare = async () => {
  const event = JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH, "utf8"));
  const run = event.workflow_run;
  if (
    run &&
    (run.head_repository.full_name !== process.env.GITHUB_REPOSITORY ||
      run.head_branch !== "main" ||
      run.event !== "push")
  )
    throw new Error(
      "The release event is not a main push from this repository. Use this repository's main checks event.",
    );
  const plan = await planRelease({
    ...releaseSource({
      root,
      sha: run?.head_sha ?? process.env.GITHUB_SHA,
      ref: run ? "refs/heads/main" : process.env.GITHUB_REF,
      repository: process.env.GITHUB_REPOSITORY,
    }),
    run,
    github: (path) => JSON.parse(gh(["api", path])),
  });
  mkdirSync(state, { recursive: true });
  write("plan", plan);
  if (plan) stampRelease(root, plan);
  else console.log("release: no shipped change needs a new version");
  appendFileSync(process.env.GITHUB_OUTPUT, `version=${plan?.version ?? ""}\n`);
};

const command = process.argv[2];
if (command === "prepare") await prepare();
else if (command === "publish") {
  const plan = read("plan");
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
    "--draft",
    "--generate-notes",
    ...(plan.prerelease ? ["--prerelease"] : []),
  ]);
  gh(["release", "edit", plan.tag, "--repo", plan.repository, "--draft=false", `--latest=${!plan.prerelease}`]);
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
  if (!token) {
    console.log(
      "::notice::CONTROL_PLANE_DISPATCH_TOKEN is empty; skipping component-released dispatch to control-plane.",
    );
  } else {
    gh(["api", "--method", "POST", "/repos/tumpel/control-plane/dispatches", "--input", "-"], {
      env: { ...process.env, GH_TOKEN: token },
      input: JSON.stringify({ event_type: "component-released", client_payload: read("published") }),
    });
  }
} else throw new Error("Unknown release command. Run release:prepare, release:publish or release:dispatch.");
