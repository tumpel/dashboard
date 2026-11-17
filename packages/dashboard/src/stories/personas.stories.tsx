import type { Meta, StoryObj } from "@storybook/react-vite";
import { fakeApi, never, problem, StoryApp, tenantPath } from "./harness";

const meta: Meta<typeof StoryApp> = { title: "Dashboard/Personas/PersonaList", component: StoryApp };
export default meta;

type Story = StoryObj<typeof StoryApp>;

export const Default: Story = { args: { path: tenantPath("/personas") } };

export const Loading: Story = {
  args: { path: tenantPath("/personas"), api: fakeApi({ listPersonas: never, listSecretSets: never }) },
};

export const Empty: Story = {
  args: { path: tenantPath("/personas"), api: fakeApi({ listPersonas: async () => [] }) },
};

const ListError: Story = {
  args: {
    path: tenantPath("/personas"),
    api: fakeApi({
      listPersonas: () =>
        Promise.reject(
          problem(
            400,
            "InvalidRequest",
            "Personas did not load",
            "Personas_list refused the request.",
            "Retry. If it keeps failing, report it with the time shown.",
          ),
        ),
    }),
  },
};

export { ListError as Error };
