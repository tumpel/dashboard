import type { Preview } from "@storybook/react-vite";
import "@fontsource-variable/inter";
import "@fontsource-variable/jetbrains-mono";
import "../src/styles.css";

const preview: Preview = {
  parameters: { layout: "fullscreen" },
};

export default preview;
