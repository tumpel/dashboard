import type { CSSProperties } from "react";
import { Toaster as Sonner } from "sonner";

const style: CSSProperties & Record<`--${string}`, string> = {
  "--normal-bg": "var(--popover)",
  "--normal-text": "var(--popover-foreground)",
  "--normal-border": "var(--border)",
};

export const Toaster = () => <Sonner duration={6000} closeButton style={style} />;
