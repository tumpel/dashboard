import { setTimeout } from "node:timers/promises";

export const waitFor = async (observe, clock = { sleep: setTimeout }) => {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const result = await observe();
    if (result !== null) return result;
    if (attempt === 9)
      throw new Error(
        "Release readiness timed out after 10 observations. Check the exact source SHA's checks and retry.",
      );
    await clock.sleep(1000 * 2 ** attempt);
  }
};
