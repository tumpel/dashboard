import assert from "node:assert/strict";
import { test } from "node:test";
import { readApiOrigin } from "../src/api-origin.ts";

test("a bare https or http origin is the API origin", () => {
  assert.deepEqual(readApiOrigin("https://api.example.com"), { ok: true, origin: "https://api.example.com" });
  assert.deepEqual(readApiOrigin("http://localhost:8787"), { ok: true, origin: "http://localhost:8787" });
});

test("a missing tag fails with the tag to insert", () => {
  const read = readApiOrigin(null);
  assert.equal(read.ok, false);
  assert.match(
    read.ok ? "" : read.wording.fix,
    /<meta name="tumpel-api-origin" content="https:\/\/api\.example\.com">/,
  );
});

test("a value that is not a bare origin fails and names the origin to use", () => {
  for (const content of ["https://api.example.com/", "https://api.example.com/v1", "https://API.example.com"]) {
    const read = readApiOrigin(content);
    assert.equal(read.ok, false, content);
    assert.match(read.ok ? "" : read.wording.fix, /such as https:\/\/api\.example\.com\.$/, content);
  }
});

test("a value that is not an http origin fails", () => {
  assert.equal(readApiOrigin("").ok, false);
  assert.equal(readApiOrigin("api.example.com").ok, false);
  assert.equal(readApiOrigin("data:text/plain,x").ok, false);
});
