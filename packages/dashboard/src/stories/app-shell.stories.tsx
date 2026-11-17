import type { Meta, StoryObj } from "@storybook/react-vite";
import { fakeApi, never, problem, StoryApp, signedOutFailure, tenantPath, unreachable } from "./harness";

const meta: Meta<typeof StoryApp> = { title: "Dashboard/Shell/AppShell", component: StoryApp };
export default meta;

type Story = StoryObj<typeof StoryApp>;

export const Desktop: Story = { args: { path: tenantPath("/overview") } };

export const SignedOut: Story = {
  args: {
    path: tenantPath("/hosts"),
    api: fakeApi({
      whoami: () => Promise.reject(signedOutFailure),
      listHosts: () => Promise.reject(signedOutFailure),
      listHostUsage: never,
    }),
  },
};

export const Forbidden: Story = {
  args: {
    path: tenantPath("/hosts"),
    api: fakeApi({
      listHosts: () =>
        Promise.reject(
          problem(
            403,
            "Forbidden",
            "Owners only",
            "Your role is Member. Only an Owner can list hosts.",
            "Ask an Owner of this tenant.",
          ),
        ),
    }),
  },
};

export const Unreachable: Story = {
  args: {
    path: tenantPath("/hosts"),
    api: fakeApi({
      listHosts: () => Promise.reject(unreachable("Hosts_list")),
      listHostUsage: () => Promise.reject(unreachable("Hosts_listUsage")),
    }),
  },
};

export const PhoneMoreSheet: Story = {
  args: { path: tenantPath("/overview#more") },
  globals: { viewport: { value: "mobile1", isRotated: false } },
};
