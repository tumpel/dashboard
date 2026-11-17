import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import type { StorybookConfig } from "@storybook/react-vite";

const require = createRequire(import.meta.url);
const fontFiles = (name: string): string => join(dirname(require.resolve(name)), "files");

const config: StorybookConfig = {
  stories: ["../src/**/*.stories.tsx"],
  framework: { name: "@storybook/react-vite", options: {} },
  staticDirs: [
    "../public",
    { from: fontFiles("@fontsource-variable/inter"), to: "/fonts" },
    { from: fontFiles("@fontsource-variable/jetbrains-mono"), to: "/fonts" },
  ],
};

export default config;
