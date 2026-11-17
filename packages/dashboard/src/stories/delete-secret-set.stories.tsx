import type { Meta, StoryObj } from "@storybook/react-vite";
import { fireEvent, screen, within } from "storybook/test";
import { fakeApi, problem, StoryApp, tenantPath } from "./harness";

const meta: Meta<typeof StoryApp> = { title: "Dashboard/SecretSets/DeleteSecretSet", component: StoryApp };
export default meta;

export const Refused: StoryObj<typeof StoryApp> = {
  args: {
    path: tenantPath("/secrets/sst_placeholder02#delete"),
    api: fakeApi({
      deleteSecretSet: () =>
        Promise.reject(
          problem(
            409,
            "Conflict",
            "Secret set in use",
            "The persona Reviewer names this set.",
            "Point that persona at another set, then delete.",
          ),
        ),
    }),
  },
  play: async () => {
    const dialog = await screen.findByRole("dialog", undefined, { timeout: 5000 });
    fireEvent.click(within(dialog).getByRole("button", { name: "Delete secret set" }));
  },
};
