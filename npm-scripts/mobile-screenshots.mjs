import { createReadStream } from "node:fs";
import { mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { extname, join, normalize } from "node:path";
import { chromium } from "playwright";

const storybookDirectory = join(import.meta.dirname, "../packages/dashboard/dist-storybook");
const outputDirectory = join(import.meta.dirname, "../.tmp/mobile-screenshots");
const check = process.argv.includes("--check");
const metricsPhoneStory = "dashboard-metrics-metrics--overview-on-a-phone";
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
  (entry) => entry.type === "story" && (!check || entry.id === metricsPhoneStory),
);

await rm(outputDirectory, { recursive: true, force: true });
await mkdir(outputDirectory, { recursive: true });

const server = createServer(async (request, response) => {
  const pathname = new URL(request.url, "http://127.0.0.1").pathname;
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
    ? `Checked ${stories.length * viewports.length} mobile metrics views`
    : `Captured ${stories.length * viewports.length} screenshots in ${outputDirectory}`,
);
