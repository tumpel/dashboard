import assert from "node:assert/strict";
import { test } from "node:test";
import { ApiFailure, type GitHubRepository, type Problem } from "../src/api/port.ts";
import { groupMatches, listingStateOf, pickerListOf, typedPathOf } from "../src/repository-picker.ts";

const repository = (owner: string, name: string): GitHubRepository => ({
  owner,
  name,
  defaultBranch: "main",
  private: false,
  htmlUrl: `https://github.com/${owner}/${name}`,
});

const FIVE: GitHubRepository[] = [
  repository("owner-one", "tool-name"),
  repository("org-two", "web-name"),
  repository("owner-one", "api-gateway"),
  repository("org-two", "api-name"),
  repository("owner-one", "service-name"),
];

const refusal = (status: number, code: Problem["code"]): ApiFailure =>
  new ApiFailure({
    kind: "Problem",
    status,
    problem: { code, title: `${code} title`, detail: `${code} detail`, fix: `${code} fix` },
  });

const summary = (text: string) =>
  groupMatches(FIVE, text).map((group) => [
    group.owner,
    group.matches.map((match) => `${match.repository.name}@${match.start}-${match.end}`),
  ]);

test("groups owners and names A to Z", () => {
  assert.deepEqual(summary(""), [
    ["org-two", ["api-name@0-0", "web-name@0-0"]],
    ["owner-one", ["api-gateway@0-0", "service-name@0-0", "tool-name@0-0"]],
  ]);
});

test("keeps only matching rows and their groups, with the matched range", () => {
  assert.deepEqual(summary("API"), [
    ["org-two", ["api-name@8-11"]],
    ["owner-one", ["api-gateway@10-13"]],
  ]);
});

test("a pasted GitHub URL matches as owner/name", () => {
  for (const text of [
    "https://github.com/owner-one/tool-name",
    " https://github.com/owner-one/tool-name.git ",
    "github.com/owner-one/tool-name/",
  ]) {
    assert.deepEqual(summary(text), [["owner-one", ["tool-name@0-19"]]], text);
  }
});

test("typed owner/name reads a repository path or nothing", () => {
  assert.deepEqual(typedPathOf("other-org/thing"), { owner: "other-org", name: "thing" });
  assert.deepEqual(typedPathOf("https://github.com/Other-Org/thing.git"), { owner: "Other-Org", name: "thing" });
  assert.equal(typedPathOf("thing"), null);
  assert.equal(typedPathOf("a/b/c"), null);
  assert.equal(typedPathOf("-bad/thing"), null);
  assert.equal(typedPathOf("other-org/"), null);
});

test("the Use row joins only where the operation takes any repository and the list lacks it", () => {
  const kinds = (text: string, acceptsTyped: boolean) =>
    pickerListOf(FIVE, text, acceptsTyped).options.map((option) => option.kind);
  assert.deepEqual(kinds("other-org/thing", true), ["Use", "Connect"]);
  assert.deepEqual(kinds("other-org/thing", false), ["Connect"]);
  assert.deepEqual(kinds("owner-one/tool-name", true), ["Repository", "Connect"]);
  assert.deepEqual(kinds("OWNER-ONE/TOOL-NAME", true), ["Repository", "Connect"]);
  assert.deepEqual(kinds("owner-one/tool", true), ["Repository", "Use", "Connect"]);
  const none = pickerListOf(FIVE, "other-org/thing", true);
  assert.equal(none.options[none.firstActive]?.kind, "Connect");
});

test("each refusal lands in its own state, and 401 never reads as a list", () => {
  const stateOf = (error: unknown) => listingStateOf({ status: "error", error }).state;
  assert.equal(listingStateOf({ status: "pending" }).state, "Loading");
  assert.equal(listingStateOf({ status: "success", data: [] }).state, "Listed");
  assert.equal(stateOf(refusal(409, "GitHubAppMissing")), "NotConfigured");
  assert.equal(stateOf(refusal(409, "GitHubNotConnected")), "NotConnected");
  assert.equal(stateOf(refusal(401, "SignedOut")), "SignedOut");
  assert.equal(stateOf(refusal(403, "Forbidden")), "ListingRefused");
  assert.equal(stateOf(new ApiFailure({ kind: "Unreachable", detail: "no answer" })), "ListingRefused");
});
