import { Link } from "@tanstack/react-router";
import type { Member, Session, Trigger } from "../api/port";
import { shortDelivery } from "../triggers";

const triggerName = (triggers: readonly Trigger[], triggerId: string): string =>
  triggers.find((trigger) => trigger.triggerId === triggerId)?.name ?? triggerId;

export const StartedBy = ({
  tenantId,
  startedBy,
  members,
  triggers,
}: {
  tenantId: string;
  startedBy: Session["startedBy"];
  members: readonly Member[];
  triggers: readonly Trigger[];
}) => {
  if (startedBy.kind === "Unrecognised") return <>Unrecognised</>;
  if (startedBy.kind === "Person") {
    return <>{members.find((member) => member.principalId === startedBy.principalId)?.email ?? "A person"}</>;
  }
  if (startedBy.kind === "Turn") {
    return (
      <Link
        to="/t/$tenantId/sessions/$sessionId"
        params={{ tenantId, sessionId: startedBy.sessionId }}
        className="hover:underline"
      >
        Another session
      </Link>
    );
  }
  return (
    <Link
      to="/t/$tenantId/triggers/$triggerId"
      params={{ tenantId, triggerId: startedBy.triggerId }}
      className="hover:underline"
    >
      Trigger {triggerName(triggers, startedBy.triggerId)}
    </Link>
  );
};

export const TriggerOriginNote = ({
  tenantId,
  startedBy,
  triggers,
}: {
  tenantId: string;
  startedBy: Session["startedBy"];
  triggers: readonly Trigger[];
}) => {
  if (startedBy.kind !== "Trigger") return null;
  return (
    <p className="mb-4 text-sm text-muted-foreground">
      Started by trigger{" "}
      <Link
        to="/t/$tenantId/triggers/$triggerId"
        params={{ tenantId, triggerId: startedBy.triggerId }}
        className="font-medium text-foreground hover:underline"
      >
        {triggerName(triggers, startedBy.triggerId)}
      </Link>
      , GitHub delivery <span className="font-mono">{shortDelivery(startedBy.deliveryId)}</span>
    </p>
  );
};
