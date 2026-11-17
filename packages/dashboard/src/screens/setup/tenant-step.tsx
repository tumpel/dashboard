import { ProblemBlock } from "../../components/problem-block";
import { type SetupReads, STEP_TITLES } from "../../setup";
import { Status } from "./parts";
import { StepCard, StepSkeleton } from "./wizard";

export const TenantStep = ({ tenantId, reads }: { tenantId: string; reads: SetupReads }) => {
  const { whoami } = reads;
  return (
    <StepCard
      tenantId={tenantId}
      step="tenant"
      title={STEP_TITLES.tenant}
      done={whoami.isSuccess}
      busy={whoami.isPending}
      announce={null}
    >
      {whoami.isPending && <StepSkeleton pending />}
      {whoami.isError && <ProblemBlock error={whoami.error} onRetry={() => void whoami.refetch()} />}
      {whoami.isSuccess && (
        <Status kind="Done" title="Tenant created">
          {whoami.data.tenant.name}. You are its {whoami.data.principal.role}.
        </Status>
      )}
    </StepCard>
  );
};
