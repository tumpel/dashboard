import type { Meta, StoryObj } from "@storybook/react-vite";
import { fakeApi, never, problem, StoryApp, tenantPath } from "./harness";

const meta: Meta<typeof StoryApp> = { title: "Dashboard/Harnesses/HarnessCatalog", component: StoryApp };
export default meta;

type Story = StoryObj<typeof StoryApp>;

export const Default: Story = { args: { path: tenantPath("/harnesses") } };

export const Loading: Story = {
  args: {
    path: tenantPath("/harnesses"),
    api: fakeApi({ listHarnessCatalog: never, listHarnessPins: never, currentRelease: never }),
  },
};

const CatalogError: Story = {
  args: {
    path: tenantPath("/harnesses"),
    api: fakeApi({
      listHarnessCatalog: () =>
        Promise.reject(
          problem(
            400,
            "InvalidRequest",
            "The catalog did not load",
            "HarnessCatalog_list refused the request.",
            "Retry. If it keeps failing, report it with the time shown.",
          ),
        ),
    }),
  },
};

export { CatalogError as Error };
