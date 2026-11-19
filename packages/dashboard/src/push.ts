import { PushSubscriptionKeysSchema } from "@tumpel/schemas";
import type { PushSubscription, PushSubscriptionCreate, TumpelApi } from "./api/port";
import type { Wording } from "./api/wording";

export const PUSH_EVENTS: PushSubscriptionCreate["events"] = [
  "TurnCompleted",
  "TurnFailed",
  "SessionFailed",
  "HostOffline",
  "PrebuildDone",
  "PrebuildFailed",
];

export type PushOutcome = { ok: true } | { ok: false; wording: Wording };

const BLOCKED: Wording = {
  title: "Notifications are blocked",
  detail: "This browser does not let Tumpel show notifications.",
  fix: "Allow notifications for this site in the browser's site settings, then turn them on again.",
};

export const pushSupported = (): boolean =>
  "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;

const browserSubscription = async (): Promise<globalThis.PushSubscription | null> => {
  const registration = await navigator.serviceWorker.getRegistration();
  if (registration === undefined) return null;
  return registration.pushManager.getSubscription();
};

export const thisDevice = async (subscriptions: PushSubscription[]): Promise<PushSubscription | null> => {
  const subscription = await browserSubscription();
  return subscriptions.find((stored) => stored.endpoint === subscription?.endpoint) ?? null;
};

export const enablePush = async (api: TumpelApi): Promise<PushOutcome> => {
  if ((await Notification.requestPermission()) !== "granted") return { ok: false, wording: BLOCKED };
  const { applicationServerKey } = await api.getPushKey();
  await navigator.serviceWorker.register("/sw.js");
  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey });
  const keys = PushSubscriptionKeysSchema.parse(subscription.toJSON().keys);
  await api.createPushSubscription({ endpoint: subscription.endpoint, keys, events: PUSH_EVENTS });
  return { ok: true };
};

export const disablePush = async (api: TumpelApi, stored: PushSubscription): Promise<void> => {
  await api.deletePushSubscription(stored.pushSubscriptionId);
  await (await browserSubscription())?.unsubscribe();
};
