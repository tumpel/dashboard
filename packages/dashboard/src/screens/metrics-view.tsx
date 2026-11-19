import { Link, useNavigate } from "@tanstack/react-router";
import { CheckIcon, ChevronDownIcon } from "lucide-react";
import { createContext, useContext, useEffect, useState } from "react";
import type { MetricBucket, MetricWindow } from "../api/port";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { NativeSelect } from "../components/ui/native-select";
import { Popover, PopoverContent, PopoverTrigger } from "../components/ui/popover";
import { useClock } from "../context";
import {
  bucketFor,
  CUSTOM_RANGE_RULE,
  customRangeValid,
  fittingBuckets,
  localInput,
  type MetricRange,
  offsetLabel,
  parseLocalInput,
  RANGE_LABELS,
  RANGES,
  type Span,
  spanFor,
  windowOf,
  zoned,
} from "../metrics";
import { EMPTY_SEARCH, type MetricsSearch } from "../metrics-search";

export interface MetricsView {
  tenantId: string;
  search: MetricsSearch;
  span: Span;
  window: MetricWindow;
  bucket: MetricBucket;
  fitting: MetricBucket[];
  offsetMinutes: number;
  custom: boolean;
  range: MetricRange;
  now: number;
  updatedAt: number;
}

const REFRESH_MS = 60_000;

const useLiveNow = (live: boolean): { now: number; updatedAt: number } => {
  const clock = useClock();
  const [now, setNow] = useState(clock);
  useEffect(() => {
    if (!live) return;
    const refresh = () => {
      if (document.visibilityState === "visible") setNow(clock());
    };
    const timer = setInterval(refresh, REFRESH_MS);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [clock, live]);
  return { now, updatedAt: now };
};

export const useMetricsView = (tenantId: string, search: MetricsSearch): MetricsView => {
  const customFrom = Date.parse(search.from[0] ?? "");
  const customTo = Date.parse(search.to[0] ?? "");
  const custom = !Number.isNaN(customFrom) && !Number.isNaN(customTo);
  const { now, updatedAt } = useLiveNow(!custom);
  const offsetMinutes = -new Date(now).getTimezoneOffset();
  const range: MetricRange = search.range[0] ?? "24h";
  const span = custom ? { from: customFrom, to: customTo } : spanFor(range, now);
  return {
    tenantId,
    search,
    span,
    window: windowOf(span, offsetMinutes),
    bucket: bucketFor(span, now, search.bucket[0]),
    fitting: fittingBuckets(span, now),
    offsetMinutes,
    custom,
    range,
    now,
    updatedAt,
  };
};

const ViewContext = createContext<MetricsView | null>(null);

export const ViewProvider = ViewContext.Provider;

export const useSetSearch = (): ((patch: Partial<MetricsSearch>) => void) => {
  const navigate = useNavigate();
  const view = useContext(ViewContext);
  if (view === null) throw new Error("useSetSearch needs a metrics view");
  return (patch) => void navigate({ to: ".", search: { ...view.search, at: [], group: [], ...patch } });
};

export const linkSearch = (search: MetricsSearch, patch: Partial<MetricsSearch>): MetricsSearch => ({
  ...EMPTY_SEARCH,
  range: search.range,
  from: search.from,
  to: search.to,
  bucket: search.bucket,
  ...patch,
});

export const ZoomControls = ({ view }: { view: MetricsView }) => {
  const set = useSetSearch();
  const { back } = view.search;
  if (back.length === 0) return null;
  return (
    <Button
      variant="outline"
      size="sm"
      onClick={() =>
        back[0] === "preset"
          ? set({ from: [], to: [], back: [], bucket: [] })
          : set({ from: back.slice(0, 1), to: back.slice(1, 2), back: [], bucket: [] })
      }
    >
      Reset zoom
    </Button>
  );
};

export const useZoom = (view: MetricsView): ((from: number, to: number) => void) => {
  const set = useSetSearch();
  return (from, to) =>
    set({
      from: [zoned(from, view.offsetMinutes)],
      to: [zoned(to, view.offsetMinutes)],
      bucket: [],
      back:
        view.search.back.length > 0
          ? view.search.back
          : view.custom
            ? [zoned(view.span.from, view.offsetMinutes), zoned(view.span.to, view.offsetMinutes)]
            : ["preset"],
    });
};

const CustomRange = ({ view, onApply }: { view: MetricsView; onApply: () => void }) => {
  const set = useSetSearch();
  const [from, setFrom] = useState(localInput(view.span.from, view.offsetMinutes));
  const [to, setTo] = useState(localInput(view.span.to, view.offsetMinutes));
  const span = { from: parseLocalInput(from, view.offsetMinutes), to: parseLocalInput(to, view.offsetMinutes) };
  const valid = customRangeValid(span, view.now);
  return (
    <form
      className="grid gap-2 border-t p-3"
      onSubmit={(event) => {
        event.preventDefault();
        set({
          from: [zoned(span.from, view.offsetMinutes)],
          to: [zoned(span.to, view.offsetMinutes)],
          bucket: [],
          back: [],
        });
        onApply();
      }}
    >
      <div className="grid gap-1 text-sm">
        <label htmlFor="metrics-from">From</label>
        <Input id="metrics-from" type="datetime-local" value={from} onChange={(event) => setFrom(event.target.value)} />
      </div>
      <div className="grid gap-1 text-sm">
        <label htmlFor="metrics-to">To</label>
        <Input id="metrics-to" type="datetime-local" value={to} onChange={(event) => setTo(event.target.value)} />
      </div>
      <p className={valid ? "text-xs text-muted-foreground" : "text-xs text-destructive"}>{CUSTOM_RANGE_RULE}</p>
      <Button type="submit" size="sm" disabled={!valid}>
        Apply
      </Button>
    </form>
  );
};

const RangeControl = ({ view }: { view: MetricsView }) => {
  const set = useSetSearch();
  const [open, setOpen] = useState(false);
  const [custom, setCustom] = useState(false);
  const label = view.custom ? "Custom range" : RANGE_LABELS[view.range];
  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        setCustom(false);
      }}
    >
      <PopoverTrigger asChild>
        <Button variant="outline" aria-label={`Range: ${label}`}>
          {label}
          <ChevronDownIcon className="size-4" aria-hidden />
        </Button>
      </PopoverTrigger>
      <PopoverContent>
        <ul>
          {RANGES.map((option) => (
            <li key={option}>
              <button
                type="button"
                aria-pressed={!view.custom && view.range === option}
                className="flex w-full items-center justify-between rounded-sm px-3 py-2 text-left text-sm hover:bg-accent"
                onClick={() => {
                  set({ range: [option], from: [], to: [], bucket: [], back: [] });
                  setOpen(false);
                }}
              >
                {RANGE_LABELS[option]}
                {!view.custom && view.range === option && <CheckIcon className="size-4" aria-hidden />}
              </button>
            </li>
          ))}
        </ul>
        {custom ? (
          <CustomRange view={view} onApply={() => setOpen(false)} />
        ) : (
          <button
            type="button"
            className="mt-1 flex w-full items-center justify-between rounded-sm border-t px-3 py-2 text-left text-sm hover:bg-accent"
            onClick={() => setCustom(true)}
          >
            Custom range
            {view.custom && <CheckIcon className="size-4" aria-hidden />}
          </button>
        )}
      </PopoverContent>
    </Popover>
  );
};

export const FilterRow = ({ view, children }: { view: MetricsView; children?: React.ReactNode }) => {
  const set = useSetSearch();
  return (
    <div className="mb-4 grid gap-3">
      <div className="flex flex-wrap items-center justify-start gap-3">
        <RangeControl view={view} />
        <div className="flex items-center gap-2 text-sm">
          <label htmlFor="metrics-resolution">Resolution</label>
          <NativeSelect
            id="metrics-resolution"
            className="w-auto"
            value={view.bucket}
            onChange={(event) =>
              set({ bucket: view.fitting.filter((option) => option === event.target.value), back: view.search.back })
            }
          >
            {view.fitting.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </NativeSelect>
        </div>
        <ZoomControls view={view} />
        <span className="ml-auto text-xs text-muted-foreground">
          Times in {offsetLabel(view.offsetMinutes)}
          {!view.custom && <> · Updated {zoned(view.updatedAt, view.offsetMinutes).slice(11, 16)}</>}
        </span>
      </div>
      {children}
    </div>
  );
};

export const Breadcrumb = ({
  view,
  path,
  trail,
}: {
  view: MetricsView;
  path: "" | "/startup" | "/hosts" | "/explore";
  trail?: string;
}) => {
  const search = linkSearch(view.search, {});
  const { tenantId } = view;
  const link = "hover:underline";
  return (
    <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-1">
      <Link to="/t/$tenantId/metrics" params={{ tenantId }} search={search} className={link}>
        Metrics
      </Link>
      {path === "/startup" && (
        <>
          <span aria-hidden>›</span>
          <Link to="/t/$tenantId/metrics/startup" params={{ tenantId }} search={search} className={link}>
            Startup
          </Link>
        </>
      )}
      {path === "/hosts" && (
        <>
          <span aria-hidden>›</span>
          <Link to="/t/$tenantId/metrics/hosts" params={{ tenantId }} search={search} className={link}>
            Hosts
          </Link>
        </>
      )}
      {path === "/explore" && (
        <>
          <span aria-hidden>›</span>
          <Link to="/t/$tenantId/metrics/explore" params={{ tenantId }} search={search} className={link}>
            Explore
          </Link>
        </>
      )}
      {trail !== undefined && (
        <>
          <span aria-hidden>›</span>
          <span aria-current="page">{trail}</span>
        </>
      )}
    </nav>
  );
};
