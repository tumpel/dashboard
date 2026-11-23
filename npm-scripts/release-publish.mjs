import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { pack } from "./pack.mjs";
import { checkPack } from "./pack-check.mjs";

export const publishRelease = async ({ root, plan, github }) => {
  execFileSync("npm", ["run", "build"], { cwd: root, stdio: "inherit", timeout: 600_000 });
  pack(root);
  checkPack(root);
  const release = await github(`/repos/${plan.repository}/releases`, {
    method: "POST",
    body: JSON.stringify({
      tag_name: plan.tag,
      target_commitish: plan.sha,
      name: plan.tag,
      draft: true,
      prerelease: plan.prerelease,
      generate_release_notes: true,
    }),
  });
  for (const name of readdirSync(join(root, "release")).sort()) {
    await github(`${release.upload_url.split("{")[0]}?name=${encodeURIComponent(name)}`, {
      method: "POST",
      headers: { "content-type": "application/octet-stream" },
      body: readFileSync(join(root, "release", name)),
    });
  }
  const published = await github(`/repos/${plan.repository}/releases/${release.id}`, {
    method: "PATCH",
    body: JSON.stringify({
      draft: false,
      prerelease: plan.prerelease,
      make_latest: plan.prerelease ? "false" : "true",
    }),
  });
  return {
    component: "dashboard",
    repository: plan.repository,
    sha: plan.sha,
    tag: plan.tag,
    assets: published.assets.map((asset) => asset.browser_download_url),
  };
};
