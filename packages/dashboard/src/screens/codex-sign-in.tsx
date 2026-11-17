import type { ReactNode } from "react";
import { Button } from "../components/ui/button";
import type { ClaudeSetupFlow } from "../queries";
import { ClaudeSetupPanel } from "./claude-setup";

const button = "justify-self-start max-sm:h-12 max-sm:w-full";

export const CodexSignIn = ({
  flow,
  next,
  closeLabel = "Cancel",
}: {
  flow: ClaudeSetupFlow;
  next: ReactNode;
  closeLabel?: string;
}) => {
  if (flow.active) return <ClaudeSetupPanel flow={flow} next={next} closeLabel={closeLabel} />;
  return (
    <>
      <p className="text-sm">Sign in with your ChatGPT account.</p>
      <p className="text-sm">A short-lived box on one of your hosts runs codex login.</p>
      <p className="text-sm">Your Codex login is stored here as CODEX_AUTH_JSON.</p>
      <Button type="button" variant="outline" className={button} onClick={() => flow.start.mutate()}>
        Sign in to Codex
      </Button>
    </>
  );
};
