import { githubApi } from "./release-github.mjs";

export const dispatchRelease = async (released, token, transport = fetch, notice = console.log) => {
  if (!token) {
    notice("::notice::CONTROL_PLANE_DISPATCH_TOKEN is empty; skipping component-released dispatch to control-plane.");
    return;
  }
  await githubApi(token, transport)("/repos/tumpel/control-plane/dispatches", {
    method: "POST",
    body: JSON.stringify({ event_type: "component-released", client_payload: released }),
  });
};
