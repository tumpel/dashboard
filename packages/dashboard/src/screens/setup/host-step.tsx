import { useMutation } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ProblemBlock, ProblemCard } from "../../components/problem-block";
import { Button } from "../../components/ui/button";
import { useTenantApi } from "../../context";
import { activeHost, formatTime } from "../../fleet";
import { type SetupReads, STEP_TITLES } from "../../setup";
import { installWithToken } from "../enrol-host";
import { CopyBlock, Rows, Status } from "./parts";
import { StepCard, StepSkeleton } from "./wizard";

const TOKEN_SECONDS = 3600;
const LEAD = "Run this on a Linux x86_64 machine with KVM, as a user who can use sudo.";

const formatGib = (bytes: number): string => `${Math.round(bytes / 1024 ** 3)} GiB`;

const useExpiry = (expiresAt: string | null): boolean => {
  const [expired, setExpired] = useState(false);
  useEffect(() => {
    setExpired(false);
    if (expiresAt === null) return;
    const left = Date.parse(expiresAt) - Date.now();
    if (left <= 0) {
      setExpired(true);
      return;
    }
    const timer = window.setTimeout(() => setExpired(true), left);
    return () => window.clearTimeout(timer);
  }, [expiresAt]);
  return expired;
};

export const HostStep = ({ tenantId, reads }: { tenantId: string; reads: SetupReads }) => {
  const api = useTenantApi(tenantId);
  const mint = useMutation({ mutationFn: () => api.mintEnrolmentToken(TOKEN_SECONDS) });
  const expired = useExpiry(mint.data?.enrolmentToken.expiresAt ?? null);
  const { hosts } = reads;
  const host = hosts.data === undefined ? undefined : activeHost(hosts.data);
  const body = () => {
    if (hosts.isPending) return <StepSkeleton pending />;
    if (hosts.isError) return <ProblemBlock error={hosts.error} onRetry={() => void hosts.refetch()} />;
    if (host !== undefined) {
      return (
        <>
          <Status kind="Done" title={`${host.name} is ${host.state}`}>
            {host.state === "Online"
              ? "Sessions can now run on this host."
              : "Sessions run on this host once it is Online."}
          </Status>
          <Rows
            rows={[
              ["Host", host.name],
              ["CPUs", String(host.cpuCount)],
              ["Memory", formatGib(host.memoryBytes)],
            ]}
          />
          <Link
            to="/t/$tenantId/hosts"
            params={{ tenantId }}
            search={{ state: [] }}
            className="text-sm underline underline-offset-4"
          >
            Add another host on the Hosts page
          </Link>
        </>
      );
    }
    if (mint.isError) return <ProblemBlock error={mint.error} onRetry={() => mint.mutate()} />;
    if (!mint.isSuccess) {
      return (
        <Button
          className="justify-self-start max-sm:h-12 max-sm:w-full"
          aria-busy={mint.isPending}
          disabled={mint.isPending}
          onClick={() => mint.mutate()}
        >
          {mint.isPending ? "Minting a token..." : "Show the install command"}
        </Button>
      );
    }
    const until = formatTime(Date.parse(mint.data.enrolmentToken.expiresAt));
    if (expired) {
      return (
        <ProblemCard
          wording={{
            title: "The enrolment token expired",
            detail: `The token in this command stopped working at ${until}. The install would fail with EnrolmentTokenExpired.`,
            fix: "Mint a new token and run the new command.",
          }}
          onRetry={() => mint.mutate()}
          retryLabel="Mint a new token"
        />
      );
    }
    return (
      <>
        <CopyBlock text={installWithToken(mint.data)} label="Copy command" noun="command" />
        <p className="text-sm text-muted-foreground">The token in this command works once. It expires {until}.</p>
        <Status kind="Waiting" title="Waiting for a host">
          This page checks again when you come back to it.
        </Status>
        <Button
          variant="outline"
          className="justify-self-start max-sm:h-12 max-sm:w-full"
          onClick={() => void hosts.refetch()}
        >
          Check now
        </Button>
      </>
    );
  };
  return (
    <StepCard
      tenantId={tenantId}
      step="host"
      title={STEP_TITLES.host}
      lead={host === undefined ? LEAD : undefined}
      done={host !== undefined}
      busy={hosts.isPending || mint.isPending}
      announce={host === undefined ? null : `${host.name} is ${host.state}`}
    >
      {body()}
    </StepCard>
  );
};
