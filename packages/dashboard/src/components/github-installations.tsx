import { useMutation } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ExternalLinkIcon } from "lucide-react";
import { useTenantApi } from "../context";
import { type GitHubReturn, refusalWording } from "../github-return";
import { installationSettingsUrl } from "../github-settings";
import { useGitHubInstallations } from "../queries";
import { ProblemBlock, ProblemCard } from "./problem-block";
import { Button } from "./ui/button";
import { Skeleton } from "./ui/skeleton";

const ReturnProblem = ({ returned, onClose }: { returned: GitHubReturn; onClose: () => void }) => {
  if (returned.kind === "None") return null;
  const wording =
    returned.kind === "Failed"
      ? {
          title: "GitHub did not confirm the installation",
          detail: returned.detail,
          fix: "Choose Add new to try again. Report it when it repeats.",
        }
      : { title: `Tumpel did not link ${returned.account}`, ...refusalWording(returned.reason, returned.account) };
  return (
    <ProblemCard
      wording={wording}
      actions={
        <Button size="sm" variant="outline" onClick={onClose}>
          Close
        </Button>
      }
    />
  );
};

const AddNew = ({ tenantId, returnUrl }: { tenantId: string; returnUrl: string }) => {
  const api = useTenantApi(tenantId);
  const start = useMutation({
    mutationFn: () => api.startGitHubConnection(returnUrl, null),
    onSuccess: (started) => window.location.assign(started.installUrl),
  });
  return (
    <div className="grid gap-2">
      {start.isError && <ProblemBlock error={start.error} onRetry={() => start.mutate()} retryLabel="Try again" />}
      <Button
        className="justify-self-start max-sm:h-12 max-sm:w-full"
        disabled={start.isPending}
        aria-busy={start.isPending}
        onClick={() => start.mutate()}
      >
        {start.isPending ? "Opening GitHub..." : "Add new"}
      </Button>
    </div>
  );
};

export const GitHubInstallations = ({
  tenantId,
  owner,
  returned,
  returnUrl,
  onClear,
  disconnect,
}: {
  tenantId: string;
  owner: boolean;
  returned: GitHubReturn;
  returnUrl: string;
  onClear: () => void;
  disconnect: boolean;
}) => {
  const installations = useGitHubInstallations(tenantId);
  const rows = () => {
    if (installations.isPending) {
      return (
        <div aria-busy className="grid gap-2">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      );
    }
    if (installations.isError) {
      return (
        <ProblemBlock error={installations.error} onRetry={() => void installations.refetch()} retryLabel="Try again" />
      );
    }
    if (installations.data.length === 0) return <p>No GitHub accounts connected.</p>;
    return (
      <ul className="grid gap-2" aria-label="Connected GitHub accounts">
        {installations.data.map((installation) => (
          <li key={installation.installationId} className="flex items-center gap-3 rounded-md border p-2">
            <a
              className="inline-flex items-center gap-1 font-medium underline-offset-4 hover:underline"
              href={installationSettingsUrl(installation)}
              target="_blank"
              rel="noreferrer"
            >
              {installation.accountLogin}
              <ExternalLinkIcon aria-hidden className="size-3.5" />
            </a>
            {disconnect && owner && (
              <Button asChild variant="outline" size="sm" className="ml-auto">
                <Link to="." hash={`disconnect-github-${installation.installationId}`} search={(search) => search}>
                  Disconnect
                </Link>
              </Button>
            )}
          </li>
        ))}
      </ul>
    );
  };
  return (
    <div className="grid gap-3">
      <ReturnProblem returned={returned} onClose={onClear} />
      {rows()}
      {owner && <AddNew tenantId={tenantId} returnUrl={returnUrl} />}
    </div>
  );
};
