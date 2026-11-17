import { OAuthErrorSchema, OAuthTokenSchema, ProblemSchema, WhoamiSchema } from "@tumpel/schemas";
import { z } from "zod";
import type { AuthPort, Failure, SignInOutcome } from "../api/port";
import { forgetAllSignIns, forgetSignIn, readSignIns, storageOf, writeSignIn } from "./token-store";

const CLIENT_ID = "tumpel-dashboard";
const CALLBACK_PATH = "/auth/callback";
const PENDING_PREFIX = "tumpel.signin.";
const EARLY_REFRESH_MS = 30_000;

const PendingSignInSchema = z.object({ verifier: z.string(), returnPath: z.string() });

type OAuthToken = z.infer<typeof OAuthTokenSchema>;

interface HeldToken {
  token: string;
  expiresAt: number;
}

const base64Url = (bytes: Uint8Array): string =>
  btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

const randomUrlSafe = (): string => base64Url(crypto.getRandomValues(new Uint8Array(32)));

const challengeOf = async (verifier: string): Promise<string> =>
  base64Url(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier))));

const unreachable = (what: string): Failure => ({
  kind: "Unreachable",
  detail: `${what} got no response from the control plane.`,
});

const refused = (title: string, detail: string, fix: string): Failure => ({
  kind: "Problem",
  status: 400,
  problem: { code: "InvalidRequest", title, detail, fix },
});

type Answer = { ok: true; status: number; body: unknown } | { ok: false; failure: Failure };

const send = (what: string, url: string, init: RequestInit): Promise<Answer> =>
  fetch(url, init).then(
    async (response): Promise<Answer> => ({
      ok: true,
      status: response.status,
      body: await response.json().catch(() => null),
    }),
    (): Answer => ({ ok: false, failure: unreachable(what) }),
  );

const oauthRefusal = (status: number, body: unknown): Failure => {
  const error = OAuthErrorSchema.safeParse(body);
  return error.success
    ? refused(
        "Sign-in did not finish",
        `The control plane refused the sign-in: ${error.data.error}, ${error.data.error_description}.`,
        "Sign in again. If it fails twice, report it.",
      )
    : { kind: "Unexpected", status, detail: "The control plane answered the sign-in with an unexpected body." };
};

const answerFailure = (what: string, status: number, body: unknown): Failure => {
  const problem = ProblemSchema.safeParse(body);
  if (problem.success) return { kind: "Problem", status, problem: problem.data };
  const error = OAuthErrorSchema.safeParse(body);
  if (error.success) {
    return refused(
      `${what} was refused`,
      `The control plane answered ${error.data.error}: ${error.data.error_description}.`,
      "Retry. If it keeps failing, report it.",
    );
  }
  return { kind: "Unexpected", status, detail: `${what} answered ${status} with an unexpected body.` };
};

const formPost = (what: string, url: string, params: Record<string, string>): Promise<Answer> =>
  send(what, url, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(params),
  });

export type TokenLookup = { kind: "Token"; token: string } | { kind: "None" } | { kind: "Failed"; failure: Failure };

export const createAuth = (
  apiOrigin: string,
  dashboardOrigin: string,
): AuthPort & { accessToken(tenantId: string): Promise<TokenLookup> } => {
  const redirectUri = `${dashboardOrigin}${CALLBACK_PATH}`;
  const held = new Map<string, HeldToken>();
  const refreshing = new Map<string, Promise<TokenLookup>>();

  const freshToken = (tenantId: string): string | null => {
    const current = held.get(tenantId);
    return current !== undefined && current.expiresAt - EARLY_REFRESH_MS > Date.now() ? current.token : null;
  };

  const hold = (tenantId: string, token: OAuthToken): void => {
    held.set(tenantId, { token: token.access_token, expiresAt: Date.now() + token.expires_in * 1000 });
  };

  const refresh = async (tenantId: string): Promise<TokenLookup> =>
    await navigator.locks.request(`tumpel.refresh.${tenantId}`, async (): Promise<TokenLookup> => {
      const current = freshToken(tenantId);
      if (current !== null) return { kind: "Token", token: current };
      const stored = readSignIns()[tenantId];
      if (stored === undefined) return { kind: "None" };
      const answer = await formPost("The token refresh", `${apiOrigin}/oauth/token`, {
        grant_type: "refresh_token",
        refresh_token: stored.refreshToken,
        client_id: CLIENT_ID,
      });
      if (!answer.ok) return { kind: "Failed", failure: answer.failure };
      const token = OAuthTokenSchema.safeParse(answer.body);
      if (token.success) {
        writeSignIn({ ...stored, refreshToken: token.data.refresh_token });
        hold(tenantId, token.data);
        return { kind: "Token", token: token.data.access_token };
      }
      const error = OAuthErrorSchema.safeParse(answer.body);
      if (error.success && error.data.error === "invalid_grant") {
        forgetSignIn(tenantId);
        held.delete(tenantId);
        return { kind: "None" };
      }
      return { kind: "Failed", failure: answerFailure("The token refresh", answer.status, answer.body) };
    });

  const accessToken = (tenantId: string): Promise<TokenLookup> => {
    const current = freshToken(tenantId);
    if (current !== null) return Promise.resolve({ kind: "Token", token: current });
    if (readSignIns()[tenantId] === undefined) return Promise.resolve({ kind: "None" });
    const pending = refreshing.get(tenantId) ?? refresh(tenantId).finally(() => refreshing.delete(tenantId));
    refreshing.set(tenantId, pending);
    return pending;
  };

  const signIn = async (returnPath: string): Promise<Failure> => {
    const session = storageOf("sessionStorage");
    if (session === null) {
      return refused(
        "Sign-in needs session storage",
        "This browser blocks site data for the dashboard, so the sign-in cannot keep its state.",
        "Allow site data for this origin, then sign in again.",
      );
    }
    const verifier = randomUrlSafe();
    const state = randomUrlSafe();
    session.setItem(`${PENDING_PREFIX}${state}`, JSON.stringify({ verifier, returnPath }));
    const authorize = new URL(`${apiOrigin}/oauth/authorize`);
    authorize.search = new URLSearchParams({
      response_type: "code",
      client_id: CLIENT_ID,
      redirect_uri: redirectUri,
      code_challenge: await challengeOf(verifier),
      code_challenge_method: "S256",
      state,
    }).toString();
    window.location.assign(authorize.toString());
    return new Promise<Failure>(() => undefined);
  };

  const finishSignIn = async (params: URLSearchParams): Promise<SignInOutcome> => {
    const error = params.get("error");
    if (error !== null) {
      return {
        ok: false,
        failure: refused(
          "Sign-in did not finish",
          `The control plane answered ${error}: ${params.get("error_description") ?? "no description"}.`,
          "Sign in again. If it fails twice, report it.",
        ),
      };
    }
    const state = params.get("state") ?? "";
    const key = `${PENDING_PREFIX}${state}`;
    const session = storageOf("sessionStorage");
    const pending = PendingSignInSchema.safeParse(JSON.parse(session?.getItem(key) ?? "null"));
    session?.removeItem(key);
    if (!pending.success) {
      return {
        ok: false,
        failure: refused(
          "Sign-in did not finish",
          "The sign-in answer does not match a sign-in this browser started.",
          "Sign in again from this browser tab.",
        ),
      };
    }
    if (params.get("iss") !== apiOrigin) {
      return {
        ok: false,
        failure: refused(
          "Sign-in did not finish",
          `The sign-in answer came from ${params.get("iss") ?? "an unnamed issuer"}, not ${apiOrigin}.`,
          "Sign in again. If it fails twice, report it.",
        ),
      };
    }
    const exchanged = await formPost("The token exchange", `${apiOrigin}/oauth/token`, {
      grant_type: "authorization_code",
      code: params.get("code") ?? "",
      code_verifier: pending.data.verifier,
      client_id: CLIENT_ID,
      redirect_uri: redirectUri,
    });
    if (!exchanged.ok) return exchanged;
    const token = OAuthTokenSchema.safeParse(exchanged.body);
    if (!token.success) return { ok: false, failure: oauthRefusal(exchanged.status, exchanged.body) };
    const asked = await send("The whoami call", `${apiOrigin}/v1/whoami`, {
      headers: { authorization: `Bearer ${token.data.access_token}` },
    });
    if (!asked.ok) return asked;
    const whoami = WhoamiSchema.safeParse(asked.body);
    if (!whoami.success) {
      return {
        ok: false,
        failure: { kind: "Unexpected", status: asked.status, detail: "whoami answered without a tenant." },
      };
    }
    const tenantId = whoami.data.tenant.tenantId;
    writeSignIn({
      tenantId,
      tenantName: whoami.data.tenant.name,
      email: whoami.data.principal.email,
      refreshToken: token.data.refresh_token,
    });
    hold(tenantId, token.data);
    return { ok: true, tenantId, returnPath: pending.data.returnPath };
  };

  const revoke = async (refreshToken: string): Promise<Failure | null> => {
    const answer = await formPost("The sign-out", `${apiOrigin}/oauth/revoke`, {
      token: refreshToken,
      token_type_hint: "refresh_token",
      client_id: CLIENT_ID,
    });
    if (!answer.ok) return answer.failure;
    return answer.status === 200 ? null : answerFailure("The sign-out", answer.status, answer.body);
  };

  const signOut = async (): Promise<Failure | null> => {
    const stored = Object.values(readSignIns());
    forgetAllSignIns();
    held.clear();
    const failures = await Promise.all(stored.map(({ refreshToken }) => revoke(refreshToken)));
    return failures.find((failure) => failure !== null) ?? null;
  };

  return {
    accessToken,
    signIn,
    finishSignIn,
    signedInTenants: () =>
      Object.values(readSignIns()).map(({ tenantId, tenantName, email }) => ({ tenantId, tenantName, email })),
    signOut,
  };
};
