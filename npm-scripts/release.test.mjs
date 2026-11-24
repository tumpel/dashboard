import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { after, before, test } from "node:test";
import { candidatePlan, releaseSource } from "./release-plan.mjs";

const root = mkdtempSync(join(tmpdir(), "dashboard-release-"));
let shipped;
let tagged;
let docsOnly;

after(() => rmSync(root, { recursive: true, force: true }));

before(() => {
  const git = (...args) => execFileSync("git", args, { cwd: root, timeout: 30_000 });
  git("init", "-q");
  git("config", "user.name", "Dashboard Release Test");
  git("config", "user.email", "release-test@example.com");
  git("commit", "--allow-empty", "-qm", "feat: start dashboard");
  git("tag", "v0.10.0");

  writeFileSync(join(root, "build-input.txt"), "dashboard\n");
  git("add", ".");
  git("commit", "-qm", "fix: ship a dashboard change");
  shipped = releaseSource(root);
  git("tag", "v0.10.1-rc.1");
  tagged = releaseSource(root);

  for (const file of [
    "README.md",
    "doc/notes.txt",
    "rules/notes.txt",
    ".github/notes.txt",
    "packages/dashboard/test/fixture.ts",
  ]) {
    const path = join(root, file);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, "notes\n");
  }
  git("add", ".");
  git("commit", "-qm", "docs: describe the dashboard");
  docsOnly = releaseSource(root);
});

test("a shipped commit plans a candidate", () => {
  assert.deepEqual(candidatePlan(shipped), { tag: "v0.10.1-rc.1", version: "0.10.1-rc.1" });
});

test("a docs-only commit after a release plans no candidate", () => {
  assert.equal(candidatePlan(docsOnly), null);
});

test("a candidate tag on HEAD keeps the same plan", () => {
  assert.deepEqual(candidatePlan(tagged), candidatePlan(shipped));
});
