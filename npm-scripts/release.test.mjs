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

test("docs-only and test-only commits plan no candidate", (t) => {
  const root = tempDir(t);
  git(root, "init", "-q");
  git(root, "commit", "--allow-empty", "-qm", "start dashboard");
  git(root, "tag", "v0.10.0");
  writeFileSync(join(root, "README.md"), "docs\n");
  git(root, "add", "README.md");
  git(root, "commit", "-qm", "update docs");
  mkdirSync(join(root, "packages/dashboard/test"), { recursive: true });
  writeFileSync(join(root, "packages/dashboard/test/fixture.ts"), "export {};\n");
  git(root, "add", ".");
  git(root, "commit", "-qm", "update test");
  assert.equal(planCandidate(root), null);
});

test("shipped changes after an rc tag count commits from the stable tag", (t) => {
  const root = tempDir(t);
  git(root, "init", "-q");
  git(root, "commit", "--allow-empty", "-qm", "start dashboard");
  git(root, "tag", "v0.10.0");
  writeFileSync(join(root, "dashboard.js"), "export const version = 1;\n");
  git(root, "add", "dashboard.js");
  git(root, "commit", "-qm", "ship the first candidate");
  git(root, "tag", "v0.11.0-rc.1");
  writeFileSync(join(root, "README.md"), "docs\n");
  git(root, "add", "README.md");
  git(root, "commit", "-qm", "update docs");
  rmSync(join(root, "dashboard.js"));
  git(root, "commit", "-qam", "ship the next candidate");
  assert.deepEqual(planCandidate(root), { tag: "v0.11.0-rc.3", version: "0.11.0-rc.3" });
});

test("HEAD with its own rc tag plans the same tag", (t) => {
  const root = tempDir(t);
  git(root, "init", "-q");
  git(root, "commit", "--allow-empty", "-qm", "start dashboard");
  git(root, "tag", "v0.10.0");
  writeFileSync(join(root, "dashboard.js"), "export {};\n");
  git(root, "add", "dashboard.js");
  git(root, "commit", "-qm", "ship the first candidate");
  git(root, "tag", "v0.11.0-rc.1");
  assert.deepEqual(planCandidate(root), { tag: "v0.11.0-rc.1", version: "0.11.0-rc.1" });
});
