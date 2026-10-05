/**
 * Latest-wins sequencing for chapter loads (process/CHAPTER_SWITCH_SERVICE.md).
 *
 * A selection that changes while a load is in flight must not be dropped: the
 * in-flight load finishes for the chapter it started with, and the runner then
 * loads again for whatever is selected now, repeating until the last load
 * matched the selection it finished under. Calls made during a run join it
 * rather than starting a second, concurrent one.
 */
export interface LatestWinsRunner {
  /** Load the current selection; resolves once a load has matched it. */
  run(): Promise<void>;
}

export function createLatestWinsRunner<T>(
  current: () => T,
  load: (target: T) => Promise<void>
): LatestWinsRunner {
  let inFlight: Promise<void> | null = null;

  async function drain(): Promise<void> {
    let target: T;
    do {
      target = current();
      try {
        await load(target);
      } catch {
        // A failed load is the loader's to report; the loop still settles on
        // the latest selection rather than stopping at a stale one.
      }
    } while (current() !== target);
  }

  return {
    run() {
      if (!inFlight) {
        inFlight = drain().finally(() => {
          inFlight = null;
        });
      }
      return inFlight;
    },
  };
}
