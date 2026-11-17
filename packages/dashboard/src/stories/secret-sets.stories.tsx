import type { Meta, StoryObj } from "@storybook/react-vite";
import { fakeApi, never, problem, StoryApp, tenantPath } from "./harness";

const meta: Meta<typeof StoryApp> = { title: "Dashboard/SecretSets/SecretSetList", component: StoryApp };
export default meta;

type Story = StoryObj<typeof StoryApp>;

export const Default: Story = { args: { path: tenantPath("/secrets") } };

export const Loading: Story = {
  args: { path: tenantPath("/secrets"), api: fakeApi({ listSecretSets: never, listPersonas: never }) },
};

export const Empty: Story = {
  args: { path: tenantPath("/secrets"), api: fakeApi({ listSecretSets: async () => [] }) },
};

const ListError: Story = {
  args: {
    path: tenantPath("/secrets"),
    api: fakeApi({
      listSecretSets: () =>
        Promise.reject(
          problem(
            400,
            "InvalidRequest",
            "Secret sets did not load",
            "SecretSets_list refused the request.",
            "Retry. If it keeps failing, report it with the time shown.",
          ),
        ),
    }),
  },
};

export { ListError as Error };
