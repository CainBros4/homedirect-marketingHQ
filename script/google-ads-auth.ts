/**
 * Google Ads OAuth2 Refresh Token Generator
 *
 * Run this once to get a refresh token for the Google Ads API.
 * Usage: npx tsx script/google-ads-auth.ts
 *
 * Requirements in .env:
 *   GOOGLE_ADS_CLIENT_ID
 *   GOOGLE_ADS_CLIENT_SECRET
 *
 * After running, paste the printed refresh token into .env as:
 *   GOOGLE_ADS_REFRESH_TOKEN=...
 */

import http from "http";
import { URL } from "url";
import crypto from "crypto";
import { exec } from "child_process";
import * as dotenv from "dotenv";

dotenv.config();

const CLIENT_ID = process.env.GOOGLE_ADS_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_ADS_CLIENT_SECRET;
const REDIRECT_URI = "http://localhost:3333/oauth/callback";
const SCOPE = "https://www.googleapis.com/auth/adwords";

function fail(msg: string): never {
  console.error("❌", msg);
  process.exit(1);
}

if (!CLIENT_ID) fail("GOOGLE_ADS_CLIENT_ID missing from .env");
if (!CLIENT_SECRET) fail("GOOGLE_ADS_CLIENT_SECRET missing from .env — add it before running");

const state = crypto.randomBytes(16).toString("hex");
const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
authUrl.searchParams.set("client_id", CLIENT_ID);
authUrl.searchParams.set("redirect_uri", REDIRECT_URI);
authUrl.searchParams.set("response_type", "code");
authUrl.searchParams.set("scope", SCOPE);
authUrl.searchParams.set("access_type", "offline");
authUrl.searchParams.set("prompt", "consent");
authUrl.searchParams.set("state", state);

console.log("\n📡 Starting OAuth2 flow for Google Ads API");
console.log("   Redirect URI:", REDIRECT_URI);
console.log("   Scope:", SCOPE);
console.log("\n🌐 Opening browser to authorize...\n");

async function exchangeCodeForToken(code: string): Promise<{ refresh_token?: string; access_token: string; error?: string }> {
  const body = new URLSearchParams({
    code,
    client_id: CLIENT_ID!,
    client_secret: CLIENT_SECRET!,
    redirect_uri: REDIRECT_URI,
    grant_type: "authorization_code",
  });
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  return res.json() as Promise<{ refresh_token?: string; access_token: string; error?: string }>;
}

const server = http.createServer(async (req, res) => {
  if (!req.url?.startsWith("/oauth/callback")) {
    res.writeHead(404);
    res.end();
    return;
  }
  const url = new URL(req.url, REDIRECT_URI);
  const code = url.searchParams.get("code");
  const returnedState = url.searchParams.get("state");
  const error = url.searchParams.get("error");

  if (error) {
    res.writeHead(400, { "Content-Type": "text/html" });
    res.end(`<h1>OAuth error</h1><pre>${error}</pre>`);
    console.error("❌ OAuth error:", error);
    server.close();
    process.exit(1);
  }

  if (!code) {
    res.writeHead(400);
    res.end("Missing code");
    return;
  }

  if (returnedState !== state) {
    res.writeHead(400);
    res.end("State mismatch — possible CSRF");
    console.error("❌ State mismatch");
    server.close();
    process.exit(1);
  }

  try {
    const token = await exchangeCodeForToken(code);
    if (token.error || !token.refresh_token) {
      res.writeHead(500, { "Content-Type": "text/html" });
      res.end(`<h1>Token exchange failed</h1><pre>${JSON.stringify(token, null, 2)}</pre>`);
      console.error("❌ Token exchange failed:", token);
      server.close();
      process.exit(1);
    }

    res.writeHead(200, { "Content-Type": "text/html" });
    res.end(`
      <html><body style="font-family:system-ui;padding:40px;max-width:600px">
        <h1 style="color:#00C47A">✓ Refresh token obtained</h1>
        <p>You can close this tab and return to your terminal.</p>
        <p>The refresh token has been printed there — add it to your <code>.env</code>.</p>
      </body></html>
    `);

    console.log("\n✅ SUCCESS — refresh token obtained\n");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("Add this line to your .env file:");
    console.log("");
    console.log(`GOOGLE_ADS_REFRESH_TOKEN=${token.refresh_token}`);
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("");
    console.log("After adding it, restart your dev server.");

    server.close();
    process.exit(0);
  } catch (e) {
    res.writeHead(500);
    res.end(`Error: ${(e as Error).message}`);
    console.error("❌", e);
    server.close();
    process.exit(1);
  }
});

server.listen(3333, () => {
  console.log(`🎧 Listening on ${REDIRECT_URI}`);
  exec(`open "${authUrl.toString()}"`, err => {
    if (err) {
      console.log("\n⚠️  Couldn't auto-open browser. Paste this URL manually:");
      console.log(authUrl.toString());
    }
  });
});
