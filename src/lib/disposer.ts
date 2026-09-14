/**
 * createDisposer — a lightweight teardown registry for React islands.
 *
 * WHY: Islands that attach `addEventListener`, start `setInterval`, or create
 * `IntersectionObserver` must remove those side-effects when the component
 * unmounts. A plain `useEffect` with a manually written cleanup is error-prone
 * (easy to forget one registration). `createDisposer` lets you register any
 * teardown function in one place and call `dispose()` once to run all of them.
 *
 * USAGE (inside useEffect):
 *   const d = createDisposer();
 *   d.on(window, 'resize', handleResize);        // addEventListener wrapper
 *   d.interval(1000, () => poll());              // setInterval wrapper
 *   const observer = new IntersectionObserver(cb);
 *   observer.observe(el);
 *   d.add(() => observer.disconnect());          // arbitrary teardown fn
 *   return d.dispose;                            // useEffect cleanup
 */

type Teardown = () => void;

export interface Disposer {
  /** Register an arbitrary cleanup function. */
  add(fn: Teardown): void;
  /**
   * addEventListener wrapper. Registers the listener and automatically queues
   * removeEventListener as the teardown.
   */
  on<K extends keyof WindowEventMap>(
    target: Window,
    type: K,
    listener: (ev: WindowEventMap[K]) => void,
    options?: boolean | AddEventListenerOptions,
  ): void;
  on<K extends keyof DocumentEventMap>(
    target: Document,
    type: K,
    listener: (ev: DocumentEventMap[K]) => void,
    options?: boolean | AddEventListenerOptions,
  ): void;
  on(
    target: EventTarget,
    type: string,
    listener: EventListenerOrEventListenerObject,
    options?: boolean | AddEventListenerOptions,
  ): void;
  /**
   * setInterval wrapper. Starts the interval and queues clearInterval as the
   * teardown.
   */
  interval(ms: number, fn: () => void): void;
  /**
   * setTimeout wrapper. Starts the timer and queues clearTimeout as the
   * teardown. Useful for debounced teardowns or deferred initialization.
   */
  timeout(ms: number, fn: () => void): void;
  /**
   * Run all registered teardowns in LIFO order. Safe to call multiple times —
   * the registry is cleared on first call.
   */
  dispose(): void;
}

export function createDisposer(): Disposer {
  const teardowns: Teardown[] = [];

  const add = (fn: Teardown) => {
    teardowns.push(fn);
  };

  const on = (
    target: EventTarget,
    type: string,
    listener: EventListenerOrEventListenerObject,
    options?: boolean | AddEventListenerOptions,
  ) => {
    target.addEventListener(type, listener, options);
    teardowns.push(() => target.removeEventListener(type, listener, options));
  };

  const interval = (ms: number, fn: () => void) => {
    const id = setInterval(fn, ms);
    teardowns.push(() => clearInterval(id));
  };

  const timeout = (ms: number, fn: () => void) => {
    const id = setTimeout(fn, ms);
    teardowns.push(() => clearTimeout(id));
  };

  const dispose = () => {
    // LIFO: last-registered teardown runs first.
    let i = teardowns.length;
    while (i-- > 0) {
      try {
        // i is decrement-bounded by teardowns.length — never out of range.
        teardowns[i]!();
      } catch {
        // Individual teardown errors must not prevent the rest from running.
      }
    }
    teardowns.length = 0;
  };

  return { add, on, interval, timeout, dispose };
}
