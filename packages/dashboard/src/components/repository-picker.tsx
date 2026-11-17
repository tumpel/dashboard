import { Link, useNavigate } from "@tanstack/react-router";
import { PlusIcon } from "lucide-react";
import type { ReactNode } from "react";
import type { GitHubRepositoryPath } from "../api/port";
import type { Wording } from "../api/wording";
import { useOwner, useRepositories } from "../queries";
import {
  fullName,
  type ListingState,
  listingStateOf,
  type Match,
  type PickerOption,
  pickerListOf,
  type RepositoryChoice,
  repositoryChoiceOf,
} from "../repository-picker";
import { type Chosen, Combobox, type ComboboxGroup, type ComboboxView } from "./combobox";
import { ProblemCard } from "./problem-block";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";

const Highlighted = ({ match }: { match: Match }) => {
  const text = fullName(match.repository);
  if (match.end === match.start) return <>{text}</>;
  return (
    <>
      {text.slice(0, match.start)}
      <u className="underline-offset-2">{text.slice(match.start, match.end)}</u>
      {text.slice(match.end)}
    </>
  );
};

const plural = (count: number, one: string, many: string): string => `${count} ${count === 1 ? one : many}`;

const countLine = (shown: number, total: number, filtered: boolean): string =>
  filtered ? `${shown} of ${plural(total, "repository", "repositories")}` : plural(total, "repository", "repositories");

const noMatchLines = (listing: ListingState, text: string, total: number, owners: number): string[] => {
  if (listing.state !== "Listed") return ["Type owner/name to use a repository the persona's GITHUB_TOKEN reads."];
  if (total === 0) return ["Your GitHub connections cover no repository."];
  return [
    `No repository matches "${text}".`,
    `Your GitHub connections cover ${plural(total, "repository", "repositories")} in ${plural(owners, "account", "accounts")}.`,
  ];
};

const RefusedCard = ({ tenantId, wording, onRetry }: { tenantId: string; wording: Wording; onRetry: () => void }) => (
  <ProblemCard
    wording={wording}
    className="border"
    actions={
      <>
        <Button size="sm" variant="outline" autoFocus onClick={onRetry}>
          Retry
        </Button>
        <Button size="sm" variant="outline" asChild>
          <Link to="/t/$tenantId/connections" params={{ tenantId }}>
            Open Connections
          </Link>
        </Button>
      </>
    }
  />
);

const viewOf =
  ({
    tenantId,
    listing,
    acceptsTyped,
    owner,
    retry,
  }: {
    tenantId: string;
    listing: ListingState;
    acceptsTyped: boolean;
    owner: boolean;
    retry: () => void;
  }) =>
  (text: string): ComboboxView<PickerOption> => {
    const repositories = listing.state === "Listed" ? listing.repositories : [];
    const list = pickerListOf(repositories, text, acceptsTyped);
    const groups: ComboboxGroup<PickerOption>[] = list.groups.map((group) => ({
      key: `owner:${group.owner}`,
      heading: `${group.owner} (${group.matches.length})`,
      divided: false,
      rows: group.matches.map((match) => ({
        key: fullName(match.repository),
        option: { kind: "Repository", repository: match.repository },
        content: (
          <>
            <span className="min-w-0 flex-1 truncate font-medium">
              <Highlighted match={match} />
            </span>
            {match.repository.private && <Badge>Private</Badge>}
            <span className="shrink-0 font-mono text-xs text-muted-foreground">{match.repository.defaultBranch}</span>
          </>
        ),
      })),
    }));
    const trailing = list.options.slice(list.shown).map((option) => ({
      key: option.kind,
      option,
      content:
        option.kind === "Use" ? (
          <span className="grid min-w-0 flex-1">
            <span className="truncate font-medium">Use {fullName(option.path)}</span>
            <span className="text-xs text-muted-foreground">Read with the persona's GITHUB_TOKEN</span>
          </span>
        ) : (
          <>
            <PlusIcon className="size-4 shrink-0" aria-hidden />
            <span className="flex-1">
              {owner ? "Add another account or org" : "Ask an Owner to add another account or org"}
            </span>
          </>
        ),
    }));
    const owners = new Set(repositories.map((item) => item.owner)).size;
    return {
      notice:
        listing.state === "ListingRefused" ? (
          <RefusedCard tenantId={tenantId} wording={listing.wording} onRetry={retry} />
        ) : null,
      focus: listing.state === "ListingRefused" ? "Notice" : "Search",
      loading: listing.state === "Loading",
      loadingLabel: "Loading the repositories your GitHub connections cover",
      message:
        list.shown === 0 ? (
          <div className="grid gap-1 px-3 py-2 text-sm">
            {noMatchLines(listing, text.trim(), list.total, owners).map((line, at) => (
              <p key={line} className={at === 0 ? "font-semibold" : "text-muted-foreground"}>
                {line}
              </p>
            ))}
          </div>
        ) : null,
      liveText: countLine(list.shown, list.total, text.trim() !== ""),
      groups: [...groups, { key: "trailing", heading: null, divided: true, rows: trailing }],
      firstActive: list.firstActive,
    };
  };

const StateCard = ({ id, title, detail, action }: { id: string; title: string; detail: string; action: ReactNode }) => (
  <div id={id} className="grid gap-2 rounded-lg border-2 bg-card p-4">
    <h3 className="font-semibold">{title}</h3>
    <p className="text-sm text-muted-foreground">{detail}</p>
    <div>{action}</div>
  </div>
);

const ConnectCard = ({ tenantId, id, listing }: { tenantId: string; id: string; listing: ListingState }) => {
  const owner = useOwner(tenantId);
  if (listing.state === "NotConfigured") {
    return (
      <StateCard
        id={id}
        title="This stage has no GitHub App yet"
        detail="An Owner sets it up once on the Connections screen."
        action={
          <Button size="sm" asChild>
            <Link to="/t/$tenantId/connections" params={{ tenantId }}>
              Open Connections
            </Link>
          </Button>
        }
      />
    );
  }
  if (listing.state === "NotConnected") {
    return (
      <StateCard
        id={id}
        title="Connect GitHub to pick a repository"
        detail="Install the GitHub App on an account or org, then come back here."
        action={
          <Button size="sm" asChild>
            {owner ? (
              <Link to="/t/$tenantId/connections" params={{ tenantId }}>
                Connect GitHub
              </Link>
            ) : (
              <Link to="/t/$tenantId/members" params={{ tenantId }}>
                Ask an Owner to connect GitHub
              </Link>
            )}
          </Button>
        }
      />
    );
  }
  return null;
};

const choiceHint = (choice: RepositoryChoice): string =>
  choice.kind === "Typed"
    ? "Not covered by your GitHub connections. The persona's GITHUB_TOKEN reads it."
    : `Default branch: ${choice.repository.defaultBranch}.${choice.repository.private ? " Private." : ""}`;

const emptyHint = (acceptsTyped: boolean): string =>
  acceptsTyped
    ? "The repositories your GitHub connections cover, or any owner/name the persona's GITHUB_TOKEN reads."
    : "The repositories your GitHub connections cover.";

export const useRepositoryListing = (tenantId: string) => {
  const repositories = useRepositories(tenantId);
  return { listing: listingStateOf(repositories), retry: () => void repositories.refetch() };
};

export const RepositoryPicker = ({
  tenantId,
  id,
  selected,
  acceptsTyped,
  nextFocusId,
  onPick,
}: {
  tenantId: string;
  id: string;
  selected: GitHubRepositoryPath | null;
  acceptsTyped: boolean;
  nextFocusId: string;
  onPick: (choice: RepositoryChoice) => void;
}) => {
  const owner = useOwner(tenantId);
  const navigate = useNavigate();
  const { listing, retry } = useRepositoryListing(tenantId);
  const choice = repositoryChoiceOf(listing, selected, acceptsTyped);
  const unlisted = listing.state === "NotConfigured" || listing.state === "NotConnected";
  const blocked = listing.state === "SignedOut" || (unlisted && !acceptsTyped);
  const error = listing.state === "ListingRefused" ? listing.wording.title : null;
  const cardId = `${id}-card`;
  const describedBy = error !== null ? `${id}-error` : unlisted ? cardId : `${id}-hint`;
  const choose = (option: PickerOption): Chosen => {
    if (option.kind === "Repository") {
      onPick({ kind: "Covered", repository: option.repository });
      return "Picked";
    }
    if (option.kind === "Use") {
      onPick({ kind: "Typed", path: option.path });
      return "Picked";
    }
    void navigate(
      owner
        ? { to: "/t/$tenantId/connections", params: { tenantId } }
        : { to: "/t/$tenantId/members", params: { tenantId } },
    );
    return "Left";
  };
  return (
    <div className="grid gap-1 text-sm">
      <label htmlFor={id} className="font-medium">
        Repository
      </label>
      <Combobox
        id={id}
        value={selected === null ? null : fullName(selected)}
        placeholder="Pick a repository"
        disabled={blocked}
        invalid={error !== null}
        describedBy={describedBy}
        nextFocusId={nextFocusId}
        title="Pick a repository"
        searchLabel="Search repositories"
        searchPlaceholder="Search owner/name"
        view={viewOf({ tenantId, listing, acceptsTyped, owner, retry })}
        onChoose={choose}
      />
      {error !== null && (
        <p id={`${id}-error`} className="text-xs font-semibold text-destructive">
          {error}
        </p>
      )}
      {error === null && !unlisted && (
        <p id={`${id}-hint`} className="text-xs text-muted-foreground">
          {choice === null ? emptyHint(acceptsTyped) : choiceHint(choice)}
        </p>
      )}
      <ConnectCard tenantId={tenantId} id={cardId} listing={listing} />
    </div>
  );
};
