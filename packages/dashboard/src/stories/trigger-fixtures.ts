import type { Trigger, TriggerSource, TriggerStartRefused, TriggerTestResult, TumpelApi } from "../api/port";

export type TriggerOperation =
  | "listTriggers"
  | "getTrigger"
  | "createTrigger"
  | "updateTrigger"
  | "deleteTrigger"
  | "testTrigger"
  | "listEvents";

const TENANT_ID = "tnt_placeholder01";
const CREATED = Date.parse("2026-11-10T09:30:00+01:00");
const NOW = Date.parse("2026-11-15T14:02:11+01:00");

const trigger = (
  triggerId: string,
  name: string,
  event: TriggerSource["event"],
  conditions: TriggerSource["conditions"],
  personaId: string,
  prompt: string,
): Trigger => ({
  triggerId,
  tenantId: TENANT_ID,
  name,
  source: { kind: "GitHub", event, conditions },
  personaId,
  model: "claude-opus-5-5",
  prompt,
  principalId: "prn_placeholder01",
  createdAt: CREATED,
  updatedAt: CREATED,
});

export const TRIGGERS: Trigger[] = [
  trigger(
    "trg_placeholder01",
    "post-merge-review",
    "pull_request",
    [
      { field: "repository.full_name", values: ["owner/docs-site"] },
      { field: "action", values: ["closed"] },
      { field: "pull_request.merged", values: ["true"] },
      { field: "pull_request.merged_by.login", values: ["placeholder-user"] },
    ],
    "prs_placeholder03",
    "{{pull_request.merged_by.login}} merged {{pull_request.html_url}} as {{pull_request.merge_commit_sha}}. Review the merged change and open an issue for each problem you find.",
  ),
  trigger(
    "trg_placeholder02",
    "agent-review",
    "status",
    [
      { field: "repository.full_name", values: ["owner/repo-name"] },
      { field: "context", values: ["agent-review"] },
      { field: "state", values: ["pending"] },
    ],
    "prs_placeholder01",
    "Review the pull request {{target_url}} at commit {{sha}}.",
  ),
  trigger(
    "trg_placeholder03",
    "work-on-label",
    "issues",
    [
      { field: "action", values: ["labeled"] },
      { field: "label.name", values: ["agent:work"] },
    ],
    "prs_placeholder02",
    "Work on {{issue.html_url}}. Open a pull request that closes it.",
  ),
];

export const REFUSALS: TriggerStartRefused[] = [
  {
    event: "TriggerStartRefused",
    eventId: 41,
    tenantId: TENANT_ID,
    createdAt: NOW - 2 * 3_600_000,
    triggerId: "trg_placeholder03",
    deliveryId: "a03c7e10-4b2f-11f1-9c1e-placeholder",
    refusal: { code: "NoHostOnline", detail: "No host is online with a free box slot. Start a host, then redeliver." },
  },
  {
    event: "TriggerStartRefused",
    eventId: 37,
    tenantId: TENANT_ID,
    createdAt: NOW - 26 * 3_600_000,
    triggerId: "trg_placeholder01",
    deliveryId: "77be0a42-4a62-11f1-8d3a-placeholder",
    refusal: {
      code: "TriggerFieldMissing",
      detail:
        "The event has no pull_request.merge_commit_sha, which the prompt names. Test the trigger on the payload.",
    },
  },
];

export const TEST_RESULT: TriggerTestResult = {
  matched: false,
  conditions: [
    { field: "repository.full_name", values: ["owner/docs-site"], actual: ['"owner/docs-site"'], holds: true },
    { field: "action", values: ["closed"], actual: ['"closed"'], holds: true },
    { field: "pull_request.merged", values: ["true"], actual: ["false"], holds: false },
    { field: "pull_request.merged_by.login", values: ["placeholder-user"], actual: [], holds: false },
  ],
  prompt:
    "{{pull_request.merged_by.login}} merged https://github.com/owner/docs-site/pull/88 as {{pull_request.merge_commit_sha}}. Review the merged change and open an issue for each problem you find.",
  missingFields: ["pull_request.merged_by.login", "pull_request.merge_commit_sha"],
};

const find = (triggerId: string): Trigger => {
  const found = TRIGGERS.find((item) => item.triggerId === triggerId);
  if (found === undefined) throw new Error(`no trigger fixture ${triggerId}`);
  return found;
};

export const triggerFakes = (): Pick<TumpelApi, TriggerOperation> => ({
  listTriggers: async () => TRIGGERS,
  getTrigger: async (triggerId) => find(triggerId),
  createTrigger: async (created) => ({ ...find("trg_placeholder01"), ...created, triggerId: "trg_placeholder09" }),
  updateTrigger: async (triggerId, patch) => ({ ...find(triggerId), ...patch, updatedAt: Date.now() }),
  deleteTrigger: async () => undefined,
  testTrigger: async () => TEST_RESULT,
  listEvents: async (query) => ({
    events:
      (query.afterEventId ?? 0) < 41
        ? REFUSALS.filter((event) => query.triggerId === undefined || event.triggerId === query.triggerId)
        : [],
    lastEventId: 41,
  }),
});
