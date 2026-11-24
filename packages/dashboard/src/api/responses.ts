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
} from "@tumpel/schemas";
import { z } from "zod";
import { serviceUpdate } from "../service-update";

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
    if (unknownValues(result.error.issues, data)) {
      serviceUpdate.report();
      return { state: "Unrecognised" };
    }
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

export const TurnViewSchema = z.discriminatedUnion("state", [
  OfferedTurnSchema,
  RunningTurnSchema,
  CompletedTurnSchema,
  FailedTurnSchema.extend({
    reason: z.union([
      FailedTurnSchema.shape.reason,
      z.string().transform(() => {
        serviceUpdate.report();
        return "Unrecognised" as const;
      }),
    ]),
  }),
]);
export const SessionViewSchema = SessionSchema.extend({ lastTurn: TurnViewSchema });

export const StartedSessionViewSchema = StartedSessionSchema.extend({
  session: SessionViewSchema,
  turn: TurnViewSchema,
});
export const StartedSessionFromIssueViewSchema = StartedSessionFromIssueSchema.extend({
  session: SessionViewSchema,
  turn: TurnViewSchema,
});
