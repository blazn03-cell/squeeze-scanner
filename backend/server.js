import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import barsHandler from "../api/bars.js";
import quotesHandler from "../api/quotes.js";

const indexPath = fileURLToPath(new URL("../index.html", import.meta.url));
const port = Number.parseInt(process.env.PORT, 10) || 10000;

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    "Content-Type":"application/json; charset=utf-8",
    "Cache-Control":"no-store",
  });
  response.end(JSON.stringify(payload));
}

function routeResponse(response) {
  return {
    setHeader(name, value) {
      response.setHeader(name, value);
      return this;
    },
    status(statusCode) {
      response.statusCode = statusCode;
      return this;
    },
    json(payload) {
      if (!response.hasHeader("Content-Type")) {
        response.setHeader("Content-Type", "application/json; charset=utf-8");
      }
      response.end(JSON.stringify(payload));
      return this;
    },
  };
}

async function runApiHandler(handler, request, response, url) {
  request.query = Object.fromEntries(url.searchParams.entries());
  try {
    await handler(request, routeResponse(response));
  } catch (error) {
    console.error(`[server] ${url.pathname} failed`, error);
    if (!response.headersSent) {
      sendJson(response, 500, { ok:false, reason:"SERVER_ERROR" });
    } else if (!response.writableEnded) {
      response.end();
    }
  }
}

async function serveApp(response) {
  try {
    const html = await readFile(indexPath);
    response.writeHead(200, {
      "Content-Type":"text/html; charset=utf-8",
      "Cache-Control":"no-cache",
    });
    response.end(html);
  } catch (error) {
    console.error("[server] Could not read index.html", error);
    sendJson(response, 500, { ok:false, reason:"APP_FILE_MISSING" });
  }
}

const server = createServer(async (request, response) => {
  const url = new URL(request.url || "/", `http://${request.headers.host || "localhost"}`);

  if (request.method !== "GET") {
    response.setHeader("Allow", "GET");
    return sendJson(response, 405, { ok:false, reason:"METHOD_NOT_ALLOWED" });
  }

  if (url.pathname === "/api/health") {
    return sendJson(response, 200, {
      ok:true,
      service:"wallstreethustler",
      time:new Date().toISOString(),
    });
  }
  if (url.pathname === "/api/bars") return runApiHandler(barsHandler, request, response, url);
  if (url.pathname === "/api/quotes") return runApiHandler(quotesHandler, request, response, url);
  if (url.pathname.startsWith("/api/")) {
    return sendJson(response, 404, { ok:false, reason:"API_ROUTE_NOT_FOUND" });
  }
  if (url.pathname === "/favicon.ico") {
    response.writeHead(204);
    return response.end();
  }
  return serveApp(response);
});

function hasBarsProvider() {
  return Boolean(
    (process.env.ALPACA_API_KEY_ID && process.env.ALPACA_API_SECRET_KEY)
    || process.env.TWELVEDATA_API_KEY
    || process.env.POLYGON_API_KEY
    || process.env.TIINGO_API_KEY
    || process.env.ALPHAVANTAGE_API_KEY
  );
}

function hasQuoteProvider() {
  return Boolean(
    (process.env.ALPACA_API_KEY_ID && process.env.ALPACA_API_SECRET_KEY)
    || process.env.MASSIVE_API_KEY
    || process.env.POLYGON_API_KEY
    || process.env.TIINGO_API_KEY
  );
}

server.listen(port, "0.0.0.0", () => {
  console.log(`[server] WallstreetHustler listening on port ${port}`);
  console.log(`[server] Health check: http://localhost:${port}/api/health`);
  if (!hasBarsProvider()) {
    console.warn("[server] Warning: no historical-bars provider is configured; the app will show setup help.");
  }
  if (!hasQuoteProvider()) {
    console.warn("[server] Warning: no bid/ask quote provider is configured; spread checks will remain unverified.");
  }
});

function shutdown(signal) {
  console.log(`[server] ${signal} received; closing.`);
  server.close(() => process.exit(0));
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
