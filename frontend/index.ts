import { createLampApp } from "./lamp/app.ts";

// the server of this page serves the socket of the demo, over tls if it serves the page over tls
const socketScheme = window.location.protocol === "https:" ? "wss" : "ws";

createLampApp({
  container: document.querySelector("#demo") as HTMLElement,
  socketUrl: `${socketScheme}://${window.location.host}/api/lamp`
});
