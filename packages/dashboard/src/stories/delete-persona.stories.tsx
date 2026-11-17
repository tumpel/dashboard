import type { Meta, StoryObj } from "@storybook/react-vite";
import { fireEvent, screen, within } from "storybook/test";
import { fakeApi, problem, StoryApp, tenantPath } from "./harness";

const meta: Meta<typeof StoryApp> = { title: "Dashboard/Personas/DeletePersona", component: StoryApp };
export default meta;

export const Refused: StoryObj<typeof StoryApp> = {
  args: {
    path: tenantPath("/personas/prs_placeholder01#delete"),
    api: fakeApi({
      deletePersona: () =>
        Promise.reject(
          problem(
            409,
            "Conflict",
            "Persona in use",
            "persona prs_placeholder01 is the persona of sessions ses_1, ses_2, ses_4",
            "A persona that sessions ran on stays; edit it, or create a new persona",
          ),
        ),
    }),
  },
  play: async () => {
    const dialog = await screen.findByRole("dialog", undefined, { timeout: 5000 });
    fireEvent.click(within(dialog).getByRole("button", { name: "Delete persona" }));
  },
};
