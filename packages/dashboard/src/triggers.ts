import { GitHubTriggerEventSchema } from "@tumpel/schemas";
import type {
  Session,
  TenantEvent,
  TriggerCondition,
  TriggerEvent,
  TriggerSource,
  TriggerStartRefused,
} from "./api/port";

export const TRIGGER_EVENTS = GitHubTriggerEventSchema.options;

export interface Preset {
  label: string;
  field: string;
  suggestions: readonly string[];
}

const preset = (label: string, field: string, suggestions: readonly string[] = []): Preset => ({
  label,
  field,
  suggestions,
});

const REPOSITORY = preset("Repository", "repository.full_name");
const SENDER = preset("Who did it", "sender.login");
const LABEL = preset("Label", "label.name");
const BOOLEAN = ["true", "false"];

export const PRESETS: Record<TriggerEvent, readonly Preset[]> = {
  pull_request: [
    REPOSITORY,
    preset("Action", "action", ["opened", "closed", "reopened", "synchronize", "ready_for_review", "labeled"]),
    preset("Merged", "pull_request.merged", BOOLEAN),
    preset("Author", "pull_request.user.login"),
    SENDER,
    preset("Merged by", "pull_request.merged_by.login"),
    preset("Base branch", "pull_request.base.ref"),
    preset("Head branch", "pull_request.head.ref"),
    LABEL,
    preset("Draft", "pull_request.draft", BOOLEAN),
  ],
  push: [REPOSITORY, preset("Ref", "ref", ["refs/heads/main"]), preset("Pusher", "pusher.name"), SENDER],
  status: [
    REPOSITORY,
    preset("Context", "context"),
    preset("State", "state", ["pending", "success", "failure", "error"]),
    SENDER,
  ],
  issues: [
    REPOSITORY,
    preset("Action", "action", ["opened", "labeled", "closed", "reopened", "assigned"]),
    LABEL,
    preset("Author", "issue.user.login"),
    SENDER,
  ],
};

const PROMPT_FIELDS: Record<TriggerEvent, readonly string[]> = {
  pull_request: [
    "pull_request.html_url",
    "pull_request.number",
    "pull_request.head.sha",
    "pull_request.merge_commit_sha",
  ],
  push: ["after", "compare"],
  status: ["sha", "target_url"],
  issues: ["issue.html_url", "issue.number", "issue.title"],
};

export const promptFields = (event: TriggerEvent): string[] => [
  ...PROMPT_FIELDS[event],
  ...PRESETS[event].map((item) => item.field),
];

export const presetOf = (event: TriggerEvent, field: string): Preset | undefined =>
  PRESETS[event].find((item) => item.field === field);

export const conditionLabel = (event: TriggerEvent, field: string): string => presetOf(event, field)?.label ?? field;

const conditionText = (event: TriggerEvent, condition: TriggerCondition): string => {
  const values = condition.values.join(" or ");
  if (condition.field === REPOSITORY.field) return values;
  return `${conditionLabel(event, condition.field)} ${values}`;
};

export const filterSummary = (source: TriggerSource): string =>
  source.conditions.length === 0
    ? `Every ${source.event} event`
    : source.conditions.map((condition) => conditionText(source.event, condition)).join(" · ");

export const isRefusal = (event: TenantEvent): event is TriggerStartRefused => event.event === "TriggerStartRefused";

export type Run =
  | { kind: "Session"; at: number; deliveryId: string; session: Session }
  | { kind: "Refused"; at: number; deliveryId: string; refused: TriggerStartRefused };

export const runsOf = (
  triggerId: string,
  sessions: readonly Session[],
  refusals: readonly TriggerStartRefused[],
): Run[] => {
  const started = sessions.flatMap((session): Run[] =>
    session.startedBy.kind === "Trigger" && session.startedBy.triggerId === triggerId
      ? [{ kind: "Session", at: session.createdAt, deliveryId: session.startedBy.deliveryId, session }]
      : [],
  );
  const refused = refusals
    .filter((event) => event.triggerId === triggerId)
    .map((event): Run => ({ kind: "Refused", at: event.createdAt, deliveryId: event.deliveryId, refused: event }));
  return [...started, ...refused].sort((left, right) => right.at - left.at);
};

export const shortDelivery = (deliveryId: string): string =>
  deliveryId.length > 8 ? `${deliveryId.slice(0, 4)}…` : deliveryId;

export type ParsedPayload = { ok: true; payload: Record<string, unknown> } | { ok: false; reason: string };

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

export const parsePayload = (text: string): ParsedPayload => {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch (error) {
    return { ok: false, reason: `The payload is not JSON: ${error instanceof Error ? error.message : String(error)}.` };
  }
  if (!isObject(value)) return { ok: false, reason: "The payload must be a JSON object, as GitHub sends it." };
  return { ok: true, payload: value };
};
