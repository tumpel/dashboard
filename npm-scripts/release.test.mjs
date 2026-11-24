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

test("a completed workflow event supplies its exact source without another checks query", async () => {
  const plan = await planRelease({
    sha: "ready",
    ref: "refs/heads/main",
    repository: "tumpel/dashboard",
    tags: { stable: "v0.9.0", nearest: "v0.9.0" },
    next: "0.9.1",
    commits: ["ready"],
    shippedChanged: true,
    run: { head_sha: "ready", head_branch: "main", event: "push", status: "completed", conclusion: "success" },
    github: async () => assert.fail("the completed event owns its result"),
  });
  assert.equal(plan.sha, "ready");
  for (const change of [{ head_sha: "other" }, { conclusion: "failure" }, { status: "in_progress" }]) {
    await assert.rejects(
      planRelease({
        sha: "ready",
        ref: "refs/heads/main",
        repository: "tumpel/dashboard",
        run: {
          head_sha: "ready",
          head_branch: "main",
          event: "push",
          status: "completed",
          conclusion: "success",
          ...change,
        },
        github: async () => assert.fail("the event must not query checks"),
      }),
      /Checks/,
    );
  }
});

test("tag readiness reads checks once and fails fast on pending or missing runs", async () => {
  for (const runs of [
    [],
    [{ head_sha: "tagged", head_branch: "main", event: "push", status: "in_progress", conclusion: null }],
  ]) {
    let observations = 0;
    await assert.rejects(
      planRelease({
        sha: "tagged",
        ref: "refs/tags/v0.9.0",
        repository: "tumpel/dashboard",
        versions: ["0.9.0", "0.9.0"],
        github: async () => {
          observations++;
          return { workflow_runs: runs };
        },
      }),
      /Checks are incomplete/,
    );
    assert.equal(observations, 1);
  }
});

test("an API failure stops tag readiness immediately", async () => {
  let observations = 0;
  await assert.rejects(
    planRelease({
      sha: "tagged",
      ref: "refs/tags/v0.9.0",
      repository: "tumpel/dashboard",
      github: async () => {
        observations++;
        throw new Error("GitHub GET failed (401)");
      },
    }),
    /401/,
  );
  assert.equal(observations, 1);
});
