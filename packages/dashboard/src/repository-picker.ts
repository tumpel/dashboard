import { GitHubRepositoryPathSchema } from "@tumpel/schemas";
import { failureOf, type GitHubRepository, type GitHubRepositoryPath, type Problem } from "./api/port.ts";
import { type Wording, wordingOf } from "./api/wording.ts";

export type Listing =
  | { status: "pending" }
  | { status: "error"; error: unknown }
  | { status: "success"; data: GitHubRepository[] };

export type ListingState =
  | { state: "Loading" }
  | { state: "Listed"; repositories: GitHubRepository[] }
  | { state: "NotConfigured"; problem: Problem }
  | { state: "NotConnected"; problem: Problem }
  | { state: "SignedOut" }
  | { state: "ListingRefused"; wording: Wording };

export const listingStateOf = (listing: Listing): ListingState => {
  if (listing.status === "pending") return { state: "Loading" };
  if (listing.status === "success") return { state: "Listed", repositories: listing.data };
  const failure = failureOf(listing.error);
  if (failure.kind === "Problem" && failure.status === 401) return { state: "SignedOut" };
  if (failure.kind === "Problem" && failure.problem.code === "GitHubAppMissing") {
    return { state: "NotConfigured", problem: failure.problem };
  }
  if (failure.kind === "Problem" && failure.problem.code === "GitHubNotConnected") {
    return { state: "NotConnected", problem: failure.problem };
  }
  return { state: "ListingRefused", wording: wordingOf(failure) };
};

export type RepositoryChoice =
  | { kind: "Covered"; repository: GitHubRepository }
  | { kind: "Typed"; path: GitHubRepositoryPath };

export const fullName = (path: GitHubRepositoryPath): string => `${path.owner}/${path.name}`;

export const pathOf = (choice: RepositoryChoice): GitHubRepositoryPath =>
  choice.kind === "Covered" ? choice.repository : choice.path;

export const htmlUrlOf = (choice: RepositoryChoice): string =>
  choice.kind === "Covered" ? choice.repository.htmlUrl : `https://github.com/${fullName(choice.path)}`;

const GITHUB_PREFIX = /^(?:https?:\/\/)?(?:www\.)?github\.com\//i;

export const searchTextOf = (text: string): string =>
  text
    .trim()
    .replace(GITHUB_PREFIX, "")
    .replace(/\/+$/, "")
    .replace(/\.git$/i, "");

export const typedPathOf = (text: string): GitHubRepositoryPath | null => {
  const [owner, name, ...rest] = searchTextOf(text).split("/");
  if (rest.length > 0) return null;
  const parsed = GitHubRepositoryPathSchema.safeParse({ owner, name });
  return parsed.success ? parsed.data : null;
};

const samePath = (left: GitHubRepositoryPath, right: GitHubRepositoryPath): boolean =>
  fullName(left).toLowerCase() === fullName(right).toLowerCase();

export const repositoryChoiceOf = (
  listing: ListingState,
  selected: GitHubRepositoryPath | null,
  acceptsTyped: boolean,
): RepositoryChoice | null => {
  if (selected === null) return null;
  if (listing.state === "Listed") {
    const repository = listing.repositories.find((item) => samePath(item, selected));
    if (repository !== undefined) return { kind: "Covered", repository };
  }
  if (!acceptsTyped || listing.state === "Loading" || listing.state === "SignedOut") return null;
  return { kind: "Typed", path: selected };
};

export interface Match {
  repository: GitHubRepository;
  start: number;
  end: number;
}

export interface OwnerGroup {
  owner: string;
  matches: Match[];
}

const byText = (left: string, right: string): number =>
  left.localeCompare(right, "en", { sensitivity: "base" }) || left.localeCompare(right, "en");

export const groupMatches = (repositories: readonly GitHubRepository[], text: string): OwnerGroup[] => {
  const needle = searchTextOf(text).toLowerCase();
  const groups = new Map<string, Match[]>();
  const sorted = [...repositories].sort(
    (left, right) => byText(left.owner, right.owner) || byText(left.name, right.name),
  );
  for (const repository of sorted) {
    const start = fullName(repository).toLowerCase().indexOf(needle);
    if (start < 0) continue;
    const match = { repository, start, end: start + needle.length };
    groups.set(repository.owner, [...(groups.get(repository.owner) ?? []), match]);
  }
  return [...groups].map(([owner, matches]) => ({ owner, matches }));
};

export type PickerOption =
  | { kind: "Repository"; repository: GitHubRepository }
  | { kind: "Use"; path: GitHubRepositoryPath }
  | { kind: "Connect" };

export interface PickerList {
  groups: OwnerGroup[];
  options: PickerOption[];
  shown: number;
  total: number;
  firstActive: number;
}

export const pickerListOf = (
  repositories: readonly GitHubRepository[],
  text: string,
  acceptsTyped: boolean,
): PickerList => {
  const groups = groupMatches(repositories, text);
  const matched = groups.flatMap((group) => group.matches.map((match) => match.repository));
  const typed = acceptsTyped ? typedPathOf(text) : null;
  const use: PickerOption[] =
    typed !== null && !repositories.some((item) => samePath(item, typed)) ? [{ kind: "Use", path: typed }] : [];
  const options: PickerOption[] = [
    ...matched.map((repository): PickerOption => ({ kind: "Repository", repository })),
    ...use,
    { kind: "Connect" },
  ];
  return {
    groups,
    options,
    shown: matched.length,
    total: repositories.length,
    firstActive: matched.length > 0 ? 0 : options.length - 1,
  };
};
