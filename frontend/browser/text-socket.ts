/*
 * The browser WebSocket constructor is not on the no-new allow list, and there is no factory form of it.
 */
/* eslint-disable k13-engineering/no-new */
import type { TDemoSocket } from "../../lib/demo/logic.ts";

/*
 * A WebSocket of the browser that carries text: it reports opening, every message and closing, and sends text. A
 * socket that fails to connect reports closing too.
 */
const createBrowserTextSocket = ({
  url,
  onOpen,
  onText,
  onClose
}: {
  url: string,
  onOpen: () => void,
  onText: (args: { text: string }) => void,
  onClose: () => void
}): TDemoSocket => {
  const socket = new WebSocket(url);

  socket.addEventListener("open", () => {
    onOpen();
  });

  socket.addEventListener("message", (event) => {
    onText({ text: String(event.data) });
  });

  socket.addEventListener("close", () => {
    onClose();
  });

  return {
    send: ({ text }) => {
      socket.send(text);
    }
  };
};

export {
  createBrowserTextSocket
};
