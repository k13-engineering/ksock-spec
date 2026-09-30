import type { TTimer, TTimers } from "./timers.ts";

/*
 * The heartbeats of an endpoint (1.4): it sends a heartbeat once it has sent nothing for half the heartbeat timeout of
 * the other endpoint, and times out once it has received nothing for its own heartbeat timeout.
 */
const createKsockHeartbeats = ({
  timers,
  heartbeatTimeout,
  lastSentAt,
  sendHeartbeat,
  timedOut
}: {
  timers: TTimers,
  heartbeatTimeout: number,
  lastSentAt: () => number,
  sendHeartbeat: () => void,
  timedOut: () => void
}) => {
  let sendTimer: TTimer | undefined = undefined;
  let receiveTimer: TTimer | undefined = undefined;

  // anything sent in the meantime counts as a heartbeat, so the timer only sends one if nothing else went out
  const scheduleHeartbeat = ({ interval }: { interval: number }) => {
    sendTimer = timers.schedule({
      delayMs: Math.max(0, lastSentAt() + interval - timers.now()),
      callback: () => {
        if (timers.now() - lastSentAt() >= interval) {
          sendHeartbeat();
        }

        scheduleHeartbeat({ interval });
      }
    });
  };

  const awaitNotification = () => {
    receiveTimer?.cancel();
    receiveTimer = timers.schedule({
      delayMs: heartbeatTimeout,
      callback: () => {
        sendTimer?.cancel();
        timedOut();
      }
    });
  };

  return {
    // the time runs from the opening of the WebSocket
    start: awaitNotification,
    received: awaitNotification,

    peerTimeoutKnown: ({ peerTimeout }: { peerTimeout: number }) => {
      scheduleHeartbeat({ interval: peerTimeout / 2 });
    },

    stop: () => {
      sendTimer?.cancel();
      receiveTimer?.cancel();
    }
  };
};

type TKsockHeartbeats = ReturnType<typeof createKsockHeartbeats>;

export {
  createKsockHeartbeats
};

export type {
  TKsockHeartbeats
};
