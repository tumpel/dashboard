import { createReadStream } from "node:fs";
import { mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { extname, join, normalize } from "node:path";
import { chromium } from "playwright";

const storybookDirectory = join(import.meta.dirname, "../packages/dashboard/dist-storybook");
const outputDirectory = join(import.meta.dirname, "../.tmp/mobile-screenshots");
const check = process.argv.includes("--check");
const metricsPhoneStory = "dashboard-metrics-metrics--overview-on-a-phone";
const prebuildStory = "dashboard-prebuilds-prebuildlist--control-plane-shaped";
const prebuildRepository = "owner/control-plane-prebuild";
const viewports = [
  { name: "390x844", width: 390, height: 844 },
  { name: "360x800", width: 360, height: 800 },
];
const contentTypes = new Map([
  [".css", "text/css"],
  [".html", "text/html"],
  [".js", "text/javascript"],
  [".json", "application/json"],
  [".png", "image/png"],
  [".svg", "image/svg+xml"],
  [".woff2", "font/woff2"],
  [".webmanifest", "application/manifest+json"],
]);

const index = JSON.parse(await readFile(join(storybookDirectory, "index.json"), "utf8"));
const stories = Object.values(index.entries).filter(
  (entry) => entry.type === "story" && (!check || entry.id === metricsPhoneStory || entry.id === prebuildStory),
);
if (check && !stories.some((story) => story.id === prebuildStory)) {
  throw new Error(`Storybook is missing ${prebuildStory}.`);
}

await rm(outputDirectory, { recursive: true, force: true });
await mkdir(outputDirectory, { recursive: true });

const server = createServer(async (request, response) => {
  const pathname = new URL(request.url, "http://127.0.0.1").pathname;
  if (pathname === "/v1/prebuilds/latest") {
    response.writeHead(200, { "Content-Type": "application/json" });
    response.end(
      JSON.stringify([
        {
          prebuildId: "pbd_control_plane",
          tenantId: "tnt_placeholder01",
          personaId: "prs_placeholder01",
          repository: `https://github.com/${prebuildRepository}`,
          inputDigest: "3f".repeat(32),
          guestImageDigest: "7c".repeat(32),
          configSource: "RepositoryFile",
          status: { state: "Building" },
          startedAt: "2026-11-15T13:02:00Z",
          logUrl: "https://api.example.com/v1/sessions/ses_prebuild/transcript",
          createdAt: Date.parse("2026-11-15T13:02:00Z"),
          updatedAt: Date.parse("2026-11-15T13:02:00Z"),
        },
      ]),
    );
    return;
  }
  const relativePath = normalize(pathname === "/" ? "index.html" : pathname.slice(1));
  const filePath = join(storybookDirectory, relativePath);
  const file = await stat(filePath);
  response.writeHead(200, { "Content-Type": contentTypes.get(extname(filePath)) ?? "application/octet-stream" });
  createReadStream(filePath, { start: 0, end: file.size - 1 }).pipe(response);
});

await new Promise((resolve, reject) => {
  server.once("error", reject);
  server.listen(0, "127.0.0.1", resolve);
});

const address = server.address();
if (address === null || typeof address === "string") {
  throw new Error("The mobile screenshot server did not bind to a TCP port.");
}

const browser = await chromium.launch({ headless: true });

for (const viewport of viewports) {
  const viewportDirectory = join(outputDirectory, viewport.name);
  await mkdir(viewportDirectory, { recursive: true });
  const context = await browser.newContext({ viewport: { width: viewport.width, height: viewport.height } });
  const page = await context.newPage();

  for (const story of stories) {
    const url = `http://127.0.0.1:${address.port}/iframe.html?id=${encodeURIComponent(story.id)}&viewMode=story`;
    await page.goto(url, { waitUntil: "networkidle", timeout: 15_000 });
    await page.waitForFunction(
      () => document.fonts.status === "loaded" && document.querySelector("#storybook-root")?.childElementCount,
      undefined,
      { timeout: 15_000 },
    );
    if (story.id === metricsPhoneStory) {
      await page.getByText("Turns ended by outcome", { exact: true }).waitFor();
      const widths = await page.evaluate(() => ({
        viewport: document.documentElement.clientWidth,
        document: document.documentElement.scrollWidth,
      }));
      if (widths.document > widths.viewport) {
        throw new Error(`${story.name} renders at ${widths.document}px in a ${widths.viewport}px viewport.`);
      }
    }
    if (check && story.id === prebuildStory) {
      const row = page.getByRole("button", { name: prebuildRepository, exact: true });
      const outOfStep = page.getByText(/out of step/i);
      await row.or(outOfStep).first().waitFor({ timeout: 15_000 });
      if ((await outOfStep.count()) !== 0) throw new Error(await outOfStep.first().textContent());
      await row.waitFor({ timeout: 15_000 });
    }
    if (!check) {
      await page.screenshot({ path: join(viewportDirectory, `${story.id}.png`), animations: "disabled" });
    }
  }

  await context.close();
}

await browser.close();
await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
if (!check) {
  await writeFile(
    join(outputDirectory, "manifest.json"),
    `${JSON.stringify({ viewports, stories: stories.map(({ id, name, title }) => ({ id, name, title })) }, null, 2)}\n`,
  );
}

console.log(
  check
    ? `Checked ${stories.length * viewports.length} mobile views`
    : `Captured ${stories.length * viewports.length} screenshots in ${outputDirectory}`,
);
