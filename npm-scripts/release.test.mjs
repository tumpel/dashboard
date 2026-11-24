import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { releaseDecision, releaseSource } from "./release-plan.mjs";

test("missing and unsuccessful checks stop release planning", () => {
  const source = { sha: "abc123", ref: "refs/heads/main", repository: "tumpel/dashboard" };
  assert.throws(() => releaseDecision({ ...source, conclusion: null }), /Checks are incomplete for abc123/);
  assert.throws(() => releaseDecision({ ...source, conclusion: "failure" }), /Checks failed for abc123/);
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

test("a shipped change numbers the candidate from the stable tag", () => {
  assert.deepEqual(
    releaseDecision({
      sha: "abc123",
      ref: "refs/heads/main",
      repository: "tumpel/dashboard",
      conclusion: "success",
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
      conclusion: "success",
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
  assert.throws(() => releaseSource({ ...context, sha }), /checkout does not match the release source SHA/);
  const docs = releaseSource({ ...context, sha: git("rev-parse", "HEAD") });
  assert.equal(docs.stable, "0.10.0");
  assert.equal(docs.commitCount, 2);
  assert.equal(docs.shippedChanged, false);
});
