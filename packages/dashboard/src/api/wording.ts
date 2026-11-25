import type { Failure } from "./port.ts";

export interface Wording {
  title: string;
  detail: string;
  fix: string;
}

export const wordingOf = (failure: Failure): Wording => {
  if (failure.kind === "Problem") return failure.problem;
  if (failure.kind === "Unreachable") {
    return {
      title: "The control plane did not answer",
      detail: `${failure.detail} Your changes, if any, were not sent.`,
      fix: "Check your connection, then retry.",
    };
  }
  if (failure.kind === "OutOfStep") {
    return {
      title: `The dashboard and the API are out of step on ${failure.operation}`,
      detail: failure.detail,
      fix: "Reload; if it stays, the deploy is still rolling.",
    };
  }
  return {
    title: "The control plane answered something unexpected",
    detail: failure.detail,
    fix: "Retry. If it keeps failing, report it with the time shown.",
  };
};

export const updateNotice = (unrecognised: readonly unknown[]): Wording => ({
  title: "This dashboard may need an update",
  detail: `The service sent something this version does not recognise: ${unrecognised.map((value) => JSON.stringify(value)).join(", ")}.`,
  fix: "Reload the page; an update likely fixes it.",
});
export const UNRECOGNISED_LABEL = "Unknown";
