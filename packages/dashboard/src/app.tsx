import { QueryClientProvider } from "@tanstack/react-query";
import { type RouterHistory, RouterProvider } from "@tanstack/react-router";
import { useState } from "react";
import type { DashboardPorts } from "./api/port";
import { ServiceUpdateNotice } from "./components/service-update-notice";
import { createQueryClient, createSignedOutStore, DashboardProvider } from "./context";
import { createDashboardRouter } from "./router";

export const App = ({ ports, history }: { ports: DashboardPorts; history?: RouterHistory }) => {
  const [state] = useState(() => {
    const signedOut = createSignedOutStore();
    return {
      context: { ports, signedOut },
      queryClient: createQueryClient(signedOut),
      router: createDashboardRouter(history),
    };
  });
  return (
    <DashboardProvider value={state.context}>
      <QueryClientProvider client={state.queryClient}>
        <ServiceUpdateNotice />
        <RouterProvider router={state.router} />
      </QueryClientProvider>
    </DashboardProvider>
  );
};
