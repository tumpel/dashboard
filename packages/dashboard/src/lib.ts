import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export const cn = (...inputs: ClassValue[]): string => twMerge(clsx(inputs));

export const switchedPath = (pathname: string, tenantId: string): string =>
  pathname.replace(/^\/t\/[^/]+/, `/t/${tenantId}`).replace(/^(\/t\/[^/]+\/[^/]+)\/.+$/, "$1");
