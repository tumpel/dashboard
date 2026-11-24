import { execFileSync } from "node:child_process";
import { appendFileSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { releaseDecision, releaseSource, remoteTagShas, requireReleaseSha, stampRelease } from "./release-plan.mjs";

const assetUrls = (release) => release.assets.map((asset) => asset.browser_download_url);

const publishedRelease = (source, candidates, gh) => {
  if (!candidates.length) return null;

  const releases = JSON.parse(gh(["api", `/repos/${source.repository}/releases`, "--paginate", "--slurp"])).flat();
  const release = releases.find(({ tag_name: name, draft, published_at: publishedAt, assets }) => {
    if (!candidates.includes(name) || draft || !publishedAt) return false;
    const tarballs = ["dashboard", "pages"].map((component) => `${component}-${name.slice(1)}.tgz`);
    const names = new Set(assets.map((asset) => asset.name));
    return tarballs.every((tarball) => names.has(tarball) && names.has(`${tarball}.sha256`));
  });
  if (!release) return null;
  return {
    sha: source.sha,
    repository: source.repository,
    tag: release.tag_name,
    version: release.tag_name.slice(1),
    prerelease: release.prerelease,
    publishedAssets: assetUrls(release),
  };
};

export const runRelease = (
  command,
  {
    root = process.cwd(),
    env = process.env,
    gh = (args, options) =>
      execFileSync("gh", args, { cwd: root, env, encoding: "utf8", timeout: 120_000, ...options }),
  } = {},
) => {
  const state = join(root, ".tmp", "release");
  const read = (name) => JSON.parse(readFileSync(join(state, `${name}.json`), "utf8"));
  const write = (name, value) => writeFileSync(join(state, `${name}.json`), `${JSON.stringify(value, null, 2)}\n`);

  if (command === "prepare") {
    const event = JSON.parse(readFileSync(env.GITHUB_EVENT_PATH, "utf8"));
    const run = event.workflow_run;
    const source = {
      root,
      sha: run?.head_sha ?? env.GITHUB_SHA,
      ref: run ? "refs/heads/main" : env.GITHUB_REF,
      repository: env.GITHUB_REPOSITORY,
    };
    requireReleaseSha(root, source.sha);
    let tagPlan = null;
    if (source.ref.startsWith("refs/tags/")) {
      const {
        workflow_runs: [check],
      } = JSON.parse(
        gh([
          "api",
          `/repos/${source.repository}/actions/workflows/checks.yml/runs?head_sha=${source.sha}&event=push&branch=main&per_page=1`,
        ]),
      );
      tagPlan = releaseDecision({
        ...releaseSource(source),
        conclusion: check?.status === "completed" ? check.conclusion : undefined,
      });
    }
    const tags = [...remoteTagShas(root)]
      .filter(([tag, sha]) => sha === source.sha && (!tagPlan || tag === tagPlan.tag))
      .map(([tag]) => tag);
    const plan =
      publishedRelease(source, tags, gh) ??
      tagPlan ??
      releaseDecision(releaseSource({ ...source, pendingTags: tags.filter((tag) => tag.includes("-rc.")) }));
    mkdirSync(state, { recursive: true });
    write("plan", plan);
    if (plan) stampRelease(root, plan);
    else console.log("release: no shipped change needs a new version");
    appendFileSync(env.GITHUB_OUTPUT, `version=${plan?.version ?? ""}\n`);
    return;
  }

  if (command === "publish") {
    const plan = read("plan");
    requireReleaseSha(root, plan.sha);
    const existingSha = remoteTagShas(root).get(plan.tag);
    if ((existingSha !== undefined || plan.publishedAssets) && existingSha !== plan.sha)
      throw new Error(
        `Release tag ${plan.tag} does not point to the checked SHA ${plan.sha}. Fix the tag before publishing.`,
      );

    let assets = plan.publishedAssets;
    if (!assets) {
      execFileSync("npm", ["run", "pack"], { cwd: root, stdio: "inherit", timeout: 600_000 });
      execFileSync("npm", ["run", "pack:check"], { cwd: root, stdio: "inherit", timeout: 120_000 });
      const files = readdirSync(join(root, "release"))
        .sort()
        .map((name) => join(root, "release", name));
      gh([
        "release",
        "create",
        plan.tag,
        ...files,
        "--repo",
        plan.repository,
        "--target",
        plan.sha,
        "--title",
        plan.tag,
        "--generate-notes",
        `--latest=${!plan.prerelease}`,
        ...(plan.prerelease ? ["--prerelease"] : []),
      ]);
      assets = assetUrls(JSON.parse(gh(["api", `/repos/${plan.repository}/releases/tags/${plan.tag}`])));
    }

    write("published", {
      component: "dashboard",
      repository: plan.repository,
      sha: plan.sha,
      tag: plan.tag,
      assets,
    });
    return;
  }

  if (command === "dispatch") {
    const token = env.CONTROL_PLANE_DISPATCH_TOKEN;
    if (!token) {
      console.log("::notice::Release dispatch skipped because CONTROL_PLANE_DISPATCH_TOKEN is empty.");
      return;
    }
    gh(["api", "--method", "POST", "/repos/tumpel/control-plane/dispatches", "--input", "-"], {
      env: { ...env, GH_TOKEN: token },
      input: JSON.stringify({ event_type: "component-released", client_payload: read("published") }),
    });
    return;
  }

  throw new Error("Unknown release command. Run release:prepare, release:publish or release:dispatch.");
};

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) runRelease(process.argv[2]);
