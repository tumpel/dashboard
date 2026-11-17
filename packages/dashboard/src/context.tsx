import { MutationCache, QueryCache, QueryClient } from "@tanstack/react-query";
import { createContext, type ReactNode, useContext, useSyncExternalStore } from "react";
import { type DashboardPorts, isSignedOut, type TumpelApi } from "./api/port";

export interface SignedOutStore {
  get(): boolean;
  set(value: boolean): void;
  subscribe(listener: () => void): () => void;
}

export const createSignedOutStore = (): SignedOutStore => {
  let value = false;
  const listeners = new Set<() => void>();
  return {
    get: () => value,
    set: (next) => {
      value = next;
      for (const listener of listeners) listener();
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
};

export const createQueryClient = (signedOut: SignedOutStore): QueryClient => {
  const client: QueryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, refetchOnWindowFocus: true },
      mutations: { retry: false },
    },
    queryCache: new QueryCache({ onError: (error) => enterSignedOut(error) }),
    mutationCache: new MutationCache({ onError: (error) => enterSignedOut(error) }),
  });
  const enterSignedOut = (error: unknown): void => {
    if (!isSignedOut(error) || signedOut.get()) return;
    signedOut.set(true);
    client.setDefaultOptions({ queries: { retry: false, enabled: false }, mutations: { retry: false } });
    void client.cancelQueries();
  };
  return client;
};

interface DashboardContextValue {
  ports: DashboardPorts;
  signedOut: SignedOutStore;
}

const DashboardContext = createContext<DashboardContextValue | null>(null);

export const DashboardProvider = ({ value, children }: { value: DashboardContextValue; children: ReactNode }) => (
  <DashboardContext.Provider value={value}>{children}</DashboardContext.Provider>
);

export const useDashboard = (): DashboardContextValue => {
  const value = useContext(DashboardContext);
  if (value === null) throw new Error("useDashboard needs a DashboardProvider above it; wrap the app in one");
  return value;
};

export const useClock = (): (() => number) => useDashboard().ports.now;

export const useTenantApi = (tenantId: string): TumpelApi => useDashboard().ports.apiFor(tenantId);

export const useSignedOut = (): boolean => {
  const { signedOut } = useDashboard();
  return useSyncExternalStore(signedOut.subscribe, signedOut.get);
};
