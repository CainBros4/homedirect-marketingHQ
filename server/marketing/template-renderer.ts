// Template rendering — substitutes {{variable}} placeholders with contact data
// and appends the compliance footer (unsubscribe link + physical address).
// CAN-SPAM requires a working unsubscribe mechanism and a postal address in every
// commercial email. We enforce that here rather than trusting templates to include it.

import type { Contact, EmailTemplate } from "../../shared/schema";

const APP_BASE_URL = process.env.APP_BASE_URL || "https://www.trykeylime.ai";
const PHYSICAL_ADDRESS = "Key Lime · Tampa, FL";

export interface RenderContext {
  contact: Contact;
  unsubscribeToken: string;
  extraVars?: Record<string, string>;
}

export interface RenderedEmail {
  subject: string;
  preheader: string;
  html: string;
  text: string;
}

export function render(template: EmailTemplate, ctx: RenderContext): RenderedEmail {
  const vars = buildVariableMap(ctx);
  return {
    subject: substitute(template.subject, vars),
    preheader: substitute(template.preheader || "", vars),
    html: injectFooter(substitute(template.htmlBody, vars), ctx.unsubscribeToken, "html"),
    text: injectFooter(substitute(template.textBody || htmlToText(template.htmlBody), vars), ctx.unsubscribeToken, "text"),
  };
}

function buildVariableMap(ctx: RenderContext): Record<string, string> {
  const c = ctx.contact;
  const unsubscribeUrl = `${APP_BASE_URL}/u/${ctx.unsubscribeToken}`;
  return {
    first_name: c.firstName || "there",
    last_name: c.lastName || "",
    full_name: [c.firstName, c.lastName].filter(Boolean).join(" ") || "there",
    email: c.email,
    phone: c.phone || "",
    address: c.address || "",
    city: c.city || "",
    state: c.state || "",
    zip: c.zip || "",
    unsubscribe_url: unsubscribeUrl,
    ...(ctx.extraVars || {}),
  };
}

function substitute(text: string, vars: Record<string, string>): string {
  return text.replace(/\{\{\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\}\}/g, (_, key) => {
    const val = vars[key];
    return val !== undefined ? val : "";
  });
}

function injectFooter(body: string, token: string, kind: "html" | "text"): string {
  const unsubUrl = `${APP_BASE_URL}/u/${token}`;
  if (kind === "html") {
    if (body.includes(unsubUrl) || body.toLowerCase().includes("unsubscribe")) return body;
    const footer = `\n<hr style="border:none;border-top:1px solid #eee;margin:32px 0 16px"/>
<p style="color:#888;font-size:12px;line-height:1.6;font-family:system-ui,sans-serif">
  You're receiving this because you engaged with Key Lime or a listing in your market.<br/>
  <a href="${unsubUrl}" style="color:#888">Unsubscribe</a> · ${PHYSICAL_ADDRESS}
</p>`;
    return body + footer;
  }
  if (body.toLowerCase().includes("unsubscribe")) return body;
  return `${body}\n\n---\nUnsubscribe: ${unsubUrl}\n${PHYSICAL_ADDRESS}\n`;
}

function htmlToText(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<[^>]+>/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// Generate a single-use unsubscribe token. Stateless — token encodes contact id
// and a HMAC. Keeps us from storing a separate tokens table.
import crypto from "crypto";

export function generateUnsubscribeToken(contactId: number): string {
  const secret = process.env.SESSION_SECRET || "dev-secret";
  const payload = Buffer.from(`${contactId}:${Date.now()}`).toString("base64url");
  const sig = crypto.createHmac("sha256", secret).update(payload).digest("base64url").slice(0, 16);
  return `${payload}.${sig}`;
}

export function verifyUnsubscribeToken(token: string): number | null {
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return null;
  const secret = process.env.SESSION_SECRET || "dev-secret";
  const expected = crypto.createHmac("sha256", secret).update(payload).digest("base64url").slice(0, 16);
  if (sig !== expected) return null;
  const decoded = Buffer.from(payload, "base64url").toString("utf-8");
  const [idStr] = decoded.split(":");
  const id = parseInt(idStr, 10);
  return Number.isFinite(id) ? id : null;
}
