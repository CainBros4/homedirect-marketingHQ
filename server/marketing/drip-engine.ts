// Drip engine — runs on a cron tick, finds enrollments whose next_send_at has
// passed, sends the appropriate email, advances the step, and schedules the
// next one. Idempotent: safe to call multiple times; each step is only sent
// once per (enrollment, step) pair because we advance current_step atomically.

import { marketingDb as db } from "./db";
import {
  contacts,
  dripEnrollments,
  dripSequences,
  dripSteps,
  emailEvents,
  emailTemplates,
} from "../../shared/schema";
import { and, eq, lte, asc } from "drizzle-orm";
import { sendEmail } from "./resend-client";
import { render, generateUnsubscribeToken } from "./template-renderer";

interface TickResult {
  processed: number;
  sent: number;
  errors: number;
  skipped: number;
}

export async function tickDripEngine(opts: { maxPerTick?: number } = {}): Promise<TickResult> {
  const result: TickResult = { processed: 0, sent: 0, errors: 0, skipped: 0 };
  const nowIso = new Date().toISOString();

  const dueEnrollments = await db
    .select()
    .from(dripEnrollments)
    .where(
      and(
        eq(dripEnrollments.status, "active"),
        lte(dripEnrollments.nextSendAt, nowIso),
      ),
    )
    .limit(opts.maxPerTick ?? 100);

  for (const enr of dueEnrollments) {
    result.processed++;
    try {
      const processed = await processEnrollment(enr);
      if (processed === "sent") result.sent++;
      else if (processed === "skipped") result.skipped++;
    } catch (err) {
      console.error(`[marketing/drip] error processing enrollment ${enr.id}:`, err);
      result.errors++;
    }
  }

  return result;
}

async function processEnrollment(
  enrollment: typeof dripEnrollments.$inferSelect,
): Promise<"sent" | "skipped" | "completed"> {
  const [contact] = await db.select().from(contacts).where(eq(contacts.id, enrollment.contactId)).limit(1);
  if (!contact) {
    await db.update(dripEnrollments).set({ status: "exited" }).where(eq(dripEnrollments.id, enrollment.id));
    return "skipped";
  }
  if (contact.optedOut || contact.bouncedAt) {
    await db.update(dripEnrollments).set({ status: "exited" }).where(eq(dripEnrollments.id, enrollment.id));
    return "skipped";
  }

  // Find the step to send: current_step is the step about to be sent (0-indexed logical position).
  const steps = await db
    .select()
    .from(dripSteps)
    .where(eq(dripSteps.sequenceId, enrollment.sequenceId))
    .orderBy(asc(dripSteps.stepOrder));

  if (enrollment.currentStep >= steps.length) {
    await db.update(dripEnrollments).set({ status: "completed" }).where(eq(dripEnrollments.id, enrollment.id));
    return "completed";
  }

  const step = steps[enrollment.currentStep];
  const [template] = await db
    .select()
    .from(emailTemplates)
    .where(eq(emailTemplates.id, step.templateId))
    .limit(1);
  if (!template) {
    console.error(`[marketing/drip] missing template ${step.templateId} for step ${step.id}`);
    await db.update(dripEnrollments).set({ status: "paused" }).where(eq(dripEnrollments.id, enrollment.id));
    return "skipped";
  }

  const token = generateUnsubscribeToken(contact.id);
  const rendered = render(template, { contact, unsubscribeToken: token });

  const send = await sendEmail({
    to: contact.email,
    subject: rendered.subject,
    html: rendered.html,
    text: rendered.text,
    tags: { sequence_id: String(enrollment.sequenceId), step_id: String(step.id) },
    headers: {
      "List-Unsubscribe": `<${process.env.APP_BASE_URL || "https://www.trykeylime.ai"}/u/${token}>`,
      "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
    },
  });

  await db.insert(emailEvents).values({
    contactId: contact.id,
    dripStepId: step.id,
    resendEmailId: send.resendId,
    eventType: send.success ? "sent" : "failed",
    eventData: JSON.stringify(send),
    createdAt: new Date().toISOString(),
  });

  if (!send.success) {
    await db
      .update(dripEnrollments)
      .set({ status: "paused" })
      .where(eq(dripEnrollments.id, enrollment.id));
    return "skipped";
  }

  // Advance to next step or complete.
  const nextStepIndex = enrollment.currentStep + 1;
  const isLast = nextStepIndex >= steps.length;
  const nextStep = steps[nextStepIndex];
  const nextSendAt = isLast
    ? null
    : new Date(Date.now() + (nextStep.delayHours * 60 * 60 * 1000)).toISOString();

  await db
    .update(dripEnrollments)
    .set({
      currentStep: nextStepIndex,
      lastSentAt: new Date().toISOString(),
      nextSendAt,
      status: isLast ? "completed" : "active",
    })
    .where(eq(dripEnrollments.id, enrollment.id));

  return "sent";
}

// Enroll a contact into a drip sequence. Sets next_send_at based on step 0's delayHours.
export async function enrollContact(sequenceId: number, contactId: number): Promise<number | null> {
  const [seq] = await db.select().from(dripSequences).where(eq(dripSequences.id, sequenceId)).limit(1);
  if (!seq || seq.status !== "active") return null;

  const steps = await db
    .select()
    .from(dripSteps)
    .where(eq(dripSteps.sequenceId, sequenceId))
    .orderBy(asc(dripSteps.stepOrder));
  if (!steps.length) return null;

  const existing = await db
    .select()
    .from(dripEnrollments)
    .where(and(eq(dripEnrollments.sequenceId, sequenceId), eq(dripEnrollments.contactId, contactId)))
    .limit(1);
  if (existing.length) return existing[0].id;

  const firstDelayMs = (steps[0].delayHours || 0) * 60 * 60 * 1000;
  const nextSendAt = new Date(Date.now() + firstDelayMs).toISOString();

  const [inserted] = await db
    .insert(dripEnrollments)
    .values({
      sequenceId,
      contactId,
      currentStep: 0,
      status: "active",
      nextSendAt,
      enrolledAt: new Date().toISOString(),
    })
    .returning();

  return inserted?.id ?? null;
}
