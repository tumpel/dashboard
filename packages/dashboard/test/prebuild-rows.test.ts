import assert from "node:assert/strict";
import { test } from "node:test";
import { sessionIdOfLogUrl } from "../src/prebuild-rows.ts";

test("a transcript url yields its session id", () => {
  assert.equal(sessionIdOfLogUrl("https://api.example.com/v1/sessions/ses_1/transcript"), "ses_1");
});

test("a provider run url yields nothing", () => {
  assert.equal(sessionIdOfLogUrl("https://github.com/acme/app/actions/runs/42"), undefined);
});
