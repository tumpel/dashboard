import assert from "node:assert/strict";
import { test } from "node:test";
import { ApiFailure, refusedAlone } from "../src/api/port.ts";

test("a 403 fails a bulk archive as a whole, and a 409 refuses only its own session", () => {
  const problem = {
    code: "Forbidden",
    title: "Forbidden",
    detail: "you are not a member",
    fix: "Ask an owner",
  } as const;
  assert.equal(refusedAlone(new ApiFailure({ kind: "Problem", status: 403, problem })), false);
  assert.equal(
    refusedAlone(
      new ApiFailure({
        kind: "Problem",
        status: 409,
        problem: { code: "SessionNotStopped", title: "Session not stopped", detail: "it runs a turn", fix: "Wait" },
      }),
    ),
    true,
  );
});
