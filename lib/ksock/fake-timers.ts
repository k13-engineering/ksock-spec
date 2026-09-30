// timers whose time only passes when a test advances it
import type { TTimer, TTimers } from "./timers.ts";

type TScheduled = { id: number, at: number, callback: () => void };

const createFakeTimers = () => {
  let now = 0;
  let nextId = 0;
  let scheduled: TScheduled[] = [];

  const timers: TTimers = {
    now: () => {
      return now;
    },

    schedule: ({ callback, delayMs }): TTimer => {
      const id = nextId;
      nextId += 1;
      scheduled = [...scheduled, { id, at: now + delayMs, callback }];

      return {
        cancel: () => {
          scheduled = scheduled.filter((timer) => {
            return timer.id !== id;
          });
        }
      };
    }
  };

  const nextDue = ({ until }: { until: number }) => {
    return scheduled.filter((timer) => {
      return timer.at <= until;
    }).toSorted((a, b) => {
      return a.at - b.at || a.id - b.id;
    })[0];
  };

  // runs the timers due in the order they are due, and whatever should happen after each
  const advance = ({ ms, afterEach = () => {} }: { ms: number, afterEach?: () => void }) => {
    const until = now + ms;

    for (let due = nextDue({ until }); due !== undefined; due = nextDue({ until })) {
      const { id } = due;
      scheduled = scheduled.filter((timer) => {
        return timer.id !== id;
      });
      now = due.at;
      due.callback();
      afterEach();
    }

    now = until;
  };

  return {
    timers,
    advance
  };
};

export {
  createFakeTimers
};
