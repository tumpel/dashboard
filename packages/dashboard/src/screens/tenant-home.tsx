import { Navigate } from "@tanstack/react-router";
import { Skeleton } from "../components/ui/skeleton";
import { CHECKED_STEPS, openSteps, useSetupReads } from "../setup";

export const TenantHome = ({ tenantId }: { tenantId: string }) => {
  const { states } = useSetupReads(tenantId);
  if (CHECKED_STEPS.some((step) => states[step].kind === "Loading")) {
    return <Skeleton aria-busy className="h-40 w-full" />;
  }
  if (openSteps(states).length > 0) {
    return <Navigate to="/t/$tenantId/setup" params={{ tenantId }} replace />;
  }
  return <Navigate to="/t/$tenantId/overview" params={{ tenantId }} replace />;
};
