import {
  CompactTranscriptPageSchema,
  CompletedTurnSchema,
  ConnectorAuthorizationFailedSchema,
  ConnectorStatusSchema,
  EventPageSchema,
  FailedTurnSchema,
  HostHealthChangedEventSchema,
  OAuthConnectorSchema,
  OfferedTurnSchema,
  OpenRouterAuthorizationFailedSchema,
  OpenRouterAuthorizationSchema,
  PrebuildFailedEventSchema,
  RawTranscriptPageSchema,
  RunningTurnSchema,
  SessionSchema,
  StartedSessionFromIssueSchema,
  StartedSessionSchema,
  StaticConnectorSchema,
  SubscriptionEndedEventSchema,
  SubscriptionPausedEventSchema,
  TenantEventEnvelopeSchema,
  TenantEventSchema,
  TriggerStartRefusedEventSchema,
  TurnBaseSchema,
  TurnFailedEventSchema,
  TurnStateSchema,
  UsageLimitReachedEventSchema,
  UsageNearLimitEventSchema,
} from "@tumpel/schemas";
import { z } from "zod";
import { serviceUpdate } from "../service-update.ts";

const unrecognised = (): "Unrecognised" => {
  serviceUpdate.report();
  return "Unrecognised";
};

const enumView = <T extends string>(schema: z.ZodType<T>): z.ZodType<T | "Unrecognised"> =>
  z.union([schema, z.string().transform(unrecognised)]);

const variantView = <T, F>(schema: z.ZodType<T>, fallback: (data: unknown) => F | undefined): z.ZodType<T | F> =>
  z.unknown().transform((data, context) => {
    const result = schema.safeParse(data);
    if (result.success) return result.data;
    const [issue] = result.error.issues;
    const key = issue?.path[0];
    if (
      result.error.issues.length === 1 &&
      issue?.code === "invalid_union" &&
      issue.errors.length === 0 &&
      issue.path.length === 1 &&
      key !== undefined &&
      typeof data === "object" &&
      data !== null &&
      typeof Reflect.get(data, key) === "string"
    ) {
      const replacement = fallback(data);
      if (replacement !== undefined) return replacement;
    }
    for (const issue of result.error.issues) context.addIssue({ ...issue });
    return z.NEVER;
  });

const connectorStatus = variantView(
  z.discriminatedUnion("state", [
    ConnectorAuthorizationFailedSchema.extend({ reason: enumView(ConnectorAuthorizationFailedSchema.shape.reason) }),
    ...ConnectorStatusSchema.options.filter((schema) => schema !== ConnectorAuthorizationFailedSchema),
  ]),
  () => ({ state: unrecognised() }),
);
export const ConnectorViewSchema = z.discriminatedUnion("auth", [
  StaticConnectorSchema.extend({ status: connectorStatus }),
  OAuthConnectorSchema.extend({ status: connectorStatus }),
]);
export const OpenRouterAuthorizationViewSchema = OpenRouterAuthorizationSchema.extend({
  status: variantView(
    z.discriminatedUnion("state", [
      OpenRouterAuthorizationFailedSchema.extend({
        reason: enumView(OpenRouterAuthorizationFailedSchema.shape.reason),
      }),
      ...OpenRouterAuthorizationSchema.shape.status.options.filter(
        (schema) => schema !== OpenRouterAuthorizationFailedSchema,
      ),
    ]),
    () => ({ state: unrecognised() }),
  ),
});

export const TurnViewSchema = z.preprocess(
  (data) =>
    typeof data === "object" &&
    data !== null &&
    "state" in data &&
    typeof data.state === "string" &&
    !TurnStateSchema.safeParse(data.state).success
      ? { ...data, state: unrecognised() }
      : data,
  z.discriminatedUnion("state", [
    OfferedTurnSchema,
    RunningTurnSchema,
    CompletedTurnSchema,
    FailedTurnSchema.extend({ reason: enumView(FailedTurnSchema.shape.reason) }),
    TurnBaseSchema.extend({ state: z.literal("Unrecognised") }),
  ]),
);
const sessionState = enumView(SessionSchema.shape.state);
export const SessionViewSchema = SessionSchema.extend({
  state: sessionState,
  lastTurnState: enumView(TurnStateSchema),
  lastTurn: TurnViewSchema,
});

export const StartedSessionViewSchema = StartedSessionSchema.extend({
  session: SessionViewSchema,
  turn: TurnViewSchema,
});
export const StartedSessionFromIssueViewSchema = StartedSessionFromIssueSchema.extend({
  session: SessionViewSchema,
  turn: TurnViewSchema,
});

export const TranscriptPageViewSchema = z.discriminatedUnion("form", [
  RawTranscriptPageSchema.extend({ sessionState }),
  CompactTranscriptPageSchema.extend({ sessionState }),
]);

const refusal = TriggerStartRefusedEventSchema.shape.refusal;
const usage = UsageNearLimitEventSchema.shape;
const usageValues = { tier: enumView(usage.tier), measure: enumView(usage.measure), window: enumView(usage.window) };
const eventVariants = [
  HostHealthChangedEventSchema.extend({ health: enumView(HostHealthChangedEventSchema.shape.health) }),
  PrebuildFailedEventSchema.extend({ phase: enumView(PrebuildFailedEventSchema.shape.phase) }),
  SubscriptionEndedEventSchema.extend({ reason: enumView(SubscriptionEndedEventSchema.shape.reason) }),
  SubscriptionPausedEventSchema.extend({
    reason: variantView(SubscriptionPausedEventSchema.shape.reason, () => ({ kind: unrecognised() })),
  }),
  TriggerStartRefusedEventSchema.extend({ refusal: refusal.extend({ code: enumView(refusal.shape.code) }) }),
  TurnFailedEventSchema.extend({ reason: enumView(TurnFailedEventSchema.shape.reason) }),
  UsageNearLimitEventSchema.extend(usageValues),
  UsageLimitReachedEventSchema.extend(usageValues),
] as const;
const eventNames = new Set<string>(eventVariants.map((schema) => schema.shape.event.value));
export const EventViewSchema = variantView(
  z.discriminatedUnion("event", [
    ...eventVariants,
    ...TenantEventSchema.options.filter((schema) => !eventNames.has(schema.shape.event.value)),
  ]),
  (data) => {
    if (!TenantEventEnvelopeSchema.safeParse(data).success) return undefined;
    unrecognised();
    return null;
  },
);

export const EventPageViewSchema = EventPageSchema.extend({
  events: EventViewSchema.array()
    .max(100)
    .transform((events) => events.filter((event) => event !== null)),
});
