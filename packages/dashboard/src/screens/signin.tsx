import { useRouter } from "@tanstack/react-router";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { ApiFailure, type Failure } from "../api/port";
import { Logo } from "../components/logo";
import { ProblemBlock } from "../components/problem-block";
import { Button } from "../components/ui/button";
import { useDashboard } from "../context";
import { switchedPath } from "../lib";

const Bare = ({ children }: { children: ReactNode }) => (
  <div className="min-h-dvh bg-background">
    <header className="flex h-14 items-center border-b bg-card px-4">
      <Logo />
    </header>
    <main className="mx-auto grid max-w-xl gap-4 px-4 py-16">{children}</main>
  </div>
);

const Status = ({ text, hint }: { text: string; hint?: string }) => (
  <div className="grid justify-items-center gap-2 text-center" aria-live="polite">
    <div className="size-6 animate-spin rounded-full border-2 border-sea border-t-transparent" aria-hidden />
    <p className="font-medium">{text}</p>
    {hint !== undefined && <p className="text-sm text-muted-foreground">{hint}</p>}
  </div>
);

const landingPath = (returnPath: string, tenantId: string): string => {
  if (returnPath === "/") return `/t/${tenantId}/`;
  if (!returnPath.startsWith("/t/")) return returnPath;
  return returnPath.startsWith(`/t/${tenantId}/`) ? returnPath : switchedPath(returnPath, tenantId);
};

export const SignInScreen = ({ returnPath }: { returnPath: string }) => {
  const { ports } = useDashboard();
  const [failure, setFailure] = useState<Failure | null>(null);
  const started = useRef(false);
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void ports.auth.signIn(returnPath).then(setFailure);
  }, [ports, returnPath]);
  if (failure === null) {
    return (
      <Bare>
        <Status text="Signing in through Cloudflare Access..." hint="This page moves on by itself." />
      </Bare>
    );
  }
  return (
    <Bare>
      <ProblemBlock
        error={new ApiFailure(failure)}
        actions={
          <Button size="sm" onClick={() => window.location.reload()}>
            Sign in again
          </Button>
        }
      />
    </Bare>
  );
};

export const CallbackScreen = () => {
  const { ports } = useDashboard();
  const router = useRouter();
  const [failure, setFailure] = useState<Failure | null>(null);
  const started = useRef(false);
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const params = new URLSearchParams(router.state.location.searchStr);
    router.history.replace(router.state.location.pathname);
    void ports.auth.finishSignIn(params).then((outcome) => {
      if (!outcome.ok) {
        setFailure(outcome.failure);
        return;
      }
      router.history.replace(landingPath(outcome.returnPath, outcome.tenantId));
    });
  }, [ports, router]);
  if (failure === null) {
    return (
      <Bare>
        <Status text="Finishing sign-in..." />
      </Bare>
    );
  }
  return (
    <Bare>
      <ProblemBlock
        error={new ApiFailure(failure)}
        actions={
          <Button size="sm" onClick={() => void ports.auth.signIn("/").then(setFailure)}>
            Sign in again
          </Button>
        }
      />
    </Bare>
  );
};
