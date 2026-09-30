type TTimer = {
  cancel: () => void;
};

// the clock and the timers of an endpoint, injected so tests control time
type TTimers = {
  // a monotonic time in milliseconds
  now: () => number;
  schedule: (args: { callback: () => void, delayMs: number }) => TTimer;
};

// the timers of node and of the browser alike
const systemTimers: TTimers = {
  now: () => {
    return performance.now();
  },

  schedule: ({ callback, delayMs }) => {
    const handle = setTimeout(callback, delayMs);

    return {
      cancel: () => {
        clearTimeout(handle);
      }
    };
  }
};

export {
  systemTimers
};

export type {
  TTimer,
  TTimers
};
