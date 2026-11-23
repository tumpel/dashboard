import assert from "node:assert/strict";
import { test } from "node:test";
import { planRelease, releaseDecision } from "./release-plan.mjs";

test("a shipped fix publishes both packages at the next RC", () => {
  assert.deepEqual(
    releaseDecision({
      sha: "merged-fix",
      ref: "refs/heads/main",
      repository: "tumpel/dashboard",
      tags: { stable: "v0.9.0", nearest: "v0.9.0" },
      next: "0.9.1",
      commits: ["merged-fix"],
      shippedChanged: true,
      checks: [
        {
          id: 1,
          head_sha: "merged-fix",
          head_branch: "main",
          event: "push",
          status: "completed",
          conclusion: "success",
        },
      ],
    }),
    { sha: "merged-fix", tag: "v0.9.1-rc.1", version: "0.9.1-rc.1", prerelease: true, repository: "tumpel/dashboard" },
  );
});

test("documentation after a candidate does not repeat the release", () => {
  assert.equal(
    releaseDecision({
      sha: "docs",
      ref: "refs/heads/main",
      repository: "tumpel/dashboard",
      tags: { stable: "v0.9.0", nearest: "v0.9.1-rc.1" },
      next: "0.9.1",
      commits: ["docs", "merged-fix"],
      shippedChanged: false,
      checks: [
        { id: 2, head_sha: "docs", head_branch: "main", event: "push", status: "completed", conclusion: "success" },
      ],
    }),
    null,
  );
});

test("a shipped change without a conventional version bump does not release", () => {
  assert.equal(
    releaseDecision({
      sha: "chore",
      ref: "refs/heads/main",
      repository: "tumpel/dashboard",
      tags: { stable: "v0.9.0", nearest: "v0.9.0" },
      next: "0.9.0",
      commits: ["chore"],
      shippedChanged: true,
      checks: [
        { id: 3, head_sha: "chore", head_branch: "main", event: "push", status: "completed", conclusion: "success" },
      ],
    }),
    null,
  );
});

test("the newest exact-SHA main push must pass, regardless of historical successes", () => {
  assert.throws(
    () =>
      releaseDecision({
        sha: "failed-fix",
        ref: "refs/heads/main",
        repository: "tumpel/dashboard",
        tags: { stable: "v0.9.0", nearest: "v0.9.0" },
        next: "0.9.1",
        commits: ["failed-fix"],
        shippedChanged: true,
        checks: [
          {
            id: 3,
            head_sha: "failed-fix",
            head_branch: "main",
            event: "push",
            status: "completed",
            conclusion: "failure",
          },
          {
            id: 2,
            head_sha: "failed-fix",
            head_branch: "main",
            event: "push",
            status: "completed",
            conclusion: "success",
          },
          { id: 1, head_sha: "older", head_branch: "main", event: "push", status: "completed", conclusion: "success" },
        ],
      }),
    /Checks failed for failed-fix/,
  );
});

test("a passing PR or other branch cannot substitute for main push checks", () => {
  assert.equal(
    releaseDecision({
      sha: "fix",
      ref: "refs/heads/main",
      repository: "tumpel/dashboard",
      tags: { stable: "v0.9.0", nearest: "v0.9.0" },
      next: "0.9.1",
      commits: ["fix"],
      shippedChanged: true,
      checks: [
        {
          id: 2,
          head_sha: "fix",
          head_branch: "main",
          event: "pull_request",
          status: "completed",
          conclusion: "success",
        },
        { id: 1, head_sha: "fix", head_branch: "feature", event: "push", status: "completed", conclusion: "success" },
      ],
    }),
    undefined,
  );
});

test("a stable tag keeps the matching manifest version", () => {
  assert.deepEqual(
    releaseDecision({
      sha: "tagged",
      ref: "refs/tags/v0.9.0",
      repository: "tumpel/dashboard",
      versions: ["0.9.0", "0.9.0"],
      checks: [
        { id: 1, head_sha: "tagged", head_branch: "main", event: "push", status: "completed", conclusion: "success" },
      ],
    }),
    { sha: "tagged", tag: "v0.9.0", version: "0.9.0", prerelease: false, repository: "tumpel/dashboard" },
  );
});

test("a tag cannot publish mismatched package versions", () => {
  assert.throws(
    () =>
      releaseDecision({
        sha: "tagged",
        ref: "refs/tags/v0.9.0",
        repository: "tumpel/dashboard",
        versions: ["0.9.0", "0.9.1"],
        checks: [
          { id: 1, head_sha: "tagged", head_branch: "main", event: "push", status: "completed", conclusion: "success" },
        ],
      }),
    /package versions do not match/,
  );
});

test("pending readiness observes ten times with nine exponential sleeps", async () => {
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
  await assert.rejects(
    planRelease({
      sha: "pending",
      ref: "refs/heads/main",
      repository: "tumpel/dashboard",
      tags: { stable: "v0.9.0", nearest: "v0.9.0" },
      next: "0.9.1",
      commits: ["pending"],
      shippedChanged: true,
      github: async () => {
        observations += 1;
        return {
          workflow_runs: [
            { id: 1, head_sha: "pending", head_branch: "main", event: "push", status: "in_progress", conclusion: null },
          ],
        };
      },
      clock,
    }),
    /10 observations/,
  );
  assert.equal(observations, 10);
  assert.deepEqual(sleeps, [1000, 2000, 4000, 8000, 16000, 32000, 64000, 128000, 256000]);
  assert.equal(clock.now(), 511000);
});

test("readiness stops sleeping as soon as the exact source passes", async () => {
  const sleeps = [];
  let observations = 0;
  const plan = await planRelease({
    sha: "ready",
    ref: "refs/heads/main",
    repository: "tumpel/dashboard",
    tags: { stable: "v0.9.0", nearest: "v0.9.1-rc.1" },
    next: "0.10.0",
    commits: ["ready", "merged-fix"],
    shippedChanged: true,
    github: async () => {
      observations += 1;
      return {
        workflow_runs: [
          {
            id: 2,
            head_sha: "ready",
            head_branch: "main",
            event: "push",
            status: observations === 2 ? "completed" : "in_progress",
            conclusion: observations === 2 ? "success" : null,
          },
        ],
      };
    },
    clock: {
      sleep: async (delay) => {
        sleeps.push(delay);
      },
    },
  });
  assert.equal(plan.version, "0.10.0-rc.2");
  assert.equal(observations, 2);
  assert.deepEqual(sleeps, [1000]);
});

test("an API failure stops readiness immediately", async () => {
  let observations = 0;
  await assert.rejects(
    planRelease({
      sha: "unauthorised",
      ref: "refs/heads/main",
      repository: "tumpel/dashboard",
      tags: { stable: "v0.9.0", nearest: "v0.9.0" },
      next: "0.9.1",
      commits: ["unauthorised"],
      shippedChanged: true,
      github: async () => {
        observations += 1;
        throw new Error("GitHub GET failed (401)");
      },
      clock: { sleep: async () => assert.fail("an API failure must not sleep") },
    }),
    /401/,
  );
  assert.equal(observations, 1);
});
