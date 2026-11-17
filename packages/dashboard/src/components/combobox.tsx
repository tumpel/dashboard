import { ChevronsUpDownIcon, XIcon } from "lucide-react";
import { Dialog as DialogPrimitive, Popover } from "radix-ui";
import { type KeyboardEvent, type ReactNode, useEffect, useId, useRef, useState, useSyncExternalStore } from "react";
import { cn } from "../lib";
import { Skeleton } from "./ui/skeleton";

export interface ComboboxRow<O> {
  key: string;
  option: O;
  content: ReactNode;
}

export interface ComboboxGroup<O> {
  key: string;
  heading: string | null;
  divided: boolean;
  rows: ComboboxRow<O>[];
}

export interface ComboboxView<O> {
  notice: ReactNode;
  focus: "Search" | "Notice";
  loading: boolean;
  loadingLabel: string;
  message: ReactNode;
  liveText: string;
  groups: ComboboxGroup<O>[];
  firstActive: number;
}

export type Chosen = "Picked" | "Left";

const WIDE = "(min-width: 640px)";

const subscribeWide = (notify: () => void) => {
  const media = window.matchMedia(WIDE);
  media.addEventListener("change", notify);
  return () => media.removeEventListener("change", notify);
};

const useWide = (): boolean => useSyncExternalStore(subscribeWide, () => window.matchMedia(WIDE).matches);

const movedTo = (key: string, current: number, last: number): number | null => {
  if (key === "ArrowDown") return Math.min(current + 1, last);
  if (key === "ArrowUp") return Math.max(current - 1, 0);
  if (key === "Home") return 0;
  if (key === "End") return last;
  return null;
};

const rowClass = (active: boolean) =>
  cn("flex min-h-13 w-full items-center gap-3 rounded-md px-3 text-left text-sm sm:min-h-10", active && "bg-accent");

interface PanelProps<O> {
  searchLabel: string;
  searchPlaceholder: string;
  view: (text: string) => ComboboxView<O>;
  onChoose: (option: O) => void;
  onLeave: () => void;
}

const ComboboxPanel = <O,>({ searchLabel, searchPlaceholder, view, onChoose, onLeave }: PanelProps<O>) => {
  const listId = useId();
  const searchRef = useRef<HTMLInputElement>(null);
  const [text, setText] = useState("");
  const [active, setActive] = useState<number | null>(null);
  const shown = view(text);
  useEffect(() => {
    if (shown.focus === "Search") searchRef.current?.focus();
  }, [shown.focus]);
  const options = shown.groups.flatMap((group) => group.rows.map((row) => row.option));
  const current = Math.min(active ?? shown.firstActive, options.length - 1);
  const optionId = (index: number): string => `${listId}-${index}`;
  const move = (next: number) => {
    setActive(next);
    document.getElementById(optionId(next))?.scrollIntoView({ block: "nearest" });
  };
  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Tab") return onLeave();
    if (shown.loading) return;
    const option = options[current];
    if (event.key === "Enter" && option !== undefined) {
      event.preventDefault();
      return onChoose(option);
    }
    const next = movedTo(event.key, current, options.length - 1);
    if (next === null) return;
    event.preventDefault();
    move(next);
  };
  const offsets = shown.groups.map((_, at) =>
    shown.groups.slice(0, at).reduce((sum, group) => sum + group.rows.length, 0),
  );
  return (
    <div className="grid min-h-0 content-start gap-2">
      {shown.notice}
      <input
        ref={searchRef}
        type="search"
        inputMode="search"
        enterKeyHint="go"
        autoCapitalize="off"
        autoCorrect="off"
        spellCheck={false}
        aria-label={searchLabel}
        placeholder={searchPlaceholder}
        role="combobox"
        aria-expanded
        aria-autocomplete="list"
        aria-controls={listId}
        aria-activedescendant={shown.loading || options.length === 0 ? undefined : optionId(current)}
        value={text}
        onChange={(event) => {
          setText(event.target.value);
          setActive(null);
        }}
        onKeyDown={onKeyDown}
        className="flex h-10 w-full rounded-md border bg-input px-3 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:h-9 sm:text-sm"
      />
      {shown.loading ? (
        <div aria-busy className="grid gap-1 p-1">
          <span role="status" className="sr-only">
            {shown.loadingLabel}
          </span>
          {[0, 1, 2, 3].map((row) => (
            <Skeleton key={row} className="h-11 w-full sm:h-8" />
          ))}
        </div>
      ) : (
        <>
          <span role="status" aria-live="polite" className="sr-only">
            {shown.liveText}
          </span>
          {shown.message}
          <div
            id={listId}
            role="listbox"
            aria-label={searchLabel}
            className="grid min-h-0 content-start overflow-y-auto sm:max-h-[21rem]"
          >
            {shown.groups.map((group, groupAt) => (
              <div key={group.key} className={cn(group.divided && "border-t")}>
                {group.heading !== null && (
                  <div aria-hidden className="flex h-6.5 items-center px-3 text-xs font-semibold text-muted-foreground">
                    {group.heading}
                  </div>
                )}
                {group.rows.map((row, rowAt) => {
                  const at = (offsets[groupAt] ?? 0) + rowAt;
                  return (
                    <button
                      key={row.key}
                      type="button"
                      tabIndex={-1}
                      id={optionId(at)}
                      role="option"
                      aria-selected={at === current}
                      onMouseMove={() => setActive(at)}
                      onClick={() => onChoose(row.option)}
                      className={rowClass(at === current)}
                    >
                      {row.content}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

const useSheetHistory = (onBack: () => void) => {
  const pushed = useRef(false);
  const afterBack = useRef<() => void>(() => undefined);
  const backRef = useRef(onBack);
  backRef.current = onBack;
  useEffect(() => {
    const onPop = () => {
      if (!pushed.current) return;
      pushed.current = false;
      const next = afterBack.current;
      afterBack.current = () => undefined;
      backRef.current();
      next();
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);
  return {
    push: () => {
      if (pushed.current) return;
      window.history.pushState(window.history.state, "", window.location.href);
      pushed.current = true;
    },
    pop: (then: () => void) => {
      if (!pushed.current) return then();
      afterBack.current = then;
      window.history.back();
    },
  };
};

export const Combobox = <O,>({
  id,
  value,
  placeholder,
  disabled,
  invalid,
  describedBy,
  nextFocusId,
  title,
  searchLabel,
  searchPlaceholder,
  view,
  onChoose,
}: {
  id: string;
  value: string | null;
  placeholder: string;
  disabled: boolean;
  invalid: boolean;
  describedBy: string | null;
  nextFocusId: string;
  title: string;
  searchLabel: string;
  searchPlaceholder: string;
  view: (text: string) => ComboboxView<O>;
  onChoose: (option: O) => Chosen;
}) => {
  const wide = useWide();
  const picked = useRef(false);
  const [open, setOpen] = useState(false);
  const sheet = useSheetHistory(() => setOpen(false));
  const isOpen = open && !disabled;
  const openPicker = () => {
    if (!wide) sheet.push();
    setOpen(true);
  };
  const close = (then: () => void) =>
    sheet.pop(() => {
      setOpen(false);
      then();
    });
  const choose = (option: O) =>
    close(() => {
      picked.current = onChoose(option) === "Picked";
    });
  const onCloseAutoFocus = (event: Event) => {
    if (!picked.current) return;
    picked.current = false;
    event.preventDefault();
    document.getElementById(nextFocusId)?.focus();
  };
  const onOpenChange = (next: boolean) => (next ? openPicker() : close(() => undefined));
  const panel = (
    <ComboboxPanel
      searchLabel={searchLabel}
      searchPlaceholder={searchPlaceholder}
      view={view}
      onChoose={choose}
      onLeave={() => close(() => undefined)}
    />
  );
  const trigger = (
    <button
      id={id}
      type="button"
      disabled={disabled}
      aria-haspopup="dialog"
      aria-expanded={isOpen}
      aria-invalid={invalid}
      aria-describedby={describedBy ?? undefined}
      onClick={() => !wide && openPicker()}
      onKeyDown={(event) => {
        if (event.altKey && event.key === "ArrowDown") {
          event.preventDefault();
          openPicker();
        }
      }}
      className="flex h-9 w-full items-center justify-between gap-2 rounded-md border bg-input px-3 text-left text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring aria-invalid:border-destructive disabled:opacity-60"
    >
      <span className={cn("truncate", value === null && "text-muted-foreground")}>{value ?? placeholder}</span>
      <ChevronsUpDownIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
    </button>
  );
  if (wide) {
    return (
      <Popover.Root open={isOpen} onOpenChange={onOpenChange}>
        <Popover.Trigger asChild>{trigger}</Popover.Trigger>
        <Popover.Portal>
          <Popover.Content
            align="start"
            sideOffset={4}
            aria-label={title}
            className="z-50 w-(--radix-popover-trigger-width) min-w-72 rounded-md border bg-card p-2 shadow-md"
            onOpenAutoFocus={(event) => event.preventDefault()}
            onCloseAutoFocus={onCloseAutoFocus}
          >
            {panel}
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
    );
  }
  return (
    <>
      {trigger}
      <DialogPrimitive.Root open={isOpen} onOpenChange={onOpenChange}>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Content
            className="fixed inset-0 z-50 grid grid-rows-[auto_1fr] gap-3 bg-card p-4"
            aria-describedby={undefined}
            onOpenAutoFocus={(event) => event.preventDefault()}
            onCloseAutoFocus={onCloseAutoFocus}
          >
            <div className="flex items-center gap-2">
              <DialogPrimitive.Close className="rounded-sm p-1" aria-label="Close">
                <XIcon className="size-5" />
              </DialogPrimitive.Close>
              <DialogPrimitive.Title className="text-[17px] font-semibold">{title}</DialogPrimitive.Title>
            </div>
            {panel}
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>
    </>
  );
};
