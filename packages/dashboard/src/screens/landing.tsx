import { landingPage, linksFor, shellBody } from "@tumpel/pages";
import "@tumpel/pages/shell.css";
import { useLayoutEffect, useRef } from "react";
import { useDashboard } from "../context";

export const LandingScreen = () => {
  const { ports } = useDashboard();
  const root = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    if (root.current === null) return;
    const links = linksFor({ dashboard: window.location.origin, api: ports.apiOrigin });
    root.current.innerHTML = shellBody(landingPage(links), { links, path: "/", at: new Date() });
    document.title = "Tumpel";
  }, [ports]);
  return <div ref={root} />;
};
