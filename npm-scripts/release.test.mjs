import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

test("a checked shipped commit publishes and dispatches its own candidate", (t) => {
  const cwd = mkdtempSync(join(tmpdir(), "dashboard-release-"));
  t.after(() => rmSync(cwd, { recursive: true, force: true }));
  const git = (...args) => execFileSync("git", args, { cwd, encoding: "utf8" }).trim();
  const put = (path, value) => writeFileSync(join(cwd, path), value);
  const read = (path) => JSON.parse(readFileSync(join(cwd, path), "utf8"));
  const bins = join(cwd, "bin");
  mkdirSync(bins);
  const assets = [
    "dashboard-0.9.1-rc.1.tgz",
    "dashboard-0.9.1-rc.1.tgz.sha256",
    "pages-0.9.1-rc.1.tgz",
    "pages-0.9.1-rc.1.tgz.sha256",
  ];
  mkdirSync(join(cwd, "release"));
  for (const asset of assets) put(`release/${asset}`, "");
  writeFileSync(join(bins, "npm"), '#!/bin/sh\nprintf "%s\\n" "$*" >> npm.log\n', { mode: 0o755 });
  writeFileSync(
    join(bins, "gh"),
    `#!${process.execPath}
const fs = require("node:fs");
const args = process.argv.slice(2);
fs.appendFileSync("gh.log", JSON.stringify(args) + "\\n");
if (args[1] === "create" && !args.includes("--draft")) {
  const git = require("node:child_process");
  if (git.spawnSync("git", ["show-ref", "--verify", "--quiet", "refs/tags/" + args[2]]).status !== 0) {
    git.execFileSync("git", ["tag", args[2], args[args.indexOf("--target") + 1]]);
  }
}
if (args[1] === "view") console.log(JSON.stringify(${JSON.stringify(assets)}.map((name) => "https://example.com/" + name)));
if (args[0] === "api") fs.writeFileSync("dispatch.json", fs.readFileSync(0));
`,
    { mode: 0o755 },
  );
  const event = join(cwd, "event.json");
  const env = {
    ...process.env,
    PATH: `${bins}:${process.env.PATH}`,
    GITHUB_REPOSITORY: "tumpel/dashboard",
    GITHUB_EVENT_PATH: event,
    GITHUB_OUTPUT: join(cwd, "output"),
    GH_TOKEN: "",
    CONTROL_PLANE_DISPATCH_TOKEN: "",
  };
  const script = fileURLToPath(new URL("./release.mjs", import.meta.url));
  const run = (command, dispatchToken = "") =>
    spawnSync(process.execPath, [script, command], {
      cwd,
      env: { ...env, CONTROL_PLANE_DISPATCH_TOKEN: dispatchToken },
      encoding: "utf8",
      timeout: 30_000,
    });

  const skipped = run("dispatch");
  assert.equal(skipped.status, 0, skipped.stderr);
  assert.match(skipped.stdout, /::notice::.*skipping component-released/);
  assert.equal(existsSync(join(cwd, "gh.log")), false);

  git("init", "-q", "-b", "main");
  git("remote", "add", "origin", ".");
  git("config", "user.name", "Dashboard Release Test");
  git("config", "user.email", "release-test@example.com");
  for (const path of ["packages/dashboard", "packages/pages"]) {
    mkdirSync(join(cwd, path, "src"), { recursive: true });
    put(`${path}/package.json`, '{"version":"0.9.0"}\n');
  }
  put(
    "package-lock.json",
    '{"packages":{"packages/dashboard":{"version":"0.9.0"},"packages/pages":{"version":"0.9.0"}}}',
  );
  put("packages/dashboard/src/view.ts", "export const label = 'before';\n");
  git("add", "packages", "package-lock.json");
  git("commit", "-qm", "feat: start dashboard");
  git("tag", "v0.9.0");

  put("packages/dashboard/src/view.ts", "export const label = 'after';\n");
  git("commit", "-qam", "fix: update dashboard label");
  const sha = git("rev-parse", "HEAD");
  const checked = (headSha, conclusion) =>
    put(
      "event.json",
      JSON.stringify({
        workflow_run: {
          head_repository: { full_name: "tumpel/dashboard" },
          head_branch: "main",
          head_sha: headSha,
          event: "push",
          status: "completed",
          conclusion,
        },
      }),
    );

  checked(git("rev-parse", "HEAD^"), "success");
  const wrongChecks = run("prepare");
  assert.equal(wrongChecks.status, 1);
  assert.match(wrongChecks.stderr, /checkout does not match the release source SHA/);

  checked(sha, "failure");
  const failed = run("prepare");
  assert.equal(failed.status, 1);
  assert.match(failed.stderr, new RegExp(`Checks failed for ${sha}`));
  assert.equal(existsSync(join(cwd, ".tmp/release/plan.json")), false);

  checked(sha, "success");
  const prepared = run("prepare");
  assert.equal(prepared.status, 0, prepared.stderr);
  const tag = "v0.9.1-rc.1";
  assert.deepEqual(read(".tmp/release/plan.json"), {
    sha,
    tag,
    version: "0.9.1-rc.1",
    prerelease: true,
    repository: "tumpel/dashboard",
  });
  for (const path of ["packages/dashboard", "packages/pages"]) {
    assert.equal(read(`${path}/package.json`).version, "0.9.1-rc.1");
    assert.equal(read("package-lock.json").packages[path].version, "0.9.1-rc.1");
  }

  put("README.md", "Documentation only.\n");
  git("add", "README.md");
  git("commit", "-qm", "docs: describe the release");
  const docs = git("rev-parse", "HEAD");
  const wrongPublish = run("publish");
  assert.equal(wrongPublish.status, 1);
  assert.match(wrongPublish.stderr, /checkout does not match the release source SHA/);
  assert.equal(existsSync(join(cwd, "npm.log")), false);

  git("checkout", "-q", "--detach", sha);
  git("tag", tag, docs);
  const wrongTag = run("publish");
  assert.equal(wrongTag.status, 1);
  assert.match(wrongTag.stderr, /does not point to the checked SHA/);
  assert.equal(existsSync(join(cwd, "npm.log")), false);
  git("tag", "-d", tag);

  const published = run("publish");
  assert.equal(published.status, 0, published.stderr);
  const commands = readFileSync(join(cwd, "gh.log"), "utf8").trim().split("\n").map(JSON.parse);
  assert.deepEqual(commands[0], [
    "release",
    "create",
    tag,
    ...assets.map((asset) => join(cwd, "release", asset)),
    "--repo",
    "tumpel/dashboard",
    "--target",
    sha,
    "--title",
    tag,
    "--generate-notes",
    "--latest=false",
    "--prerelease",
  ]);
  assert.deepEqual(
    commands.map((args) => args.slice(0, 2)),
    [
      ["release", "create"],
      ["release", "view"],
    ],
  );

  const provenance = read(".tmp/release/published.json");
  put(".tmp/release/published.json", JSON.stringify({ ...provenance, sha: docs }));
  const wrongDispatch = run("dispatch", "fixture-dispatch");
  assert.equal(wrongDispatch.status, 1);
  assert.match(wrongDispatch.stderr, /published release does not match the checked release plan/);
  assert.equal(existsSync(join(cwd, "dispatch.json")), false);

  put(".tmp/release/published.json", JSON.stringify(provenance));
  const dispatched = run("dispatch", "fixture-dispatch");
  assert.equal(dispatched.status, 0, dispatched.stderr);
  assert.deepEqual(read("dispatch.json"), {
    event_type: "component-released",
    client_payload: {
      component: "dashboard",
      repository: "tumpel/dashboard",
      sha,
      tag,
      assets: assets.map((asset) => `https://example.com/${asset}`),
    },
  });

  git("checkout", "-q", "--detach", docs);
  checked(docs, "success");
  const docsOnly = run("prepare");
  assert.equal(docsOnly.status, 0, docsOnly.stderr);
  assert.equal(read(".tmp/release/plan.json"), null);
});
