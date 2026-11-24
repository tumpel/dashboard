import {
  CompactTranscriptPageSchema,
  ConnectorAuthorizationFailedSchema,
  ConnectorStatusSchema,
  EventPageSchema,
  FailedTurnSchema,
  OAuthConnectorSchema,
  OpenRouterAuthorizationFailedSchema,
  OpenRouterAuthorizationSchema,
  PrebuildFailedEventSchema,
  RawTranscriptPageSchema,
  SessionBaseSchema,
  SessionOriginSchema,
  SessionPrebuildLayerAbsentSchema,
  SessionPrebuildLayerSchema,
  SessionSchema,
  SessionStartedBySchema,
  SessionStateSchema,
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
  TurnImageSchema,
  TurnSchema,
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

const variantView = <K extends string, T, F>(
  schema: z.ZodType<T> & { options: readonly { shape: Record<K, { value: string }> }[] },
  key: K,
  fallback: z.ZodType<F>,
): z.ZodType<T | F> => {
  const known = new Set(schema.options.map((option) => option.shape[key].value));
  return z.unknown().transform((data, context) => {
    const name: unknown = typeof data === "object" && data !== null ? Reflect.get(data, key) : undefined;
    const chosen = typeof name === "string" && !known.has(name) ? fallback : schema;
    const result = chosen.safeParse(data);
    if (result.success) return result.data;
    for (const issue of result.error.issues) context.addIssue({ ...issue });
    return z.NEVER;
  });
};

const unknownState = z.object({ state: z.string().transform(unrecognised) });
const unknownKind = z.object({ kind: z.string().transform(unrecognised) });
const connectorStatus = variantView(
  z.discriminatedUnion("state", [
    ConnectorAuthorizationFailedSchema.extend({ reason: enumView(ConnectorAuthorizationFailedSchema.shape.reason) }),
    ...ConnectorStatusSchema.options.filter((schema) => schema !== ConnectorAuthorizationFailedSchema),
  ]),
  "state",
  unknownState,
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
    "state",
    unknownState,
  ),
});

const turnImage = variantView(TurnImageSchema, "kind", unknownKind).optional();
const failedTurn = FailedTurnSchema.extend({ reason: enumView(FailedTurnSchema.shape.reason), image: turnImage });
export const TurnViewSchema = variantView(
  z.discriminatedUnion("state", [
    failedTurn,
    ...TurnSchema.options
      .filter((schema) => schema !== FailedTurnSchema)
      .map((schema) => schema.extend({ image: turnImage })),
  ]),
  "state",
  TurnBaseSchema.extend({ state: unknownState.shape.state, image: turnImage }),
);

const sessionState = enumView(SessionStateSchema);
const prebuildLayer = variantView(
  z.discriminatedUnion("layer", [
    SessionPrebuildLayerAbsentSchema.extend({ reason: enumView(SessionPrebuildLayerAbsentSchema.shape.reason) }),
    ...SessionPrebuildLayerSchema.options.filter((schema) => schema !== SessionPrebuildLayerAbsentSchema),
  ]),
  "layer",
  z.object({ layer: z.string().transform(unrecognised) }),
).optional();
const sessionFields = {
  harness: enumView(SessionBaseSchema.shape.harness),
  boxRetention: enumView(SessionBaseSchema.shape.boxRetention),
  origin: variantView(SessionOriginSchema, "kind", unknownKind),
  startedBy: variantView(SessionStartedBySchema, "kind", unknownKind),
  lastTurnState: enumView(TurnStateSchema),
  lastTurn: TurnViewSchema,
  lastTurnImage: turnImage,
  prebuildLayer,
};
const [firstSessionState, ...otherSessionStates] = SessionSchema.options;
export const SessionViewSchema = variantView(
  z.discriminatedUnion("state", [
    firstSessionState.extend(sessionFields),
    ...otherSessionStates.map((schema) => schema.extend(sessionFields)),
  ]),
  "state",
  SessionBaseSchema.extend({ ...sessionFields, state: unknownState.shape.state }),
);

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
  PrebuildFailedEventSchema.extend({ phase: enumView(PrebuildFailedEventSchema.shape.phase) }),
  SubscriptionEndedEventSchema.extend({ reason: enumView(SubscriptionEndedEventSchema.shape.reason) }),
  SubscriptionPausedEventSchema.extend({
    reason: variantView(SubscriptionPausedEventSchema.shape.reason, "kind", unknownKind),
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
  "event",
  TenantEventEnvelopeSchema.transform(() => {
    unrecognised();
    return null;
  }),
);

export const EventPageViewSchema = EventPageSchema.extend({
  events: EventViewSchema.array()
    .max(100)
    .transform((events) => events.filter((event) => event !== null)),
});
