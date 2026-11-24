import {
  CompletedTurnSchema,
  ConnectorStatusSchema,
  FailedTurnSchema,
  OAuthConnectorSchema,
  OfferedTurnSchema,
  OpenRouterAuthorizationSchema,
  RunningTurnSchema,
  SessionSchema,
  StartedSessionFromIssueSchema,
  StartedSessionSchema,
  StaticConnectorSchema,
  TurnBaseSchema,
  TurnStateSchema,
} from "@tumpel/schemas";
import { z } from "zod";
import { serviceUpdate } from "../service-update.ts";

const unrecognised = (): "Unrecognised" => {
  serviceUpdate.report();
  return "Unrecognised";
};

const enumView = <T extends string>(schema: z.ZodType<T>): z.ZodType<T | "Unrecognised"> =>
  z.union([schema, z.string().transform(unrecognised)]);

export const unknownValues = (issues: readonly z.core.$ZodIssue[], data: unknown): boolean =>
  issues.length > 0 &&
  issues.every((issue) => {
    const value = issue.path.reduce<unknown>(
      (node, key) => (typeof node === "object" && node !== null && key in node ? Reflect.get(node, key) : undefined),
      data,
    );
    return (
      typeof value === "string" &&
      ((issue.code === "invalid_union" && issue.errors.length === 0) ||
        (issue.code === "invalid_value" && issue.values.length > 1))
    );
  });

const statusView = <T>(schema: z.ZodType<T>): z.ZodType<T | { state: "Unrecognised" }> =>
  z.unknown().transform((data, context): T | { state: "Unrecognised" } => {
    const result = schema.safeParse(data);
    if (result.success) return result.data;
    if (unknownValues(result.error.issues, data)) return { state: unrecognised() };
    for (const issue of result.error.issues) context.addIssue({ ...issue });
    return z.NEVER;
  });

const connectorStatus = statusView(ConnectorStatusSchema);
export const ConnectorViewSchema = z.discriminatedUnion("auth", [
  StaticConnectorSchema.extend({ status: connectorStatus }),
  OAuthConnectorSchema.extend({ status: connectorStatus }),
]);
export const OpenRouterAuthorizationViewSchema = OpenRouterAuthorizationSchema.extend({
  status: statusView(OpenRouterAuthorizationSchema.shape.status),
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
export const SessionViewSchema = SessionSchema.extend({
  state: enumView(SessionSchema.shape.state),
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
