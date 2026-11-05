// A plain signal: every write that changes what the user sees outside the app (home
// screen widgets) calls dataChanged() once it has committed. Listeners decide what to
// do with it, so the data layer never depends on the widget code.

type Listener = () => void;

const listeners = new Set<Listener>();

export function onDataChanged(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function dataChanged() {
  for (const listener of listeners) {
    try {
      listener();
    } catch {
      // A listener failing must never fail the write that called it.
    }
  }
}
