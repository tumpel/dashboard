import type { TranscriptPage, TranscriptText } from "./api/port";

export const IDLE_READ_MS = 250;
export const IDLE_READ_CAP_MS = 5000;
export const CATCH_UP_READ_MS = 100;

export interface TranscriptView {
  lines: TranscriptText[];
  cursor: number;
  finished: boolean;
  unrecognised: boolean;
  moved: boolean;
  idleReads: number;
}

export const EMPTY_TRANSCRIPT: TranscriptView = {
  lines: [],
  cursor: 0,
  finished: false,
  unrecognised: false,
  moved: false,
  idleReads: 0,
};

export const appendPage = (view: TranscriptView, page: TranscriptPage): TranscriptView => {
  if (page.form === "Unrecognised") return { ...view, unrecognised: true, moved: false };
  const moved = page.cursor > view.cursor;
  return {
    lines: [...view.lines, ...(page.form === "Raw" ? page.lines : page.turns.flatMap((turn) => turn.lines))],
    cursor: page.cursor,
    finished: page.finished,
    unrecognised: false,
    moved,
    idleReads: moved ? 0 : view.idleReads + 1,
  };
};

export const nextReadIn = (state: { status: string; data: TranscriptView | undefined }): number | false => {
  if (state.status === "error") return false;
  const view = state.data;
  if (view === undefined || view.finished || view.unrecognised) return false;
  return view.moved ? CATCH_UP_READ_MS : Math.min(IDLE_READ_MS * 2 ** view.idleReads, IDLE_READ_CAP_MS);
};
