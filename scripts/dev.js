import { spawn } from "node:child_process";
const children = [spawn(process.execPath, ["--watch", "server/index.js"], { stdio: "inherit" }), spawn(process.execPath, ["node_modules/vite/bin/vite.js"], { stdio: "inherit" })];
let stopping = false;
function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  children.forEach((p) => p.kill());
  process.exit(code);
}
children.forEach((p) => p.on("exit", (code) => stop(code || 0)));
process.on("SIGINT", () => stop());
process.on("SIGTERM", () => stop());

