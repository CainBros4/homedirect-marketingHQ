import "dotenv/config";
import express, { type Request, Response, NextFunction } from "express";
import session from "express-session";
import MemoryStore from "memorystore";
import { registerRoutes } from "./routes";
import { serveStatic } from "./static";
import { createServer } from "http";
import { initMarketingDb } from "./marketing/db";
import { setupMarketingAuth } from "./marketing/auth";
import { registerMarketingRoutes } from "./marketing/routes";
import { registerSeoRoutes } from "./marketing/seo/routes";
import { tickDripEngine } from "./marketing/drip-engine";

const app = express();
const httpServer = createServer(app);

// Trust Railway's proxy so express-session's `secure: true` cookie works.
// Railway terminates TLS at the edge and forwards plain HTTP with
// X-Forwarded-Proto: https. Without this, Express sees http and refuses
// to set the session cookie.
app.set("trust proxy", 1);

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

app.use(
  express.json({
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);

app.use(express.urlencoded({ extended: false }));

// Session — backs the marketing admin auth cookie.
const SessionStore = MemoryStore(session);
app.use(
  session({
    secret: process.env.SESSION_SECRET || "marketinghq-session-secret-change-in-prod",
    resave: false,
    saveUninitialized: false,
    store: new SessionStore({ checkPeriod: 86400000 }),
    cookie: {
      secure: process.env.NODE_ENV === "production",
      httpOnly: true,
      maxAge: 7 * 24 * 60 * 60 * 1000,
    },
  }),
);

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  // Initialize marketing DB + routes before the legacy registerRoutes mounts
  // its Vite catch-all.
  await initMarketingDb();
  setupMarketingAuth(app);
  registerMarketingRoutes(app);
  registerSeoRoutes(app);

  await registerRoutes(httpServer, app);

  app.use((err: any, _req: Request, res: Response, next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    console.error("Internal Server Error:", err);

    if (res.headersSent) {
      return next(err);
    }

    return res.status(status).json({ message });
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (process.env.NODE_ENV === "production") {
    serveStatic(app);
  } else {
    const { setupVite } = await import("./vite");
    await setupVite(httpServer, app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || "5000", 10);
  const host = process.env.HOST || (process.platform === "darwin" ? "127.0.0.1" : "0.0.0.0");
  httpServer.listen(
    {
      port,
      host,
      ...(process.platform !== "darwin" && { reusePort: true }),
    },
    () => {
      log(`serving on http://${host}:${port}`);
    },
  );

  // Drip engine tick — runs every 60s. Safe to run when the queue is empty.
  setInterval(async () => {
    try {
      const result = await tickDripEngine({ maxPerTick: 100 });
      if (result.processed > 0) {
        log(
          `drip tick: processed=${result.processed} sent=${result.sent} errors=${result.errors} skipped=${result.skipped}`,
          "marketing",
        );
      }
    } catch (err) {
      console.error("[marketing/drip-engine] tick error:", err);
    }
  }, 60_000);
})();
