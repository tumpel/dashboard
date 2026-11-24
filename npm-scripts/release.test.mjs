import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { appendFileSync, cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { runRelease } from "./release.mjs";
import { releaseDecision, releaseSource, requireReleaseSha } from "./release-plan.mjs";

test("missing and unsuccessful checks stop a tag release", () => {
  const source = { sha: "abc123", ref: "refs/tags/v0.10.0", repository: "tumpel/dashboard" };
  assert.throws(() => releaseDecision({ ...source, conclusion: null }), /Checks are incomplete for abc123/);
  assert.throws(() => releaseDecision({ ...source, conclusion: "failure" }), /Checks failed for abc123/);
  assert.throws(() => releaseDecision({ ...source, conclusion: "cancelled" }), /Checks failed for abc123/);
});

test("a version tag must match both packages", () => {
  assert.throws(
    () =>
      releaseDecision({
        sha: "abc123",
        ref: "refs/tags/v0.10.0",
        repository: "tumpel/dashboard",
        conclusion: "success",
        versions: ["0.10.0", "0.9.0"],
      }),
    /The package versions do not match v0\.10\.0/,
  );
});

test("a main plan needs no conclusion and numbers the candidate from the stable tag", () => {
  assert.deepEqual(
    releaseDecision({
      sha: "abc123",
      ref: "refs/heads/main",
      repository: "tumpel/dashboard",
      stable: "0.10.0",
      next: "0.10.1",
      commitCount: 4,
      shippedChanged: true,
    }),
    {
      sha: "abc123",
      tag: "v0.10.1-rc.4",
      version: "0.10.1-rc.4",
      prerelease: true,
      repository: "tumpel/dashboard",
    },
  );
});

test("a docs-only follow-up needs no candidate", () => {
  assert.equal(
    releaseDecision({
      sha: "abc123",
      ref: "refs/heads/main",
      repository: "tumpel/dashboard",
      stable: "0.10.0",
      next: "0.10.1",
      commitCount: 2,
      shippedChanged: false,
    }),
    null,
  );
});

test("the release source reads the version and shipped diff from tagged history", (t) => {
  const root = mkdtempSync(join(tmpdir(), "dashboard-release-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const git = (...args) => execFileSync("git", args, { cwd: root, encoding: "utf8" }).trim();
  git("init", "-q", "-b", "main");
  git("config", "user.name", "Dashboard Release Test");
  git("config", "user.email", "release-test@example.com");
  git("commit", "--allow-empty", "-qm", "feat: start dashboard");
  git("tag", "v0.10.0");

  mkdirSync(join(root, "packages/dashboard/src"), { recursive: true });
  writeFileSync(join(root, "packages/dashboard/src/view.ts"), 'export const label = "Dashboard";\n');
  git("add", "packages");
  git("commit", "-qm", "fix: show the dashboard label");
  const sha = git("rev-parse", "HEAD");
  const context = { root, ref: "refs/heads/main", repository: "tumpel/dashboard" };
  const shipped = releaseSource({ ...context, sha });
  assert.equal(shipped.next, "0.10.1");
  assert.equal(shipped.commitCount, 1);
  assert.equal(shipped.shippedChanged, true);

  git("tag", "v0.10.1-rc.1");
  writeFileSync(join(root, "README.md"), "Release notes.\n");
  git("add", "README.md");
  git("commit", "-qm", "docs: describe releases");
  assert.throws(() => requireReleaseSha(root, sha), /checkout does not match the release source SHA/);
  const docs = releaseSource({ ...context, sha: git("rev-parse", "HEAD") });
  assert.equal(docs.stable, "0.10.0");
  assert.equal(docs.commitCount, 2);
  assert.equal(docs.shippedChanged, false);
});

const releaseScript = new URL("./release.mjs", import.meta.url);

const releaseRepo = (t) => {
  const temp = mkdtempSync(join(tmpdir(), "dashboard-release-"));
  t.after(() => rmSync(temp, { recursive: true, force: true }));
  const root = join(temp, "work");
  const remote = join(temp, "remote.git");
  mkdirSync(root);
  const git = (...args) => execFileSync("git", args, { cwd: root, encoding: "utf8", timeout: 30_000 }).trim();
  git("init", "-q", "--bare", remote);
  git("init", "-q", "-b", "main");
  git("config", "user.name", "Dashboard Release Test");
  git("config", "user.email", "release-test@example.com");
  git("remote", "add", "origin", remote);

  for (const path of ["package.json", "package-lock.json", "packages", "npm-scripts", "node_modules"]) {
    cpSync(fileURLToPath(new URL(`../${path}`, import.meta.url)), join(root, path), {
      recursive: true,
      verbatimSymlinks: true,
    });
  }
  git("add", "package.json", "package-lock.json", "packages/dashboard/package.json", "packages/pages/package.json");
  git("commit", "-qm", "feat: start dashboard");
  const env = {
    ...process.env,
    GITHUB_EVENT_PATH: join(temp, "event.json"),
    GITHUB_OUTPUT: join(temp, "output"),
    GITHUB_REPOSITORY: "tumpel/dashboard",
    CONTROL_PLANE_DISPATCH_TOKEN: "dispatch-test",
  };
  const state = join(root, ".tmp", "release");
  const read = (name) => JSON.parse(readFileSync(join(state, `${name}.json`), "utf8"));
  const event = (value) => writeFileSync(env.GITHUB_EVENT_PATH, JSON.stringify(value));

  const created = [];
  const dispatches = [];
  const gh = (args, options) => {
    const [group, action, tag, ...rest] = args;
    if (group === "release" && action === "create") {
      const sha = args[args.indexOf("--target") + 1];
      assert.equal(sha, git("rev-parse", "HEAD"));
      if (!git("tag", "--list", tag)) {
        git("tag", tag, sha);
        git("push", "-q", "origin", `refs/tags/${tag}`);
      }
      const assets = rest.slice(0, rest.indexOf("--repo")).map((path) => {
        assert.ok(statSync(path).size > 0);
        const name = basename(path);
        return { name, browser_download_url: `https://github.com/tumpel/dashboard/releases/download/${tag}/${name}` };
      });
      created.push({
        tag_name: tag,
        draft: false,
        published_at: "2026-11-24T12:00:00Z",
        prerelease: args.includes("--prerelease"),
        assets,
      });
      return "";
    }
    if (action === "/repos/tumpel/dashboard/releases") {
      assert.deepEqual(args, ["api", action, "--paginate", "--slurp"]);
      return JSON.stringify([created]);
    }
    if (action.startsWith("/repos/tumpel/dashboard/releases/tags/"))
      return JSON.stringify(created.find((release) => action.endsWith(`/${release.tag_name}`)));
    assert.deepEqual(args, ["api", "--method", "POST", "/repos/tumpel/control-plane/dispatches", "--input", "-"]);
    assert.equal(options.env.GH_TOKEN, env.CONTROL_PLANE_DISPATCH_TOKEN);
    dispatches.push(JSON.parse(options.input));
    return "";
  };
  return { root, git, env, state, read, event, created, dispatches, gh };
};

test("a release rerun reaches dispatch with the same payload after a rejected post", (t) => {
  const { root, git, env, state, read, event, created, dispatches, gh } = releaseRepo(t);
  git("tag", "v0.9.0");
  appendFileSync(join(root, "package.json"), "\n");
  git("add", "package.json");
  git("commit", "-qm", "fix: ship a dashboard change");
  git("push", "-q", "--tags", "origin", "main");
  const sha = git("rev-parse", "HEAD");
  event({ workflow_run: { head_sha: sha } });
  const context = { root, env, gh };

  runRelease("prepare", context);
  const tag = "v0.9.1-rc.1";
  assert.equal(read("plan").tag, tag);
  git("tag", tag, "HEAD^");
  git("push", "-q", "origin", `refs/tags/${tag}`);
  assert.throws(() => runRelease("publish", context), /does not point to the checked SHA/);
  git("push", "-q", "origin", `:refs/tags/${tag}`);
  git("tag", "-f", tag, sha);
  git("push", "-q", "origin", `refs/tags/${tag}`);
  runRelease("prepare", context);
  assert.equal(read("plan").tag, tag);
  runRelease("publish", context);
  const published = read("published");
  assert.equal(published.sha, sha);
  assert.equal(published.tag, "v0.9.1-rc.1");
  assert.deepEqual(
    published.assets.map((url) => basename(url)),
    [
      "dashboard-0.9.1-rc.1.tgz",
      "dashboard-0.9.1-rc.1.tgz.sha256",
      "pages-0.9.1-rc.1.tgz",
      "pages-0.9.1-rc.1.tgz.sha256",
    ],
  );
  const rejected = spawnSync(
    process.execPath,
    [
      "--input-type=module",
      "--eval",
      `import { runRelease } from ${JSON.stringify(releaseScript.href)};
       runRelease("dispatch", { gh: (_args, { input }) => {
         process.stdout.write(input);
         throw new Error("GitHub rejected the dispatch");
       } });`,
    ],
    { cwd: root, env, encoding: "utf8", timeout: 30_000 },
  );
  assert.equal(rejected.status, 1);
  assert.match(rejected.stderr, /GitHub rejected the dispatch/);

  git("restore", ".");
  rmSync(state, { recursive: true });
  rmSync(join(root, "release"), { recursive: true });
  runRelease("prepare", context);
  assert.equal(read("plan").tag, published.tag);
  runRelease("publish", context);
  runRelease("dispatch", context);
  assert.deepEqual(read("published"), published);
  assert.deepEqual(dispatches, [JSON.parse(rejected.stdout)]);
  assert.deepEqual(dispatches, [{ event_type: "component-released", client_payload: published }]);
  assert.equal(created.length, 1);
  assert.throws(() => statSync(join(root, "release")), { code: "ENOENT" });
});

test("a first manual version tag with passing checks publishes both packages", (t) => {
  const { root, git, env, read, event, created, gh } = releaseRepo(t);
  const { version } = JSON.parse(readFileSync(join(root, "packages", "dashboard", "package.json"), "utf8"));
  const tag = `v${version}`;
  git("tag", "-am", "First manual release", tag);
  git("push", "-q", "--tags", "origin", "main");
  env.GITHUB_REF = `refs/tags/${tag}`;
  env.GITHUB_SHA = git("rev-parse", `${tag}^{}`);
  event({});
  const runs = `/repos/tumpel/dashboard/actions/workflows/checks.yml/runs?head_sha=${env.GITHUB_SHA}&event=push&branch=main&per_page=1`;
  let checks = [];
  const context = {
    root,
    env,
    gh: (args) => {
      if (args[1] !== runs) return gh(args);
      assert.deepEqual(args, ["api", runs]);
      return JSON.stringify({ workflow_runs: checks });
    },
  };
  assert.throws(() => runRelease("prepare", context), /Checks are incomplete/);
  checks = [{ status: "completed", conclusion: "success" }];
  runRelease("prepare", context);
  runRelease("publish", context);
  assert.equal(created.length, 1);
  assert.equal(created[0].prerelease, false);
  assert.equal(read("published").tag, tag);
  assert.equal(read("published").sha, env.GITHUB_SHA);
  assert.equal(read("published").assets.length, 4);
});

test("an empty dispatch token exits successfully with a notice", (t) => {
  const root = mkdtempSync(join(tmpdir(), "dashboard-dispatch-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const output = execFileSync(process.execPath, [fileURLToPath(releaseScript), "dispatch"], {
    cwd: root,
    env: { ...process.env, CONTROL_PLANE_DISPATCH_TOKEN: "", GITHUB_TOKEN: "unused-test-token" },
    encoding: "utf8",
    timeout: 30_000,
  });
  assert.match(output, /^::notice::.*CONTROL_PLANE_DISPATCH_TOKEN is empty/);
});
