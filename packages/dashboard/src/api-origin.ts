import type { Wording } from "./api/wording";

export const API_ORIGIN_META = "tumpel-api-origin";

export type ApiOriginRead = { ok: true; origin: string } | { ok: false; wording: Wording };

const TITLE = "The dashboard does not know its API origin";
const EXAMPLE = "https://api.example.com";

export const readApiOrigin = (content: string | null): ApiOriginRead => {
  if (content === null) {
    return {
      ok: false,
      wording: {
        title: TITLE,
        detail: `The page has no <meta name="${API_ORIGIN_META}"> tag.`,
        fix: `The server that hosts the dashboard must insert <meta name="${API_ORIGIN_META}" content="${EXAMPLE}"> into the page head, with the control plane origin.`,
      },
    };
  }
  if (!URL.canParse(content)) {
    return {
      ok: false,
      wording: {
        title: TITLE,
        detail: `The ${API_ORIGIN_META} tag holds "${content}", which is not a URL.`,
        fix: `Set the tag's content to the control plane origin, such as ${EXAMPLE}.`,
      },
    };
  }
  const origin = new URL(content).origin;
  if (origin !== content) {
    return {
      ok: false,
      wording: {
        title: TITLE,
        detail: `The ${API_ORIGIN_META} tag holds "${content}", which is not a bare origin.`,
        fix: `Set the tag's content to an http or https origin with no path and no trailing slash, such as ${origin === "null" ? EXAMPLE : origin}.`,
      },
    };
  }
  return { ok: true, origin };
};
