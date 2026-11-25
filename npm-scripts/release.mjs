import { appendFileSync, readFileSync, writeFileSync } from "node:fs";
import { planCandidate } from "./release-plan.mjs";

const { GITHUB_REF_TYPE, GITHUB_REF_NAME, GITHUB_OUTPUT } = process.env;
const tag = GITHUB_REF_TYPE === "tag" ? GITHUB_REF_NAME : planCandidate(process.cwd())?.tag;
if (!tag) {
  console.log("No shipped files changed since the nearest version tag.");
  process.exit(0);
}
for (const path of ["packages/dashboard/package.json", "packages/pages/package.json"]) {
  const manifest = JSON.parse(readFileSync(path, "utf8"));
  manifest.version = tag.slice(1);
  writeFileSync(path, `${JSON.stringify(manifest, null, 2)}\n`);
}
appendFileSync(GITHUB_OUTPUT, `tag=${tag}\n`);
