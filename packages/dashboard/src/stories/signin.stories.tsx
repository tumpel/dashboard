import type { Meta, StoryObj } from "@storybook/react-vite";
import { fakeAuth, StoryApp } from "./harness";

const meta: Meta<typeof StoryApp> = { title: "Dashboard/SignIn/SignIn", component: StoryApp };
export default meta;

type Story = StoryObj<typeof StoryApp>;

export const Redirecting: Story = { args: { path: "/signin" } };

export const Finishing: Story = { args: { path: "/auth/callback?code=placeholder&state=placeholder" } };

export const Failed: Story = {
  args: {
    path: "/auth/callback?code=placeholder&state=placeholder",
    auth: fakeAuth({
      finishSignIn: async () => ({
        ok: false,
        failure: {
          kind: "Problem",
          status: 400,
          problem: {
            code: "InvalidRequest",
            title: "Sign-in did not finish",
            detail:
              "The control plane refused the sign-in: invalid_grant, the authorization code is unknown or already used.",
            fix: "Sign in again. If it fails twice, report it.",
          },
        },
      }),
    }),
  },
};
