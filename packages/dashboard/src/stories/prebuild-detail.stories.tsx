import type { Meta, StoryObj } from "@storybook/react-vite";
import { BUILDING, DOCS, DONE, FAILED, OTHER, REPO } from "./connection-fixtures";
import { fakeApi, StoryApp, tenantPath } from "./harness";

const meta: Meta<typeof StoryApp> = { title: "Dashboard/Prebuilds/PrebuildDetail", component: StoryApp };
export default meta;

type Story = StoryObj<typeof StoryApp>;

const at = (repository: string) => tenantPath(`/prebuilds?repo=${encodeURIComponent(repository)}`);

export const Building: Story = { args: { path: at(DOCS) } };

export const Failed: Story = { args: { path: at(OTHER) } };

export const RebuildingAfterFailure: Story = {
  args: {
    path: at(OTHER),
    api: fakeApi({
      listLatestPrebuilds: async () => [BUILDING, { ...BUILDING, prebuildId: "pbd_retry", repository: OTHER }],
      listPrebuilds: async (repository) =>
        repository === OTHER ? [{ ...BUILDING, prebuildId: "pbd_retry", repository: OTHER }, FAILED] : [],
    }),
  },
};

export const BuiltWithDefault: Story = {
  args: {
    path: at(REPO),
    api: fakeApi({
      listLatestPrebuilds: async () => [{ ...DONE, configSource: "Default" }],
      listPrebuilds: async (repository) => (repository === REPO ? [{ ...DONE, configSource: "Default" }] : []),
    }),
  },
};
