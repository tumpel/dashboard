import { z } from "zod";

const StoredSignInSchema = z.object({
  tenantId: z.string(),
  tenantName: z.string(),
  email: z.string(),
  refreshToken: z.string(),
});

const StoredSignInsSchema = z.record(z.string(), StoredSignInSchema);

export type StoredSignIn = z.infer<typeof StoredSignInSchema>;

const KEY = "tumpel.signins";

export const storageOf = (kind: "localStorage" | "sessionStorage"): Storage | null => {
  try {
    return window[kind];
  } catch {
    return null;
  }
};

export const readSignIns = (): Record<string, StoredSignIn> => {
  const parsed = StoredSignInsSchema.safeParse(JSON.parse(storageOf("localStorage")?.getItem(KEY) ?? "{}"));
  return parsed.success ? parsed.data : {};
};

export const writeSignIn = (signIn: StoredSignIn): void => {
  storageOf("localStorage")?.setItem(KEY, JSON.stringify({ ...readSignIns(), [signIn.tenantId]: signIn }));
};

export const forgetSignIn = (tenantId: string): void => {
  const { [tenantId]: _forgotten, ...rest } = readSignIns();
  storageOf("localStorage")?.setItem(KEY, JSON.stringify(rest));
};

export const forgetAllSignIns = (): void => {
  storageOf("localStorage")?.removeItem(KEY);
};
