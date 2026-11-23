import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { after, test } from "node:test";
import { fileURLToPath } from "node:url";
import { dispatchRelease } from "./release-dispatch.mjs";
import { githubApi } from "./release-github.mjs";
import { planRelease, stampRelease } from "./release-plan.mjs";
import { publishRelease } from "./release-publish.mjs";

const repository = "tumpel/dashboard";
const source = fileURLToPath(new URL("..", import.meta.url));
mkdirSync(join(source, ".tmp"), { recursive: true });
const scratch = mkdtempSync(join(source, ".tmp", "release-test-"));
after(() => rmSync(scratch, { recursive: true, force: true }));

const fixture = (name) => {
  const root = join(scratch, name);
  const write = (path, value) => {
    const file = join(root, path);
    mkdirSync(join(file, ".."), { recursive: true });
    writeFileSync(file, typeof value === "string" ? value : `${JSON.stringify(value, null, 2)}\n`);
  };
  write("package.json", {
    private: true,
    type: "module",
    workspaces: ["packages/dashboard", "packages/pages"],
    scripts: { build: "node build.mjs" },
  });
  write(".gitignore", "node_modules\nrelease/\n.tmp/\npackages/*/dist/\n");
  write("packages/dashboard/package.json", {
    name: "@tumpel/dashboard",
    version: "0.9.0",
    files: ["dist"],
    devDependencies: { "@tumpel/pages": "*" },
  });
  write("packages/pages/package.json", {
    name: "@tumpel/pages",
    version: "0.9.0",
    type: "module",
    files: ["dist"],
    exports: {
      ".": { types: "./dist/index.d.ts", default: "./dist/index.js" },
      "./tokens.css": "./dist/tokens.css",
      "./shell.css": "./dist/shell.css",
    },
  });
  write("packages/dashboard/src/index.html", "<h1>Dashboard A</h1>");
  write(
    "build.mjs",
    `import {mkdirSync,readFileSync,writeFileSync} from "node:fs";
mkdirSync("packages/dashboard/dist/fonts",{recursive:true});
writeFileSync("packages/dashboard/dist/index.html",readFileSync("packages/dashboard/src/index.html"));
writeFileSync("packages/dashboard/dist/fonts/inter-latin-wght-normal.woff2","font");
mkdirSync("packages/pages/dist",{recursive:true});
writeFileSync("packages/pages/dist/index.js",'export const linksFor = ({api}) => ({cli: api + "/v1/releases/cli/Amd64"}); export const shellDocument = () => "shell";');
writeFileSync("packages/pages/dist/index.d.ts",'export declare const linksFor: (origins: {api: string; dashboard: string}) => {cli: string}; export declare const shellDocument: () => string;');
for (const name of ["tokens","shell"]) writeFileSync("packages/pages/dist/" + name + ".css","");
`,
  );
  execFileSync("npm", ["install", "--package-lock-only", "--ignore-scripts", "--no-audit", "--no-fund"], {
    cwd: root,
    stdio: "pipe",
  });
  const git = (...args) => execFileSync("git", args, { cwd: root, encoding: "utf8" }).trim();
  git("init", "-b", "main");
  git("config", "user.name", "Release test");
  git("config", "user.email", "release@example.test");
  git("add", ".");
  git("commit", "-m", "feat: initial dashboard");
  git("tag", "v0.9.0");
  git("switch", "-c", "fix/dashboard");
  write("packages/dashboard/src/index.html", "<h1>Dashboard B</h1>");
  git("add", ".");
  git("commit", "-m", "fix(dashboard): show the new dashboard");
  git("switch", "main");
  git("merge", "--squash", "fix/dashboard");
  git("commit", "-m", "fix(dashboard): show the new dashboard (#1)");
  return { root, git, sha: git("rev-parse", "HEAD") };
};

const fakeGitHub = (runs) => {
  const writes = [];
  const assets = [];
  const transport = async (url, options) => {
    const method = options.method ?? "GET";
    if (method === "GET" && url.pathname.endsWith("/checks.yml/runs"))
      return Response.json({ workflow_runs: runs(url.searchParams.get("head_sha")) });
    writes.push({ path: url.pathname, method, body: options.body });
    if (url.pathname.endsWith("/dispatches")) return new Response(null, { status: 204 });
    if (url.pathname === "/uploads") {
      const name = url.searchParams.get("name");
      assets.push({
        name,
        browser_download_url: `https://github.com/${repository}/releases/download/v0.9.1-rc.1/${name}`,
      });
      return Response.json(assets.at(-1));
    }
    if (method === "POST" && url.pathname.endsWith("/releases"))
      return Response.json({ id: 1, upload_url: "https://uploads.github.com/uploads{?name,label}" });
    if (method === "PATCH" && url.pathname.endsWith("/releases/1")) return Response.json({ assets });
    throw new Error(`Unexpected GitHub call ${method} ${url}`);
  };
  return { github: githubApi("publication-test", transport), transport, writes, assets };
};

test("a merged fix plans, stamps, packs, imports and publishes both RCs before dispatch", async () => {
  const { root, sha, git } = fixture("merged");
  const api = fakeGitHub((head_sha) => [
    { id: 1, head_sha, head_branch: "main", event: "push", status: "completed", conclusion: "success" },
  ]);
  const plan = await planRelease({ root, sha, ref: "refs/heads/main", repository, github: api.github });
  assert.equal(plan.version, "0.9.1-rc.1");
  stampRelease(root, plan);
  const lock = JSON.parse(readFileSync(join(root, "package-lock.json")));
  for (const path of ["packages/dashboard", "packages/pages"]) {
    assert.equal(JSON.parse(readFileSync(join(root, path, "package.json"))).version, plan.version);
    assert.equal(lock.packages[path].version, plan.version);
  }
  execFileSync("npm", ["ci", "--ignore-scripts", "--no-audit", "--no-fund"], {
    cwd: root,
    stdio: "pipe",
    timeout: 120_000,
  });
  symlinkSync(join(source, "node_modules", ".bin"), join(root, "node_modules", ".bin"), "dir");
  const released = await publishRelease({ root, plan, github: api.github });
  for (const component of ["dashboard", "pages"]) {
    const file = `${component}-${plan.version}.tgz`;
    const bytes = readFileSync(join(root, "release", file));
    assert.equal(
      readFileSync(join(root, "release", `${file}.sha256`), "utf8"),
      `${createHash("sha256").update(bytes).digest("hex")}  ${file}\n`,
    );
    const packed = execFileSync("tar", ["-xOf", join(root, "release", file), "package/package.json"], {
      encoding: "utf8",
    });
    assert.equal(JSON.parse(packed).version, plan.version);
  }
  assert.match(
    execFileSync("tar", ["-xOf", join(root, "release", `dashboard-${plan.version}.tgz`), "package/dist/index.html"], {
      encoding: "utf8",
    }),
    /Dashboard B/,
  );
  const creation = JSON.parse(api.writes[0].body);
  assert.equal(creation.target_commitish, sha);
  assert.equal(creation.prerelease, true);
  assert.equal(creation.draft, true);
  assert.deepEqual(JSON.parse(api.writes.at(-1).body), { draft: false, prerelease: true, make_latest: "false" });
  await dispatchRelease(released, "dispatch-test", api.transport);
  const dispatch = JSON.parse(api.writes.at(-1).body);
  assert.deepEqual(dispatch, {
    event_type: "component-released",
    client_payload: {
      component: "dashboard",
      repository,
      sha,
      tag: plan.tag,
      assets: api.assets.map((asset) => asset.browser_download_url),
    },
  });
  assert.equal(dispatch.client_payload.assets.length, 4);
  const notices = [];
  const before = api.writes.length;
  await dispatchRelease(released, "", api.transport, (notice) => notices.push(notice));
  assert.equal(api.writes.length, before);
  assert.match(notices[0], /CONTROL_PLANE_DISPATCH_TOKEN is empty/);
  git("tag", plan.tag);
  writeFileSync(join(root, "README.md"), "Dashboard documentation\n");
  git("add", "README.md");
  git("commit", "-m", "docs: describe the dashboard");
  assert.equal(
    await planRelease({ root, sha: git("rev-parse", "HEAD"), ref: "refs/heads/main", repository, github: api.github }),
    null,
  );
});

test("failed exact-SHA checks cannot use a historical passing run or publish anything", async () => {
  const { root, sha } = fixture("failed");
  const api = fakeGitHub(() => [
    { id: 2, head_sha: sha, head_branch: "main", event: "push", status: "completed", conclusion: "failure" },
    { id: 1, head_sha: "a".repeat(40), head_branch: "main", event: "push", status: "completed", conclusion: "success" },
  ]);
  await assert.rejects(
    planRelease({ root, sha, ref: "refs/heads/main", repository, github: api.github }),
    /Checks failed/,
  );
  assert.deepEqual(api.writes, []);
  assert.equal(existsSync(join(root, "release")), false);
  assert.equal(JSON.parse(readFileSync(join(root, "packages/pages/package.json"))).version, "0.9.0");
});

test("pending readiness observes ten times with nine exponential sleeps", async () => {
  const { root, sha } = fixture("pending");
  const sleeps = [];
  let observations = 0;
  let now = 0;
  const clock = {
    now: () => now,
    sleep: async (delay) => {
      sleeps.push(delay);
      now += delay;
    },
  };
  const api = fakeGitHub((head_sha) => {
    observations += 1;
    return [{ id: 1, head_sha, head_branch: "main", event: "push", status: "in_progress", conclusion: null }];
  });
  await assert.rejects(
    planRelease({ root, sha, ref: "refs/heads/main", repository, github: api.github, clock }),
    /10 observations/,
  );
  assert.equal(observations, 10);
  assert.deepEqual(sleeps, [1000, 2000, 4000, 8000, 16000, 32000, 64000, 128000, 256000]);
  assert.equal(clock.now(), 511000);
  assert.deepEqual(api.writes, []);
});

test("an authentication failure stops readiness immediately", async () => {
  const { root, sha } = fixture("unauthorised");
  let sleeps = 0;
  const github = githubApi("invalid-test", async () => new Response(null, { status: 401 }));
  await assert.rejects(
    planRelease({
      root,
      sha,
      ref: "refs/heads/main",
      repository,
      github,
      clock: {
        sleep: async () => {
          sleeps += 1;
        },
      },
    }),
    /401/,
  );
  assert.equal(sleeps, 0);
});

test("tag releases keep their manifest version and check the tagged SHA", async () => {
  const { root, git } = fixture("tagged");
  git("checkout", "v0.9.0");
  const sha = git("rev-parse", "HEAD");
  const api = fakeGitHub((head_sha) => [
    { id: 1, head_sha, head_branch: "main", event: "push", status: "completed", conclusion: "success" },
  ]);
  const plan = await planRelease({ root, sha, ref: "refs/tags/v0.9.0", repository, github: api.github });
  assert.equal(plan.version, "0.9.0");
  assert.equal(plan.prerelease, false);
});
