import { createGameServer } from "./app.js";
const server = createGameServer({ allowedOrigins: [...(process.env.ALLOWED_ORIGINS || "").split(",").map(origin => origin.trim()), process.env.RENDER_EXTERNAL_URL].filter(Boolean) });
const port = Number(process.env.PORT) || 3001;
server.http.listen(port, process.env.HOST || "0.0.0.0", () => console.log(`DavRA tayyor: http://localhost:${port} (PID ${process.pid})`));
process.on("SIGINT", async () => {
  await server.close();
  process.exit(0);
});
process.on("SIGTERM", async () => {
  await server.close();
  process.exit(0);
});

