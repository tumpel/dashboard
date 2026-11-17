#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const SCOPES = [["packages/dashboard/src/**.ts", "packages/dashboard/src/**.tsx"]];
const OUT_OF_SCOPE = [/\/stories\//, /\.test\.tsx?$/, /\.stories\.tsx$/];
const RUST_TESTS = "#[cfg(test)]";
const SHAPES = [
  ["a gap id", /\bG\d{1,3}\b/],
  ["a requirement id", /\b(?:N?FR|OR)-\d+/],
  ["a design document id", /\b(?:EDD|ADR|RFC)-?\s?\d+|\bRFC-/],
  ["a story or issue number", /\b[Ss]tory \d+|\bissue #\d+/],
  [
    "a caveat about what is not built yet",
    /\b[Uu]ntil\b.{0,80}?\b(?:is|are|can be|gets|get)\s+(?:built|kept|supported|shipped|implemented|added|finished)\b/,
  ],
];
const ALLOWED = [];

const files = SCOPES.flatMap((patterns) =>
  execFileSync("git", ["ls-files", "--", ...patterns], { cwd: ROOT, encoding: "utf8" }).split("\n"),
).filter((file) => file && !OUT_OF_SCOPE.some((pattern) => pattern.test(file)));

const shipped = (file, source) => {
  if (!file.endsWith(".rs")) return source;
  const at = source.indexOf(RUST_TESTS);
  return at === -1 ? source : source.slice(0, at);
};

const failures = files.flatMap((file) =>
  shipped(file, readFileSync(`${ROOT}${file}`, "utf8"))
    .split("\n")
    .flatMap((line, index) =>
      line.trimStart().startsWith("import ")
        ? []
        : SHAPES.filter(([, shape]) => shape.test(line))
            .filter(([name]) => !ALLOWED.some(([path, allowed]) => path === file && allowed === name))
            .map(([name]) => `${file}:${index + 1} names ${name}: ${line.trim().slice(0, 120)}`),
    ),
);

if (failures.length > 0) {
  console.error(
    `prose check failed: text a user reads says what happened and what to do next, in plain words.\n  ${failures.join("\n  ")}`,
  );
  console.error(
    "Fix: rewrite the text without internal ids or plans; say what the user can do now. Add a real exception to ALLOWED in npm-scripts/prose-check.mjs.",
  );
  process.exit(1);
}
console.log(`prose: ${files.length} files of user-facing text carry no internal ids`);
