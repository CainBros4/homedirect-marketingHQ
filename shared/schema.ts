import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// API settings (stores the LLM API key and provider)
export const settings = sqliteTable("settings", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  key: text("key").notNull().unique(),
  value: text("value").notNull(),
});

// Saved copy generations (history)
export const generations = sqliteTable("generations", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  icp: text("icp").notNull(),       // buyer | seller | concierge
  angle: text("angle"),
  context: text("context"),
  result: text("result").notNull(), // JSON stringified GeneratedCopy
  createdAt: integer("created_at").notNull(),
});

// Competitor tracking
export const competitors = sqliteTable("competitors", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  pageId: text("page_id").notNull().unique(),  // Meta Page ID / search term
  active: integer("active").notNull().default(1),
});

// Competitor ad analysis digests
export const adDigests = sqliteTable("ad_digests", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  generatedAt: integer("generated_at").notNull(),
  summary: text("summary").notNull(),       // JSON: full LLM analysis
  rawAdsCount: integer("raw_ads_count").notNull().default(0),
});

// Campaign tracking
export const campaigns = sqliteTable("campaigns", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  icp: text("icp").notNull(),           // buyer | seller | concierge
  platform: text("platform").notNull(), // meta | google | tiktok | organic
  status: text("status").notNull().default("active"), // active | paused | completed
  startDate: integer("start_date"),
  budget: integer("budget"),            // in cents
  createdAt: integer("created_at").notNull(),
});

// Ad performance records
export const adPerformance = sqliteTable("ad_performance", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  campaignId: integer("campaign_id").notNull(),
  adName: text("ad_name").notNull(),
  format: text("format").notNull(),     // carousel | reel | static | story
  icp: text("icp").notNull(),
  hook: text("hook"),                   // the opening line/hook used
  impressions: integer("impressions").notNull().default(0),
  clicks: integer("clicks").notNull().default(0),
  leads: integer("leads").notNull().default(0),
  spend: integer("spend").notNull().default(0), // in cents
  date: integer("date").notNull(),
  notes: text("notes"),
});

// Creative assets (images, videos, carousel files) tracked through their lifecycle
export const assets = sqliteTable("assets", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  format: text("format").notNull(),       // carousel | reel | static | story | email
  icp: text("icp").notNull(),             // buyer | seller | concierge
  platform: text("platform").notNull(),   // meta | instagram | tiktok | google | email
  status: text("status").notNull().default("draft"), // draft | ready | live | paused | winner | loser | archived
  hook: text("hook"),                     // the hook/headline used in this asset
  angle: text("angle"),                   // pain | savings | curiosity | social_proof | urgency
  fileUrl: text("file_url"),              // URL or file path if uploaded
  notes: text("notes"),
  linkedBriefId: integer("linked_brief_id"), // reference to generation id
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
});

export const feedbackReports = sqliteTable("feedback_reports", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  generatedAt: integer("generated_at").notNull(),
  weekOf: text("week_of").notNull(),
  summary: text("summary").notNull(),
  newBriefsCount: integer("new_briefs_count").notNull().default(0),
  status: text("status").notNull().default("new"),
});

export const publishQueue = sqliteTable("publish_queue", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  assetId: integer("asset_id"),
  platform: text("platform").notNull(),
  contentType: text("content_type").notNull(),
  caption: text("caption").notNull(),
  icp: text("icp").notNull(),
  scheduledFor: integer("scheduled_for"),
  status: text("status").notNull().default("queued"),
  bufferJobId: text("buffer_job_id"),
  publishedAt: integer("published_at"),
  createdAt: integer("created_at").notNull(),
  notes: text("notes"),
});

// Video generation jobs
export const videoJobs = sqliteTable("video_jobs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  status: text("status").notNull().default("pending"),
  // pending | generating_audio | fetching_broll | composing | done | failed
  script: text("script").notNull(),
  hookText: text("hook_text"),       // bold text overlay at start (0-4s)
  ctaText: text("cta_text"),         // bold text overlay at end (last 5s)
  voiceId: text("voice_id").notNull().default("21m00Tcm4TlvDq8ikWAM"), // ElevenLabs Rachel
  aspectRatio: text("aspect_ratio").notNull().default("9:16"), // 9:16 | 1:1
  searchTerms: text("search_terms"), // comma-separated Pexels search terms
  icp: text("icp"),
  outputPath: text("output_path"),   // path to final .mp4
  audioDuration: real("audio_duration"), // seconds
  errorMessage: text("error_message"),
  createdAt: integer("created_at").notNull(),
  completedAt: integer("completed_at"),
});

export const insertSettingSchema = createInsertSchema(settings).omit({ id: true });
export const insertGenerationSchema = createInsertSchema(generations).omit({ id: true });
export const insertCompetitorSchema = createInsertSchema(competitors).omit({ id: true });
export const insertAdDigestSchema = createInsertSchema(adDigests).omit({ id: true });
export const insertCampaignSchema = createInsertSchema(campaigns).omit({ id: true });
export const insertAdPerformanceSchema = createInsertSchema(adPerformance).omit({ id: true });
export const insertAssetSchema = createInsertSchema(assets).omit({ id: true });
export const insertFeedbackReportSchema = createInsertSchema(feedbackReports).omit({ id: true });
export const insertPublishQueueSchema = createInsertSchema(publishQueue).omit({ id: true });
export const insertVideoJobSchema = createInsertSchema(videoJobs).omit({ id: true });

export type Setting = typeof settings.$inferSelect;
export type Generation = typeof generations.$inferSelect;
export type Competitor = typeof competitors.$inferSelect;
export type AdDigest = typeof adDigests.$inferSelect;
export type Campaign = typeof campaigns.$inferSelect;
export type AdPerformanceRecord = typeof adPerformance.$inferSelect;
export type Asset = typeof assets.$inferSelect;
export type InsertSetting = z.infer<typeof insertSettingSchema>;
export type InsertGeneration = z.infer<typeof insertGenerationSchema>;
export type InsertCompetitor = z.infer<typeof insertCompetitorSchema>;
export type InsertAdDigest = z.infer<typeof insertAdDigestSchema>;
export type InsertCampaign = z.infer<typeof insertCampaignSchema>;
export type InsertAdPerformance = z.infer<typeof insertAdPerformanceSchema>;
export type InsertAsset = z.infer<typeof insertAssetSchema>;
export type FeedbackReport = typeof feedbackReports.$inferSelect;
export type PublishQueueItem = typeof publishQueue.$inferSelect;
export type VideoJob = typeof videoJobs.$inferSelect;
export type InsertFeedbackReport = z.infer<typeof insertFeedbackReportSchema>;
export type InsertPublishQueueItem = z.infer<typeof insertPublishQueueSchema>;
export type InsertVideoJob = z.infer<typeof insertVideoJobSchema>;
