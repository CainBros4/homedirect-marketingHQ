// Admin auth for Marketing HQ.
//
// Two modes:
// 1. SHARED-DB MODE — when DATABASE_URL is set (shared with homedirect).
//    Admin auth uses the `users` table; anyone with role="admin" can log in
//    using their homedirect email/password. Session stored via express-session.
//
// 2. STANDALONE MODE — when no DATABASE_URL. Fallback to a single
//    env-var-based password (MARKETING_ADMIN_PASSWORD). Same session cookie.
//
// This file exposes:
//   - setupAuth(app) — mounts /api/auth/login, /api/auth/logout, /api/auth/me
//   - requireAdmin — express middleware that 401s unless session is admin

import type { Express, Request, Response, NextFunction } from "express";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { marketingDb, marketingDbKind } from "./db";
import { sharedUsers } from "../../shared/schema";

declare module "express-session" {
  interface SessionData {
    adminUserId?: number;
    adminEmail?: string;
  }
}

export function setupMarketingAuth(app: Express) {
  app.post("/api/auth/login", async (req, res) => {
    const { email, password } = req.body || {};
    if (typeof password !== "string") return res.status(400).json({ message: "Password required" });

    if (marketingDbKind === "postgres" && typeof email === "string") {
      // Shared-DB mode: check users table
      try {
        const [user] = await marketingDb
          .select()
          .from(sharedUsers)
          .where(eq(sharedUsers.email, email.toLowerCase()))
          .limit(1);
        if (!user) return res.status(401).json({ message: "Invalid credentials" });
        if (user.role !== "admin") return res.status(403).json({ message: "Admin access required" });
        const ok = await bcrypt.compare(password, user.password);
        if (!ok) return res.status(401).json({ message: "Invalid credentials" });
        req.session.adminUserId = user.id;
        req.session.adminEmail = user.email;
        return res.json({ email: user.email, name: user.fullName });
      } catch (err) {
        console.error("[marketing/auth] login error:", err);
        return res.status(500).json({ message: "Login failed" });
      }
    }

    // Standalone mode: single admin password from env
    const adminPass = process.env.MARKETING_ADMIN_PASSWORD;
    if (!adminPass) {
      return res.status(503).json({
        message: "Admin auth not configured. Set MARKETING_ADMIN_PASSWORD env var or connect to a shared database.",
      });
    }
    if (password !== adminPass) return res.status(401).json({ message: "Invalid password" });
    req.session.adminUserId = 0;
    req.session.adminEmail = "admin@trykeylime.ai";
    return res.json({ email: "admin@trykeylime.ai", name: "Admin" });
  });

  app.post("/api/auth/logout", (req, res) => {
    req.session.destroy(() => res.json({ ok: true }));
  });

  app.get("/api/auth/me", (req, res) => {
    if (!req.session.adminUserId && req.session.adminUserId !== 0) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    res.json({ email: req.session.adminEmail, authenticated: true });
  });
}

// Express middleware: allow through only if session is admin.
export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (req.session?.adminUserId != null) return next();
  res.status(401).json({ message: "Admin access required" });
}
