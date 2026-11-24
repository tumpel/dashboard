import { execFileSync } from "node:child_process";
import { appendFileSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { githubApi } from "./release-github.mjs";
import { planRelease, releaseSource, stampRelease } from "./release-plan.mjs";

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
    ...releaseSource({
      root,
      sha: run?.head_sha ?? process.env.GITHUB_SHA,
      ref: run ? "refs/heads/main" : process.env.GITHUB_REF,
      repository: process.env.GITHUB_REPOSITORY,
    }),
    run,
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
else if (command === "publish") {
  const plan = read("plan");
  const github = githubApi(process.env.GH_TOKEN);
  execFileSync("npm", ["run", "pack"], { cwd: root, stdio: "inherit", timeout: 600_000 });
  execFileSync("npm", ["run", "pack:check"], { cwd: root, stdio: "inherit", timeout: 120_000 });
  const release = await github(`/repos/${plan.repository}/releases`, {
    method: "POST",
    body: JSON.stringify({
      tag_name: plan.tag,
      target_commitish: plan.sha,
      name: plan.tag,
      draft: true,
      prerelease: plan.prerelease,
      generate_release_notes: true,
    }),
  });
  for (const name of readdirSync(join(root, "release")).sort()) {
    await github(`${release.upload_url.split("{")[0]}?name=${encodeURIComponent(name)}`, {
      method: "POST",
      headers: { "content-type": "application/octet-stream" },
      body: readFileSync(join(root, "release", name)),
    });
  }
  const published = await github(`/repos/${plan.repository}/releases/${release.id}`, {
    method: "PATCH",
    body: JSON.stringify({
      draft: false,
      prerelease: plan.prerelease,
      make_latest: plan.prerelease ? "false" : "true",
    }),
  });
  write("published", {
    component: "dashboard",
    repository: plan.repository,
    sha: plan.sha,
    tag: plan.tag,
    assets: published.assets.map((asset) => asset.browser_download_url),
  });
} else if (command === "dispatch") {
  const token = process.env.CONTROL_PLANE_DISPATCH_TOKEN;
  if (!token) {
    console.log(
      "::notice::CONTROL_PLANE_DISPATCH_TOKEN is empty; skipping component-released dispatch to control-plane.",
    );
  } else {
    await githubApi(token)("/repos/tumpel/control-plane/dispatches", {
      method: "POST",
      body: JSON.stringify({ event_type: "component-released", client_payload: read("published") }),
    });
  }
} else throw new Error("Unknown release command. Run release:prepare, release:publish or release:dispatch.");
