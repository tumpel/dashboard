import type { Run } from "../triggers";
import { SessionStateBadge } from "./status-badge";
import { Badge } from "./ui/badge";

export const RunState = ({ run }: { run: Run }) => {
  if (run.kind === "Session") return <SessionStateBadge state={run.session.state} />;
  return (
    <div className="grid justify-items-start gap-0.5">
      <Badge variant="destructive">Refused</Badge>
      <span className="text-xs">{run.refused.refusal.detail}</span>
    </div>
  );
};
