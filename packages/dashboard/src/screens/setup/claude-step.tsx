import { ExternalLinkIcon } from "lucide-react";
import { useState } from "react";
import { ProblemBlock } from "../../components/problem-block";
import { Button } from "../../components/ui/button";
import { useDashboard } from "../../context";
import { formatTime, mcpUrl } from "../../fleet";
import { claudeGrant, type SetupReads, STEP_TITLES } from "../../setup";
import { CopyBlock, Status } from "./parts";
import { StepCard, StepSkeleton } from "./wizard";

export const CONNECTORS_URL = "https://claude.ai/settings/connectors";

export const ClaudeStep = ({ tenantId, reads }: { tenantId: string; reads: SetupReads }) => {
  const { ports } = useDashboard();
  const url = mcpUrl(ports.apiOrigin);
  const [started, setStarted] = useState(false);
  const { grants } = reads;
  const grant = grants.data === undefined ? undefined : claudeGrant(grants.data);
  const check = () => void grants.refetch();
  const body = () => {
    if (grant !== undefined) {
      return (
        <Status kind="Done" title="claude.ai connected">
          Claude signed in {formatTime(grant.lastIssuedAt)}.
        </Status>
      );
    }
    return (
      <>
        <CopyBlock text={url} label="Copy URL" noun="URL" onCopy={() => setStarted(true)} />
        {grants.isPending && <StepSkeleton pending />}
        {grants.isError && <ProblemBlock error={grants.error} onRetry={check} />}
        {grants.isSuccess && started && (
          <>
            <Status kind="Waiting" title="Waiting for claude.ai to sign in">
              This page checks again when you come back to it. If claude.ai says the connector failed, remove it there
              and add it again.
            </Status>
            <Button variant="outline" className="justify-self-start max-sm:h-12 max-sm:w-full" onClick={check}>
              Check now
            </Button>
          </>
        )}
        {grants.isSuccess && !started && (
          <>
            <ol className="grid list-decimal gap-1 pl-5 text-sm">
              <li>In claude.ai, open Settings, then Connectors.</li>
              <li>Choose Add custom connector and paste the URL. Leave the client ID and secret empty.</li>
              <li>Choose Connect and approve Tumpel's sign-in page.</li>
            </ol>
            <Button variant="outline" className="justify-self-start max-sm:h-12 max-sm:w-full" asChild>
              <a href={CONNECTORS_URL} target="_blank" rel="noreferrer" onClick={() => setStarted(true)}>
                Open claude.ai settings
                <ExternalLinkIcon aria-hidden />
              </a>
            </Button>
          </>
        )}
      </>
    );
  };
  return (
    <StepCard
      tenantId={tenantId}
      step="claude"
      title={STEP_TITLES.claude}
      lead={
        grant === undefined
          ? "Add Tumpel to claude.ai as a custom connector. You then start and steer sessions from a chat."
          : undefined
      }
      done={grant !== undefined}
      busy={grants.isPending}
      announce="claude.ai connected"
    >
      {body()}
    </StepCard>
  );
};
