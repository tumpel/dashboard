import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { TranscriptPage, TranscriptText } from "./api/port";
import { useTenantApi } from "./context";
import { keys } from "./queries";

export const IDLE_READ_MS = 250;
export const IDLE_READ_CAP_MS = 5000;
export const CATCH_UP_READ_MS = 100;

export interface TranscriptView {
  lines: TranscriptText[];
  cursor: number;
  finished: boolean;
  moved: boolean;
  idleReads: number;
}

export const EMPTY_TRANSCRIPT: TranscriptView = { lines: [], cursor: 0, finished: false, moved: false, idleReads: 0 };

export const appendPage = (view: TranscriptView, page: TranscriptPage): TranscriptView => {
  if (page.form === "Unrecognised") return { ...view, finished: true, moved: false };
  const moved = page.cursor > view.cursor;
  return {
    lines: [...view.lines, ...(page.form === "Raw" ? page.lines : page.turns.flatMap((turn) => turn.lines))],
    cursor: page.cursor,
    finished: page.finished,
    moved,
    idleReads: moved ? 0 : view.idleReads + 1,
  };
};

export const nextReadIn = (state: { status: string; data: TranscriptView | undefined }): number | false => {
  if (state.status === "error") return false;
  const view = state.data;
  if (view === undefined || view.finished) return false;
  return view.moved ? CATCH_UP_READ_MS : Math.min(IDLE_READ_MS * 2 ** view.idleReads, IDLE_READ_CAP_MS);
};

export const useTranscript = (tenantId: string, sessionId: string, turnId: string, compact: boolean) => {
  const api = useTenantApi(tenantId);
  const queryClient = useQueryClient();
  const queryKey = keys.transcript(tenantId, sessionId, turnId, compact);
  return useQuery({
    queryKey,
    queryFn: async () => {
      const view = queryClient.getQueryData<TranscriptView>(queryKey) ?? EMPTY_TRANSCRIPT;
      const page = await api.readTranscript(sessionId, {
        turnId,
        compact: compact ? true : undefined,
        after: view.cursor === 0 ? undefined : view.cursor,
      });
      return appendPage(view, page);
    },
    refetchInterval: (query) => nextReadIn(query.state),
    staleTime: Number.POSITIVE_INFINITY,
    gcTime: 0,
  });
};
