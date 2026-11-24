import { execFileSync } from "node:child_process";

const { CONTROL_PLANE_DISPATCH_TOKEN, GITHUB_REPOSITORY: repository, RELEASE_SHA: sha } = process.env;
if (!CONTROL_PLANE_DISPATCH_TOKEN) {
  console.log("::warning::Set CONTROL_PLANE_DISPATCH_TOKEN to dispatch this release to control-plane.");
  process.exit(0);
}
const tag = process.argv[2];
const release = execFileSync("gh", ["release", "view", tag, "--json", "assets", "--repo", repository], {
  encoding: "utf8",
  timeout: 30_000,
});
const assets = JSON.parse(release).assets.map(({ url }) => url);
const clientPayload = { component: "dashboard", repository, tag, sha, assets };
execFileSync("gh", ["api", "--method", "POST", "/repos/tumpel/control-plane/dispatches", "--input", "-"], {
  env: { ...process.env, GH_TOKEN: CONTROL_PLANE_DISPATCH_TOKEN },
  input: JSON.stringify({ event_type: "component-released", client_payload: clientPayload }),
  stdio: ["pipe", "inherit", "inherit"],
  timeout: 30_000,
});
