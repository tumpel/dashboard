import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { planCandidate } from "./release-plan.mjs";

const git = (cwd, ...args) =>
  execFileSync("git", ["-c", "user.name=Test", "-c", "user.email=test@example.com", ...args], { cwd, timeout: 30_000 });

const tempDir = (t) => {
  const root = mkdtempSync(join(tmpdir(), "dashboard-release-"));
  t.after(() => rmSync(root, { recursive: true }));
  return root;
};

test("a shipped commit plans a candidate", (t) => {
  const root = tempDir(t);
  git(root, "init", "-q");
  git(root, "commit", "--allow-empty", "-qm", "feat: start dashboard");
  git(root, "tag", "v0.10.0");
  writeFileSync(join(root, "build-input.txt"), "dashboard\n");
  git(root, "add", ".");
  git(root, "commit", "-qm", "fix: ship a dashboard change");
  assert.deepEqual(planCandidate(root), { tag: "v0.10.1-rc.1", version: "0.10.1-rc.1" });
});

test("a docs-only commit plans no candidate", (t) => {
  const root = tempDir(t);
  git(root, "init", "-q");
  git(root, "commit", "--allow-empty", "-qm", "feat: start dashboard");
  git(root, "tag", "v0.10.0");
  writeFileSync(join(root, "README.md"), "docs\n");
  mkdirSync(join(root, "doc"));
  mkdirSync(join(root, "docs"));
  writeFileSync(join(root, "doc/diagram.png"), "");
  writeFileSync(join(root, "docs/diagram.png"), "");
  git(root, "add", ".");
  git(root, "commit", "-qm", "fix: correct the docs");
  assert.equal(planCandidate(root), null);
});

test("a test-only commit plans no candidate", (t) => {
  const root = tempDir(t);
  git(root, "init", "-q");
  git(root, "commit", "--allow-empty", "-qm", "feat: start dashboard");
  git(root, "tag", "v0.10.0");
  mkdirSync(join(root, "packages/dashboard/test"), { recursive: true });
  writeFileSync(join(root, "packages/dashboard/test/fixture.ts"), "export {};\n");
  git(root, "add", ".");
  git(root, "commit", "-qm", "fix: correct the test");
  assert.equal(planCandidate(root), null);
});
