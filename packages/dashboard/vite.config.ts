import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { basename, dirname, join } from "node:path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vite";

const require = createRequire(import.meta.url);

const FONT_SOURCES = [
  join(dirname(require.resolve("@fontsource-variable/inter")), "files/inter-latin-wght-normal.woff2"),
  join(dirname(require.resolve("@fontsource-variable/jetbrains-mono")), "files/jetbrains-mono-latin-wght-normal.woff2"),
];

const stableFonts = (): Plugin => ({
  name: "tumpel-stable-fonts",
  generateBundle() {
    for (const source of FONT_SOURCES) {
      this.emitFile({ type: "asset", fileName: `fonts/${basename(source)}`, source: readFileSync(source) });
    }
  },
});

export default defineConfig({
  plugins: [react(), tailwindcss(), stableFonts()],
});
