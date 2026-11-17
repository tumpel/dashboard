import { useLocation, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { ApiFailure, type Failure } from "../api/port";
import { ProblemBlock } from "../components/problem-block";
import { useDashboard } from "../context";
import { switchedPath } from "../lib";

export interface SwitchTarget {
  tenantId: string;
  name: string;
}

export interface Switching {
  target: SwitchTarget;
  failure: Failure | null;
}

export const useSwitchTenant = (
  tenantId: string,
): {
  switching: Switching | null;
  holdsToken: (target: SwitchTarget) => boolean;
  switchTo: (target: SwitchTarget) => void;
} => {
  const { ports } = useDashboard();
  const navigate = useNavigate();
  const pathname = useLocation({ select: (location) => location.pathname });
  const [switching, setSwitching] = useState<Switching | null>(null);
  const holdsToken = (target: SwitchTarget): boolean =>
    ports.auth.signedInTenants().some((tenant) => tenant.tenantId === target.tenantId);
  const switchTo = (target: SwitchTarget): void => {
    if (target.tenantId === tenantId) return;
    const path = switchedPath(pathname, target.tenantId);
    if (holdsToken(target)) {
      void navigate({ to: path });
      return;
    }
    setSwitching({ target, failure: null });
    void ports.auth.signIn(path).then((failure) => setSwitching({ target, failure }));
  };
  return { switching, holdsToken, switchTo };
};

export const SwitchingNotice = ({ switching, onRetry }: { switching: Switching; onRetry: () => void }) => {
  if (switching.failure !== null) {
    return <ProblemBlock error={new ApiFailure(switching.failure)} onRetry={onRetry} retryLabel="Sign in again" />;
  }
  return (
    <div role="status" aria-live="polite" className="rounded-lg border bg-card p-4 text-sm">
      <p className="font-semibold">Signing in to {switching.target.name} through Cloudflare Access...</p>
      <p className="text-muted-foreground">
        A sign-in acts in one tenant. Choose {switching.target.name} on the consent page; this page moves on by itself.
      </p>
    </div>
  );
};
