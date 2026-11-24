import { execFileSync } from "node:child_process";
import { DOCS } from "./docs-paths.mjs";

const code =
  process.env.GITHUB_EVENT_NAME !== "pull_request" ||
  execFileSync("git", ["diff", "--name-only", "HEAD^1", "HEAD", "--", ".", ...DOCS], { timeout: 30_000 }).length > 0;
console.log(`code=${code}`);
