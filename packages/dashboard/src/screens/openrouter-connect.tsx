import { useMutation, useQuery } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import type { OpenRouterAuthorizationFailureReason, SecretSet } from "../api/port";
import { UNRECOGNISED_LABEL, type Wording } from "../api/wording";
import { ProblemBlock, ProblemCard } from "../components/problem-block";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { useTenantApi } from "../context";

const FAILURES: Record<OpenRouterAuthorizationFailureReason, Omit<Wording, "detail">> = {
  Unrecognised: { title: UNRECOGNISED_LABEL, fix: "Connect OpenRouter again." },
  AuthorizationTimedOut: {
    title: "OpenRouter did not send you back in time (AuthorizationTimedOut)",
    fix: "Connect OpenRouter again and approve on OpenRouter within 10 minutes.",
  },
  NotConnected: {
    title: "OpenRouter was not connected (NotConnected)",
    fix: "Connect OpenRouter again and choose Authorize on OpenRouter's page.",
  },
  CodeRefused: {
    title: "OpenRouter refused the code (CodeRefused)",
    fix: "Connect OpenRouter again; each code works once, for 10 minutes.",
  },
  ExchangeFailed: {
    title: "OpenRouter minted no key (ExchangeFailed)",
    fix: "Connect OpenRouter again once https://status.openrouter.ai is green.",
  },
  KeyNotStored: {
    title: "The key was not stored (KeyNotStored)",
    fix: "Delete the key on OpenRouter, fix the secret set as the detail says, then connect again.",
  },
};

const holdsOpenRouterKey = (secretSet: SecretSet): boolean =>
  secretSet.keys.some((key) => key.kind === "ApiKey" && key.provider === "OpenRouter");

export const OpenRouterSection = ({
  tenantId,
  secretSet,
  openRouterAuthorizationId,
}: {
  tenantId: string;
  secretSet: SecretSet;
  openRouterAuthorizationId: string | null;
}) => {
  const api = useTenantApi(tenantId);
  const heading = useRef<HTMLHeadingElement>(null);
  const returned = useQuery({
    queryKey: [tenantId, "openRouterAuthorizations", openRouterAuthorizationId],
    queryFn: () => api.getOpenRouterAuthorization(openRouterAuthorizationId ?? ""),
    enabled: openRouterAuthorizationId !== null,
  });
  const authorize = useMutation({
    mutationFn: () => api.authorizeOpenRouter({ secretSetId: secretSet.secretSetId }),
    onSuccess: (authorization) => {
      if (authorization.status.state === "AwaitingCallback") window.location.assign(authorization.status.authorizeUrl);
    },
  });
  const status = returned.data?.status;

  useEffect(() => {
    if (status !== undefined) heading.current?.focus();
  }, [status]);

  const connected = holdsOpenRouterKey(secretSet);
  const authorizing = authorize.isPending || authorize.isSuccess;
  const state = authorizing
    ? "Authorizing"
    : status?.state === "Failed"
      ? "Failed"
      : connected
        ? "Connected"
        : "NotConnected";
  const connect = () => authorize.mutate();
  const connectButton = (label: string, variant: "default" | "outline") => (
    <Button
      className="justify-self-start max-sm:h-12 max-sm:w-full"
      variant={variant}
      disabled={authorizing}
      aria-busy={authorizing}
      onClick={connect}
    >
      {authorizing ? "Opening OpenRouter..." : label}
    </Button>
  );

  const body = () => {
    if (status?.state === "Failed" && !authorizing) {
      const wording = FAILURES[status.reason];
      return (
        <ProblemCard
          wording={{ title: wording.title, detail: status.detail, fix: wording.fix }}
          onRetry={connect}
          retryLabel="Connect OpenRouter again"
        />
      );
    }
    if (state === "Connected") {
      return (
        <>
          <p className="text-sm">
            This set holds OPENROUTER_API_KEY
            {status?.state === "Completed" ? `, labelled ${status.keyLabel} on OpenRouter` : ""}. OpenCode personas on
            it reach OpenRouter's models with it. Delete the key on OpenRouter to revoke it.
          </p>
          {connectButton("Connect again", "outline")}
        </>
      );
    }
    return (
      <>
        <p className="text-sm">
          Get an OpenRouter API key without copying one: OpenRouter asks you to approve, then the key is stored here as
          OPENROUTER_API_KEY. Approve within 10 minutes.
        </p>
        {connectButton("Connect OpenRouter", "default")}
      </>
    );
  };

  return (
    <section className="grid gap-2 rounded-lg border bg-card p-4" aria-label="OpenRouter">
      <div className="flex flex-wrap items-center gap-2">
        <h2 ref={heading} tabIndex={-1} className="font-semibold outline-none">
          OpenRouter
        </h2>
        <Badge variant={state === "Connected" ? "success" : state === "Failed" ? "destructive" : "outline"}>
          {state}
        </Badge>
      </div>
      <p role="status" aria-live="polite" className="sr-only">
        {status?.state === "Completed" ? "OpenRouter connected." : ""}
      </p>
      {authorize.isError && <ProblemBlock error={authorize.error} onRetry={connect} />}
      {returned.isError && <ProblemBlock error={returned.error} onRetry={() => void returned.refetch()} />}
      {body()}
    </section>
  );
};
