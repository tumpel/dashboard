import { useNavigate, useSearch } from "@tanstack/react-router";
import { ExternalLinkIcon } from "lucide-react";
import { GitHubInstallations } from "../../components/github-installations";
import { ProblemBlock, ProblemCard } from "../../components/problem-block";
import { Button } from "../../components/ui/button";
import { gitHubReturnOf, gitHubReturnUrl } from "../../github-return";
import { useGitHubConnection } from "../../queries";
import { type SetupReads, STEP_TITLES } from "../../setup";
import { StepCard, StepSkeleton } from "./wizard";

const AppMissing = ({ setupUrl, onCheck }: { setupUrl: string; onCheck: () => void }) => (
  <ProblemCard
    wording={{
      title: "This stage has no GitHub App",
      detail: "The control plane has no GitHub App to install, so no tenant can connect GitHub yet.",
      fix: "The stage's operator creates the App once at the setup URL. Then choose Check again.",
    }}
    actions={
      <>
        <Button size="sm" asChild>
          <a href={setupUrl} target="_blank" rel="noreferrer">
            Open the setup URL
            <ExternalLinkIcon aria-hidden />
          </a>
        </Button>
        <Button size="sm" variant="outline" onClick={onCheck}>
          Check again
        </Button>
      </>
    }
  />
);

export const GitHubStep = ({ tenantId, reads }: { tenantId: string; reads: SetupReads }) => {
  const navigate = useNavigate();
  const search = useSearch({ from: "/t/$tenantId/setup/$step" });
  const returned = gitHubReturnOf(search);
  const app = useGitHubConnection(tenantId);
  const owner = reads.whoami.data?.principal.role === "Owner";
  const connected = reads.github.data?.connected === true;
  const clear = () =>
    void navigate({
      to: "/t/$tenantId/setup/$step",
      params: { tenantId, step: "github" },
      search: { from: [] },
      replace: true,
    });
  const done = () =>
    void navigate({ to: "/t/$tenantId/setup/$step", params: { tenantId, step: "host" }, search: { from: [] } });
  const body = () => {
    if (app.isPending) return <StepSkeleton pending />;
    if (app.isError) return <ProblemBlock error={app.error} onRetry={() => void app.refetch()} />;
    if (app.data.app.state === "AppMissing") {
      return <AppMissing setupUrl={app.data.app.setupUrl} onCheck={() => void app.refetch()} />;
    }
    return (
      <>
        <p className="text-muted-foreground">Sessions get a short-lived token per turn.</p>
        <GitHubInstallations
          tenantId={tenantId}
          owner={owner}
          returned={returned}
          returnUrl={gitHubReturnUrl(`/t/${tenantId}/setup/github`)}
          onClear={clear}
          disconnect={false}
        />
        {!owner && (
          <p className="text-muted-foreground">Only an Owner adds GitHub accounts. Ask an Owner to add them.</p>
        )}
      </>
    );
  };
  return (
    <StepCard
      tenantId={tenantId}
      step="github"
      title={STEP_TITLES.github}
      lead="Install Tumpel on each account it may work in. GitHub brings you back here after each one."
      done={connected}
      busy={reads.github.isPending}
      announce="GitHub connected"
      footer={
        <Button className="max-sm:h-12 max-sm:flex-1" disabled={!connected} onClick={done}>
          Done
        </Button>
      }
    >
      {body()}
    </StepCard>
  );
};
