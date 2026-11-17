import type { PrebuildLifecycleCommandSchema } from "@tumpel/schemas";
import type { z } from "zod";

export type PrebuildLifecycleCommand = z.infer<typeof PrebuildLifecycleCommandSchema>;

export interface TemplateRef {
  prebuildTemplateId: string;
  prebuildTemplateVersion: number;
}

export interface WizardSearch {
  repo: string | null;
  persona: string | null;
  template: string | null;
  pr: string | null;
  prebuild: string | null;
}

export const NO_WIZARD_SEARCH: WizardSearch = { repo: null, persona: null, template: null, pr: null, prebuild: null };

const TEMPLATE_REF = /^([a-z][a-z0-9-]{0,39})@([1-9][0-9]{0,8})$/;

export const templateRefOf = (text: string | null): TemplateRef | null => {
  const match = TEMPLATE_REF.exec(text ?? "");
  if (match === null) return null;
  return { prebuildTemplateId: match[1] ?? "", prebuildTemplateVersion: Number(match[2]) };
};

export const templateRefText = (ref: TemplateRef): string => `${ref.prebuildTemplateId}@${ref.prebuildTemplateVersion}`;

export const templateLabel = (ref: TemplateRef): string => `${ref.prebuildTemplateId} v${ref.prebuildTemplateVersion}`;

export const repositoryUrlOf = (repo: string): string => `https://github.com/${repo}`;

export const commandText = (argv: readonly string[]): string => {
  const [program, flag, script, ...rest] = argv;
  if (program === "/bin/sh" && flag === "-c" && script !== undefined && rest.length === 0) return script;
  return argv.join(" ");
};

export const LIFECYCLE_STEPS: readonly { lifecycle: PrebuildLifecycleCommand; field: string; note: string }[] = [
  {
    lifecycle: "OnCreateCommand",
    field: "onCreateCommand",
    note: "Runs once in the prebuild, right after the clone. Install dependencies here.",
  },
  {
    lifecycle: "UpdateContentCommand",
    field: "updateContentCommand",
    note: "Runs in the prebuild after the step before. Build or generate code here.",
  },
  {
    lifecycle: "PostCreateCommand",
    field: "postCreateCommand",
    note: "Runs last in the prebuild. Clear caches here to keep the layer small.",
  },
  {
    lifecycle: "PostStartCommand",
    field: "postStartCommand",
    note: "Runs at the start of each session's first turn, on top of the stored layer.",
  },
];
