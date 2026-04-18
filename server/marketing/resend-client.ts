// Resend email delivery wrapper.
//
// Uses Resend for all marketing sends (campaigns, drips, broadcasts). Webhooks
// post back to /api/webhooks/resend for open/click/bounce/complaint tracking.
// Transactional emails (offers, walkthroughs, etc) continue to use server/email.ts.

import { Resend } from "resend";

const apiKey = process.env.RESEND_API_KEY;
const resend = apiKey ? new Resend(apiKey) : null;

const fromEmail = process.env.RESEND_FROM_EMAIL || "marketing@trykeylime.ai";
const fromName = process.env.RESEND_FROM_NAME || "Key Lime";
const fromHeader = `${fromName} <${fromEmail}>`;

export interface SendArgs {
  to: string;
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
  tags?: Record<string, string>;
  headers?: Record<string, string>;
}

export interface SendResult {
  success: boolean;
  resendId?: string;
  error?: string;
  stubbed?: boolean; // true when running without a Resend key (dev mode)
}

export function isResendConfigured(): boolean {
  return !!resend;
}

export async function sendEmail(args: SendArgs): Promise<SendResult> {
  if (!resend) {
    console.log(`[marketing/resend] STUB SEND to=${args.to} subject="${args.subject}" (no RESEND_API_KEY)`);
    return { success: true, stubbed: true, resendId: `stub-${Date.now()}` };
  }
  try {
    const tags = args.tags
      ? Object.entries(args.tags).map(([name, value]) => ({ name, value }))
      : undefined;
    const { data, error } = await resend.emails.send({
      from: fromHeader,
      to: args.to,
      subject: args.subject,
      html: args.html,
      text: args.text,
      replyTo: args.replyTo,
      tags,
      headers: args.headers,
    });
    if (error) {
      console.error(`[marketing/resend] send error:`, error);
      return { success: false, error: error.message };
    }
    return { success: true, resendId: data?.id };
  } catch (err: any) {
    console.error(`[marketing/resend] exception:`, err);
    return { success: false, error: err?.message || "unknown error" };
  }
}

// Batch send — Resend supports up to 100 recipients per batch call.
export async function sendBatch(sends: SendArgs[]): Promise<SendResult[]> {
  if (!resend) {
    return sends.map((s) => {
      console.log(`[marketing/resend] STUB BATCH SEND to=${s.to} subject="${s.subject}"`);
      return { success: true, stubbed: true, resendId: `stub-${Date.now()}-${Math.random()}` };
    });
  }
  const BATCH_LIMIT = 100;
  const results: SendResult[] = [];
  for (let i = 0; i < sends.length; i += BATCH_LIMIT) {
    const chunk = sends.slice(i, i + BATCH_LIMIT);
    try {
      const payload = chunk.map((s) => ({
        from: fromHeader,
        to: s.to,
        subject: s.subject,
        html: s.html,
        text: s.text,
        replyTo: s.replyTo,
        tags: s.tags ? Object.entries(s.tags).map(([name, value]) => ({ name, value })) : undefined,
        headers: s.headers,
      }));
      const { data, error } = await resend.batch.send(payload);
      if (error) {
        console.error(`[marketing/resend] batch error:`, error);
        chunk.forEach(() => results.push({ success: false, error: error.message }));
      } else {
        data?.data?.forEach((row: any) => results.push({ success: true, resendId: row.id }));
      }
    } catch (err: any) {
      console.error(`[marketing/resend] batch exception:`, err);
      chunk.forEach(() => results.push({ success: false, error: err?.message || "unknown" }));
    }
  }
  return results;
}
