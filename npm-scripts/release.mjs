import { appendFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { dispatchRelease } from "./release-dispatch.mjs";
import { githubApi } from "./release-github.mjs";
import { planRelease, stampRelease } from "./release-plan.mjs";
import { publishRelease } from "./release-publish.mjs";

const root = process.cwd();
const state = join(root, ".tmp", "release");
const read = (name) => JSON.parse(readFileSync(join(state, `${name}.json`), "utf8"));
const write = (name, value) => writeFileSync(join(state, `${name}.json`), `${JSON.stringify(value, null, 2)}\n`);

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
    root,
    sha: run?.head_sha ?? process.env.GITHUB_SHA,
    ref: run ? "refs/heads/main" : process.env.GITHUB_REF,
    repository: process.env.GITHUB_REPOSITORY,
    github: githubApi(process.env.GH_TOKEN),
  });
  mkdirSync(state, { recursive: true });
  write("plan", plan);
  if (plan) stampRelease(root, plan);
  else console.log("release: no shipped change needs a new version");
  appendFileSync(process.env.GITHUB_OUTPUT, `version=${plan?.version ?? ""}\n`);
};

const command = process.argv[2];
if (command === "prepare") await prepare();
else if (command === "publish")
  write("published", await publishRelease({ root, plan: read("plan"), github: githubApi(process.env.GH_TOKEN) }));
else if (command === "dispatch") await dispatchRelease(read("published"), process.env.CONTROL_PLANE_DISPATCH_TOKEN);
else throw new Error("Unknown release command. Run release:prepare, release:publish or release:dispatch.");
