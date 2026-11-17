import type { HarnessCatalogEntry, ModelProvider, SecretKey, SecretMemberUpdate, SecretValue } from "./api/port";

export type CredentialKind = "ApiKey" | "SubscriptionToken";

const FIRST = [
  "fumble",
  "wobble",
  "jiggle",
  "bramble",
  "giggle",
  "noodle",
  "pebble",
  "muddle",
  "snuggle",
  "doodle",
  "waffle",
  "tumble",
  "crumble",
  "dazzle",
  "puzzle",
  "sprinkle",
];

const SECOND = [
  "bumble",
  "otter",
  "teapot",
  "badger",
  "pickle",
  "marble",
  "biscuit",
  "puffin",
  "kettle",
  "turnip",
  "wombat",
  "pancake",
  "lantern",
  "mitten",
  "beetle",
  "sprocket",
];

const pick = (words: readonly string[], roll: number): string =>
  words[Math.floor(roll * words.length)] ?? words[0] ?? "";

export const suggestName = (roll: () => number): string => `${pick(FIRST, roll())}-${pick(SECOND, roll())}`;

export const catalogProviders = (catalog: readonly HarnessCatalogEntry[]): ModelProvider[] => [
  ...new Set(catalog.flatMap((entry) => entry.credentials.map((credential) => credential.provider))),
];

const pasted = (kind: HarnessCatalogEntry["credentials"][number]["kind"]): kind is CredentialKind =>
  kind !== "CredentialFile";

export const catalogKinds = (catalog: readonly HarnessCatalogEntry[], provider: ModelProvider): CredentialKind[] => [
  ...new Set(
    catalog.flatMap((entry) =>
      entry.credentials
        .filter((credential) => credential.provider === provider)
        .map((credential) => credential.kind)
        .filter(pasted),
    ),
  ),
];

export const catalogVariable = (
  catalog: readonly HarnessCatalogEntry[],
  provider: ModelProvider,
  kind: CredentialKind,
): string => {
  const matching = catalog.flatMap((entry) =>
    entry.credentials.filter((credential) => credential.provider === provider && credential.kind === kind),
  );
  return (matching.find((credential) => credential.fixed.length === 0) ?? matching[0])?.variable ?? "";
};

const keptOf = (key: SecretKey): SecretMemberUpdate => {
  if (key.kind === "Variable") return { kind: key.kind, name: key.name };
  if (key.kind === "ApiKey") return { kind: key.kind, name: key.name, provider: key.provider };
  return { kind: key.kind, name: key.name, provider: key.provider, expiresAt: key.expiresAt };
};

export const replacedBy = (keys: readonly SecretKey[], added: SecretValue): SecretKey[] =>
  keys.filter(
    (key) =>
      key.name === added.name ||
      (added.kind !== "Variable" && key.kind !== "Variable" && key.provider === added.provider),
  );

export const withSecret = (keys: readonly SecretKey[], added: SecretValue): SecretMemberUpdate[] => {
  const replaced = new Set(replacedBy(keys, added).map((key) => key.name));
  return [...keys.filter((key) => !replaced.has(key.name)).map(keptOf), added];
};
