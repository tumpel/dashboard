import type { HarnessCatalogEntry } from "./api/port";
import { UNRECOGNISED_LABEL } from "./api/wording";

export const HARNESS_LABELS: Record<HarnessCatalogEntry["harness"], string> = {
  ClaudeCode: "Claude Code",
  Codex: "Codex",
  OpenCode: "OpenCode",
  PiDev: "Pi.dev",
  MistralAgent: "Mistral agent",
  Gemini: "Gemini CLI",
  Unrecognised: UNRECOGNISED_LABEL,
};
