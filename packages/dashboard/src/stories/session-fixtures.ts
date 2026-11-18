import {
  ApiFailure,
  type GitHubIssue,
  type GitHubRepository,
  type Persona,
  type Session,
  type TranscriptPage,
  type TranscriptQuery,
  type TumpelApi,
  type Turn,
} from "../api/port";

type SessionApi = Pick<
  TumpelApi,
  | "getSession"
  | "startSession"
  | "startSessionFromIssue"
  | "stopSession"
  | "archiveSession"
  | "listTurns"
  | "sendTurn"
  | "readTranscript"
  | "listSnapshots"
  | "listCredentialHandovers"
  | "listStopFailures"
  | "listPersonas"
  | "getGitHubConnection"
  | "listGitHubInstallations"
  | "listRepositories"
  | "listIssues"
>;

export const turnId = (sessionId: string, index: number): string => `trn_${sessionId}_${index}`;

const repository = (owner: string, name: string, defaultBranch: string, isPrivate: boolean): GitHubRepository => ({
  owner,
  name,
  defaultBranch,
  private: isPrivate,
  htmlUrl: `https://github.com/${owner}/${name}`,
});

export const REPOSITORIES: GitHubRepository[] = [
  repository("owner", "repo-name", "main", true),
  repository("owner", "other-repo", "main", false),
  repository("owner", "docs-site", "gh-pages", false),
];

const issue = (name: string, issueNumber: number, title: string, labels: string[], updatedAt: string): GitHubIssue => ({
  issueNumber,
  title,
  htmlUrl: `https://github.com/owner/${name}/issues/${issueNumber}`,
  labels,
  updatedAt,
});

export const ISSUES: Record<string, GitHubIssue[]> = {
  "repo-name": [
    issue("repo-name", 42, "Add a retry budget to the uploader", ["enhancement"], "2026-11-12T09:30:00+01:00"),
    issue("repo-name", 41, "Document the label rules", ["docs"], "2026-11-10T16:05:00+01:00"),
    issue("repo-name", 37, "Flaky upload test", ["bug", "flaky"], "2026-11-02T11:42:00+01:00"),
  ],
  "other-repo": [issue("other-repo", 8, "Drop the legacy config loader", [], "2026-11-09T08:00:00+01:00")],
  "docs-site": [],
};

const PROMPTS = [
  "Work issue #42: Add a retry budget to the uploader.",
  "Address the review comments on the pull request.",
  "Rebase on main and make the flaky upload test deterministic.",
];

export const turnsFor = (
  session: Session,
  last: Turn["state"] = session.state === "Running" ? "Running" : "Completed",
) =>
  PROMPTS.map((prompt, index): Turn => {
    const state = index === PROMPTS.length - 1 ? last : "Completed";
    const base = {
      turnId: turnId(session.sessionId, index + 1),
      tenantId: session.tenantId,
      sessionId: session.sessionId,
      boxId: session.boxId,
      prompt,
      lineCount: [1210, 388, state === "Failed" ? 41 : 214][index] ?? 0,
      createdAt: session.createdAt + index * 600_000,
      updatedAt: session.createdAt + index * 600_000 + 360_000,
    };
    if (state !== "Failed") return { ...base, state };
    return {
      ...base,
      state,
      reason: "Undelivered",
      detail:
        "no host took the turn within 3600 seconds of its offer, so it never ran; host box is offline. Check that its supervisor runs and reads Online, then send the turn again",
      failedAt: "2026-11-15T14:03:12+01:00",
    };
  });

const COMPACT = [
  "I'll read the uploader module and its tests first.",
  "[Read] src/upload.ts",
  "[Bash] npm test -- upload",
  "The tests pass. Adding the budget to the config schema.",
  "[Edit] src/config.ts",
  "Opening a draft pull request that closes #42.",
];

const RAW = COMPACT.map((text) =>
  JSON.stringify(
    text.startsWith("[")
      ? { type: "assistant", message: { content: [{ type: "tool_use", name: text.slice(1, text.indexOf("]")) }] } }
      : { type: "assistant", message: { content: [{ type: "text", text }] } },
  ),
);

export const FIRST_LINE = 1600;

export const transcriptPage = (
  session: Session,
  query: TranscriptQuery,
  finished: boolean,
  now: number,
): TranscriptPage => {
  const compact = query.compact === true;
  const turnId = query.turnId ?? "";
  const lines = (compact ? COMPACT : RAW).map((text, index) => ({
    sessionId: session.sessionId,
    lineSeq: FIRST_LINE + index,
    tenantId: session.tenantId,
    turnId,
    text,
    createdAt: now,
  }));
  const after = query.after ?? 0;
  const fresh = lines.filter((line) => line.lineSeq > after);
  const cursor = fresh.at(-1)?.lineSeq ?? after;
  const sessionState = session.state;
  if (!compact) return { form: "Raw", sessionState, lines: fresh, cursor, finished };
  const kept = fresh.map(({ lineSeq, text }) => ({ lineSeq, text }));
  const turns = kept.length === 0 ? [] : [{ turnId, lines: kept }];
  return { form: "Compact", sessionId: session.sessionId, sessionState, turns, cursor, finished };
};

const notFound = (what: string, id: string) =>
  new ApiFailure({
    kind: "Problem",
    status: 404,
    problem: {
      code: "NotFound",
      title: `No ${what} with this id in this tenant`,
      detail: `No ${what} ${id}.`,
      fix: "Open Sessions and pick one.",
    },
  });

export const sessionFakes = (sessions: Session[], personas: Persona[], now: number): SessionApi => {
  const find = (sessionId: string): Session => {
    const found = sessions.find((item) => item.sessionId === sessionId);
    if (found === undefined) throw notFound("session", sessionId);
    return found;
  };
  return {
    getSession: async (sessionId) => find(sessionId),
    startSession: async (body) => {
      const base = sessions[0];
      if (base === undefined) throw notFound("session", "ses_new");
      const session: Session = { ...base, ...body, sessionId: "ses_new", state: "Starting" };
      const first = turnsFor(session, "Offered")[0];
      if (first === undefined) throw notFound("turn", "first");
      return { session, turn: { ...first, prompt: body.prompt } };
    },
    startSessionFromIssue: async (body) => {
      const base = sessions[0];
      if (base === undefined) throw notFound("session", "ses_new");
      const picked = ISSUES[body.name]?.find((item) => item.issueNumber === body.issueNumber);
      if (picked === undefined) throw notFound("issue", String(body.issueNumber));
      const branch = `ticket/${picked.issueNumber}-placeholder-branch`;
      const session: Session = {
        ...base,
        personaId: body.personaId,
        model: body.model,
        repository: `https://github.com/${body.owner}/${body.name}`,
        sessionId: "ses_new",
        state: "Starting",
      };
      const first = turnsFor(session, "Offered")[0];
      if (first === undefined) throw notFound("turn", "first");
      return {
        session,
        turn: first,
        issue: {
          sessionId: "ses_new",
          issueNumber: picked.issueNumber,
          title: picked.title,
          htmlUrl: picked.htmlUrl,
          branch,
        },
      };
    },
    stopSession: async (sessionId) => ({ ...find(sessionId), state: "Stopping" }),
    archiveSession: async (sessionId) => ({ ...find(sessionId), state: "Archived" }),
    listTurns: async (sessionId) => turnsFor(find(sessionId)),
    sendTurn: async (sessionId, prompt) => ({
      turnId: turnId(sessionId, 4),
      tenantId: find(sessionId).tenantId,
      sessionId,
      boxId: find(sessionId).boxId,
      prompt,
      state: "Offered",
      lineCount: 0,
      createdAt: now,
      updatedAt: now,
    }),
    readTranscript: async (sessionId, query) => {
      const session = find(sessionId);
      const turn = turnsFor(session).find((item) => item.turnId === query.turnId);
      return transcriptPage(session, query, turn === undefined || turn.state === "Completed", now);
    },
    listSnapshots: async (sessionId) => {
      const session = find(sessionId);
      return [
        {
          snapshotId: "snp_1",
          tenantId: session.tenantId,
          sessionId,
          boxId: session.boxId,
          turnId: turnId(sessionId, 1),
          snapshotSeq: 1,
          storageKey: "placeholder/1",
          outcome: { state: "Stored", uploadedBytes: 44_040_192 },
          createdAt: session.createdAt + 360_000,
          updatedAt: session.createdAt + 360_000,
        },
        {
          snapshotId: "snp_2",
          tenantId: session.tenantId,
          sessionId,
          boxId: session.boxId,
          turnId: turnId(sessionId, 2),
          snapshotSeq: 2,
          storageKey: "placeholder/2",
          outcome: {
            state: "Failed",
            reason: "UploadExpired",
            detail: "The upload URL expired before the host finished. The next snapshot retries the upload.",
            failedAt: "2026-11-15T13:41:02+01:00",
          },
          createdAt: session.createdAt + 960_000,
          updatedAt: session.createdAt + 960_000,
        },
        {
          snapshotId: "snp_3",
          tenantId: session.tenantId,
          sessionId,
          boxId: session.boxId,
          turnId: turnId(sessionId, 3),
          snapshotSeq: 3,
          storageKey: "placeholder/3",
          outcome: { state: "Stored", uploadedBytes: 1_887_437 },
          createdAt: session.createdAt + 1_560_000,
          updatedAt: session.createdAt + 1_560_000,
        },
      ];
    },
    listCredentialHandovers: async (sessionId) => {
      const session = find(sessionId);
      return [1, 2, 3].map((index) => ({
        credentialHandoverId: `chd_${index}`,
        tenantId: session.tenantId,
        sessionId,
        turnId: turnId(sessionId, index),
        hostId: session.hostId,
        boxId: session.boxId,
        variableNames: index === 1 ? ["CLAUDE_CODE_OAUTH_TOKEN"] : ["CLAUDE_CODE_OAUTH_TOKEN", "NPM_TOKEN"],
        repositoryCredentialSource: index === 1 ? "SecretSet" : "GitHubApp",
        createdAt: session.createdAt + (index - 1) * 600_000,
      }));
    },
    listStopFailures: async () => [],
    listPersonas: async () => personas,
    listRepositories: async () => REPOSITORIES,
    listIssues: async ({ name }) => ISSUES[name] ?? [],
    getGitHubConnection: async () => ({
      tenantId: sessions[0]?.tenantId ?? "",
      app: { state: "Ready", appSlug: "example" },
    }),
    listGitHubInstallations: async () => [
      {
        installationId: 1,
        tenantId: sessions[0]?.tenantId ?? "",
        accountLogin: "owner",
        accountType: "User",
        status: "Active",
        createdAt: now,
        updatedAt: now,
      },
    ],
  };
};
