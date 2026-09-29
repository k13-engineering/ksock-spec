import type { WebSocket } from "ws";

// the socket of the live demo: every message goes back as it came, text as text, binary as binary
const serveDemoSocket = ({ webSocket }: { webSocket: WebSocket }) => {
  // ws dictates the positional parameters of its event listeners
  // eslint-disable-next-line k13-engineering/prefer-single-object-parameters
  webSocket.on("message", (data, isBinary) => {
    webSocket.send(data, { binary: isBinary });
  });
};

export {
  serveDemoSocket
};
