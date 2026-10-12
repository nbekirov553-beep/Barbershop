import type { IncomingMessage, ServerResponse } from "node:http";
import { createServerApp } from "./create";

/** Один экземпляр Fastify на «тёплый» инстанс функции: подключение к БД переиспользуется между запросами. */
let ready: ReturnType<typeof createServerApp> | undefined;

async function getApp() {
  ready ??= createServerApp().then(async (app) => {
    await app.ready();
    return app;
  });
  return ready;
}

export default async function handler(request: IncomingMessage, response: ServerResponse) {
  try {
    const app = await getApp();
    app.server.emit("request", request, response);
  } catch (error) {
    ready = undefined;
    console.error(error);
    response.statusCode = 500;
    response.setHeader("content-type", "application/json");
    response.end(JSON.stringify({ code: "STARTUP_FAILED", message: "Сервер не запустился" }));
  }
}
