let needed = false;
const listeners = new Set<() => void>();

export const serviceUpdate = {
  get: (): boolean => needed,
  subscribe: (listener: () => void): (() => void) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  report: (): void => {
    needed = true;
    for (const listener of listeners) listener();
  },
};
