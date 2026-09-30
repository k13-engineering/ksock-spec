import type { TTimer, TTimers } from "../ksock/timers.ts";
import type { TDieRoll, TLampBackendModel, TSwitchLamp } from "./protocol.ts";

type TLampSession = {
  model: () => TLampBackendModel;
  switchLamp: (args: TSwitchLamp) => void;
  rollDie: () => Promise<TDieRoll>;
  disconnect: () => void;
};

// runs callbacks after the delay of the backend, and cancels the ones still waiting when the backend stops
const createDelays = ({ timers, delayMs }: { timers: TTimers, delayMs: number }) => {
  let nextId = 0;
  let waiting: { id: number, timer: TTimer }[] = [];

  return {
    after: ({ callback }: { callback: () => void }) => {
      const id = nextId;
      nextId += 1;

      const timer = timers.schedule({
        delayMs,
        callback: () => {
          waiting = waiting.filter((each) => {
            return each.id !== id;
          });
          callback();
        }
      });

      waiting = [...waiting, { id, timer }];
    },

    cancelAll: () => {
      waiting.forEach(({ timer }) => {
        timer.cancel();
      });
      waiting = [];
    }
  };
};

/*
 * The backend of the lamp demo: one lamp that every client switches, and for each client the sequence of its last
 * request processed, which the model it gets mirrors (3.3). Every request takes the delay, so a button can be seen
 * spinning.
 */
const createLampBackend = ({ delayMs, timers, random }: { delayMs: number, timers: TTimers, random: () => number }) => {
  let on = false;
  let nextSessionId = 0;
  let listeners: { id: number, changed: () => void }[] = [];

  const delays = createDelays({ timers, delayMs });

  const changedAll = () => {
    listeners.forEach(({ changed }) => {
      changed();
    });
  };

  const connect = ({ onModelChanged }: { onModelChanged: (args: { model: TLampBackendModel }) => void }): TLampSession => {
    const id = nextSessionId;
    nextSessionId += 1;
    let accepted = 0;
    let mirrored = 0;

    const model = () => {
      return { lamp: { on }, requestSequence: mirrored };
    };

    const changed = () => {
      onModelChanged({ model: model() });
    };

    listeners = [...listeners, { id, changed }];

    return {
      model,

      // a request is processed once, even if it is sent again, and mirrored in the same change as its result
      switchLamp: ({ requestSequence, on: requested }) => {
        if (requestSequence > accepted) {
          accepted = requestSequence;
          delays.after({
            callback: () => {
              on = requested;
              mirrored = requestSequence;
              changedAll();
            }
          });
        }
      },

      rollDie: () => {
        return new Promise((resolve) => {
          delays.after({
            callback: () => {
              resolve({ value: 1 + Math.floor(random() * 6) });
            }
          });
        });
      },

      disconnect: () => {
        listeners = listeners.filter((listener) => {
          return listener.id !== id;
        });
      }
    };
  };

  return {
    connect,
    stop: delays.cancelAll
  };
};

type TLampBackend = ReturnType<typeof createLampBackend>;

export {
  createLampBackend
};

export type {
  TLampBackend,
  TLampSession
};
