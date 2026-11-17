import assert from "node:assert/strict";
import { test } from "node:test";
import { commandText, templateRefOf } from "../src/prebuild-wizard.ts";

test("a template query value names the template id and its version", () => {
  assert.deepEqual(templateRefOf("npm@3"), { prebuildTemplateId: "npm", prebuildTemplateVersion: 3 });
  assert.deepEqual(templateRefOf("node-lts@12"), { prebuildTemplateId: "node-lts", prebuildTemplateVersion: 12 });
});

test("a template query value without a positive whole version is no template", () => {
  assert.equal(templateRefOf(null), null);
  assert.equal(templateRefOf("npm"), null);
  assert.equal(templateRefOf("npm@0"), null);
  assert.equal(templateRefOf("npm@1.5"), null);
  assert.equal(templateRefOf("Npm@1"), null);
});

test("a shell command shows as the text the file holds, other commands as their arguments", () => {
  assert.equal(commandText(["/bin/sh", "-c", "npm ci && npm run build"]), "npm ci && npm run build");
  assert.equal(commandText(["cargo", "fetch", "--locked"]), "cargo fetch --locked");
});
