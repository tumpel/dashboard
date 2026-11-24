import { createReadStream } from "node:fs";
import { mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { extname, join, normalize } from "node:path";
import { chromium } from "playwright";

const storybookDirectory = join(import.meta.dirname, "../packages/dashboard/dist-storybook");
const outputDirectory = join(import.meta.dirname, "../.tmp/mobile-screenshots");
const check = process.argv.includes("--check");
const metricsPhoneStory = "dashboard-metrics-metrics--overview-on-a-phone";
const compatibilityStory = "dashboard-sessions-sessiondetail--response-compatibility";
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

if (check) {
  const page = await browser.newPage();
  const tenantId = "tnt_placeholder01";
  const sessionId = "ses_4";
  const turnId = "trn_ses_4_3";
  const turn = {
    tenantId,
    sessionId,
    turnId,
    boxId: "box_1",
    prompt: "Review the delivery.",
    lineCount: 1,
    createdAt: 1,
    updatedAt: 2,
    state: "Completed",
    extraField: { new: "field" },
  };
  let newer = false;
  await page.route("**/v1/sessions/ses_4**", async (route) => {
    const url = new URL(route.request().url());
    const failed = {
      ...turn,
      state: "Failed",
      reason: "NewFailureReason",
      detail: "A newer reason.",
      failedAt: "2026-11-21T12:00:00Z",
    };
    const lastTurn = newer
      ? { ...turn, turnId: "trn_ses_4_4", state: "Suspended", prompt: "Keep the next prompt." }
      : turn;
    if (url.pathname.endsWith("/turns")) {
      return route.fulfill({ json: newer ? [failed, lastTurn] : [turn] });
    }
    if (url.pathname.endsWith("/transcript")) {
      const target = url.searchParams.get("turnId");
      const common = { sessionState: newer ? "Recovering" : "Idle", cursor: 1, finished: true, extraField: true };
      const fresh = !url.searchParams.has("after");
      return route.fulfill({
        json: url.searchParams.has("compact")
          ? {
              ...common,
              form: "Compact",
              sessionId,
              turns: fresh ? [{ turnId: target, lines: [{ lineSeq: 1, text: "Known compact line" }] }] : [],
            }
          : {
              ...common,
              form: "Raw",
              lines: fresh
                ? [{ lineSeq: 1, text: "Known raw line", tenantId, sessionId, turnId: target, createdAt: 1 }]
                : [],
            },
      });
    }
    return route.fulfill({
      json: {
        sessionId,
        tenantId,
        principalId: "prn_1",
        hostId: "hst_1",
        boxId: "box_1",
        personaId: "per_1",
        repository: "https://github.com/owner/known-repo",
        origin: { kind: "Prompt" },
        startedBy: { kind: "Person", principalId: "prn_1" },
        tags: [],
        harness: "ClaudeCode",
        harnessVersion: "2.1.4",
        model: "a-model",
        state: newer ? "Recovering" : "Idle",
        lastTurnId: lastTurn.turnId,
        lastTurnState: lastTurn.state,
        lastTurnAt: "2026-11-21T12:00:00Z",
        lastTurn,
        boxRetention: "Auto",
        createdAt: 1,
        updatedAt: 2,
        extraField: true,
      },
    });
  });
  let pause;
  await page.routeWebSocket("**/v1/events", (socket) => {
    pause = () =>
      socket.send(
        JSON.stringify({
          event: "SubscriptionPaused",
          reason: { kind: "NewPauseReason" },
          eventId: 1,
          tenantId,
          createdAt: 1,
          subscriptionId: "sub_1",
          sessionId,
        }),
      );
  });

  const url = `http://127.0.0.1:${address.port}/iframe.html?id=${compatibilityStory}&viewMode=story&compatibility=1`;
  const visible = { state: "visible", timeout: 5000 };
  const notice = page.getByRole("status").filter({ hasText: "This dashboard likely needs an update" });
  await page.goto(url);
  await page.getByText("Known compact line", { exact: true }).waitFor(visible);
  if (await notice.count()) throw new Error("An extra response field showed the update notice.");
  if (!pause) throw new Error("The dashboard did not open its live event channel.");
  pause();
  await notice.waitFor(visible);
  await page.getByText("Known compact line", { exact: true }).waitFor(visible);

  newer = true;
  await page.goto(url);
  await notice.waitFor(visible);
  await page.getByText("Review the delivery.", { exact: true }).waitFor(visible);
  await page.getByText("Known compact line", { exact: true }).waitFor(visible);
  await page.getByRole("checkbox", { name: "Compact" }).uncheck();
  await page.getByText("Known raw line", { exact: true }).waitFor(visible);
  await page.getByRole("link", { name: "Turn 2 Unrecognised, 1 lines" }).click({ timeout: 5000 });
  await page.getByText("Keep the next prompt.", { exact: true }).waitFor(visible);
  await page.close();
}

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
    ? `Checked response compatibility and ${stories.length * viewports.length} mobile metrics views`
    : `Captured ${stories.length * viewports.length} screenshots in ${outputDirectory}`,
);
