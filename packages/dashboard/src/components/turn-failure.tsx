import type { Turn } from "../api/port";
import { ProblemCard } from "./problem-block";

export const TurnFailureBlock = ({ label, turn }: { label: string; turn: Extract<Turn, { state: "Failed" }> }) =>
  turn.reason === "Unrecognised" ? (
    <p role="status">This dashboard doesn't recognise what the service sent. Reload to update.</p>
  ) : (
    <ProblemCard
      wording={{
        title: `${label} failed: ${turn.reason}`,
        detail: turn.detail,
        fix: "Fix what the detail names, then send the next prompt to start a new turn.",
      }}
    />
  );
