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

// ═══════════════════════════════════════════════════════════════════════════
// Email Marketing — campaigns, drips, contacts, MLS ingest
//
// Note: existing `campaigns` table above is for ad-campaign tracking
// (Google/Meta/TikTok). Email campaigns live in `email_campaigns` below to
// avoid collision.
// ═══════════════════════════════════════════════════════════════════════════

// Shared users table — read-only mirror of homedirect's users table when
// running against shared DATABASE_URL. Used for admin gating only.
export const sharedUsers = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  fullName: text("full_name").notNull(),
  role: text("role").notNull().default("buyer"),
  createdAt: text("created_at").notNull().default(""),
});
export type SharedUser = typeof sharedUsers.$inferSelect;

export const contacts = sqliteTable("contacts", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  email: text("email").notNull().unique(),
  firstName: text("first_name"),
  lastName: text("last_name"),
  phone: text("phone"),
  address: text("address"),
  city: text("city"),
  state: text("state"),
  zip: text("zip"),
  source: text("source").notNull().default("manual"),
  sourceRef: text("source_ref"),
  verifiedEmail: integer("verified_email", { mode: "boolean" }).default(false),
  optedOut: integer("opted_out", { mode: "boolean" }).default(false),
  optedOutAt: text("opted_out_at"),
  bouncedAt: text("bounced_at"),
  metadata: text("metadata").notNull().default("{}"),
  createdAt: text("created_at").notNull().default(""),
  updatedAt: text("updated_at").notNull().default(""),
});
export const insertContactSchema = createInsertSchema(contacts).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertContact = z.infer<typeof insertContactSchema>;
export type Contact = typeof contacts.$inferSelect;

export const emailLists = sqliteTable("email_lists", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  description: text("description"),
  type: text("type").notNull().default("static"),
  filterQuery: text("filter_query").notNull().default("{}"),
  createdAt: text("created_at").notNull().default(""),
  updatedAt: text("updated_at").notNull().default(""),
});
export const insertEmailListSchema = createInsertSchema(emailLists).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertEmailList = z.infer<typeof insertEmailListSchema>;
export type EmailList = typeof emailLists.$inferSelect;

export const listMemberships = sqliteTable("list_memberships", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  listId: integer("list_id").notNull(),
  contactId: integer("contact_id").notNull(),
  addedAt: text("added_at").notNull().default(""),
});
export const insertListMembershipSchema = createInsertSchema(listMemberships).omit({ id: true, addedAt: true });
export type InsertListMembership = z.infer<typeof insertListMembershipSchema>;
export type ListMembership = typeof listMemberships.$inferSelect;

export const emailTemplates = sqliteTable("email_templates", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  subject: text("subject").notNull(),
  preheader: text("preheader"),
  htmlBody: text("html_body").notNull(),
  textBody: text("text_body"),
  variables: text("variables").notNull().default("[]"),
  aiGenerated: integer("ai_generated", { mode: "boolean" }).default(false),
  aiPrompt: text("ai_prompt"),
  createdAt: text("created_at").notNull().default(""),
  updatedAt: text("updated_at").notNull().default(""),
});
export const insertEmailTemplateSchema = createInsertSchema(emailTemplates).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertEmailTemplate = z.infer<typeof insertEmailTemplateSchema>;
export type EmailTemplate = typeof emailTemplates.$inferSelect;

export const emailCampaigns = sqliteTable("email_campaigns", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  listId: integer("list_id").notNull(),
  templateId: integer("template_id").notNull(),
  status: text("status").notNull().default("draft"),
  scheduledAt: text("scheduled_at"),
  startedAt: text("started_at"),
  completedAt: text("completed_at"),
  stats: text("stats").notNull().default("{}"),
  createdBy: integer("created_by"),
  createdAt: text("created_at").notNull().default(""),
  updatedAt: text("updated_at").notNull().default(""),
});
export const insertEmailCampaignSchema = createInsertSchema(emailCampaigns).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertEmailCampaign = z.infer<typeof insertEmailCampaignSchema>;
export type EmailCampaign = typeof emailCampaigns.$inferSelect;

export const dripSequences = sqliteTable("drip_sequences", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  description: text("description"),
  triggerType: text("trigger_type").notNull().default("list_join"),
  triggerConfig: text("trigger_config").notNull().default("{}"),
  status: text("status").notNull().default("draft"),
  createdAt: text("created_at").notNull().default(""),
  updatedAt: text("updated_at").notNull().default(""),
});
export const insertDripSequenceSchema = createInsertSchema(dripSequences).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertDripSequence = z.infer<typeof insertDripSequenceSchema>;
export type DripSequence = typeof dripSequences.$inferSelect;

export const dripSteps = sqliteTable("drip_steps", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  sequenceId: integer("sequence_id").notNull(),
  stepOrder: integer("step_order").notNull(),
  delayHours: integer("delay_hours").notNull(),
  templateId: integer("template_id").notNull(),
  condition: text("condition").notNull().default("{}"),
  createdAt: text("created_at").notNull().default(""),
});
export const insertDripStepSchema = createInsertSchema(dripSteps).omit({ id: true, createdAt: true });
export type InsertDripStep = z.infer<typeof insertDripStepSchema>;
export type DripStep = typeof dripSteps.$inferSelect;

export const dripEnrollments = sqliteTable("drip_enrollments", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  sequenceId: integer("sequence_id").notNull(),
  contactId: integer("contact_id").notNull(),
  currentStep: integer("current_step").notNull().default(0),
  status: text("status").notNull().default("active"),
  nextSendAt: text("next_send_at"),
  lastSentAt: text("last_sent_at"),
  enrolledAt: text("enrolled_at").notNull().default(""),
});
export const insertDripEnrollmentSchema = createInsertSchema(dripEnrollments).omit({ id: true, enrolledAt: true });
export type InsertDripEnrollment = z.infer<typeof insertDripEnrollmentSchema>;
export type DripEnrollment = typeof dripEnrollments.$inferSelect;

export const emailEvents = sqliteTable("email_events", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  contactId: integer("contact_id"),
  campaignId: integer("campaign_id"),
  dripStepId: integer("drip_step_id"),
  resendEmailId: text("resend_email_id"),
  eventType: text("event_type").notNull(),
  eventData: text("event_data").notNull().default("{}"),
  createdAt: text("created_at").notNull().default(""),
});
export const insertEmailEventSchema = createInsertSchema(emailEvents).omit({ id: true, createdAt: true });
export type InsertEmailEvent = z.infer<typeof insertEmailEventSchema>;
export type EmailEvent = typeof emailEvents.$inferSelect;

export const mlsListings = sqliteTable("mls_listings", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  provider: text("provider").notNull(),
  providerListingId: text("provider_listing_id").notNull(),
  status: text("status").notNull(),
  statusChangedAt: text("status_changed_at"),
  address: text("address"),
  city: text("city"),
  state: text("state"),
  zip: text("zip"),
  county: text("county"),
  price: real("price"),
  beds: integer("beds"),
  baths: real("baths"),
  sqft: integer("sqft"),
  propertyType: text("property_type"),
  daysOnMarket: integer("days_on_market"),
  listingAgent: text("listing_agent"),
  ownerName: text("owner_name"),
  latitude: real("latitude"),
  longitude: real("longitude"),
  rawData: text("raw_data").notNull().default("{}"),
  contactId: integer("contact_id"),
  skipTracedAt: text("skip_traced_at"),
  createdAt: text("created_at").notNull().default(""),
  updatedAt: text("updated_at").notNull().default(""),
});
export const insertMlsListingSchema = createInsertSchema(mlsListings).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertMlsListing = z.infer<typeof insertMlsListingSchema>;
export type MlsListing = typeof mlsListings.$inferSelect;

export const skipTraceLog = sqliteTable("skip_trace_log", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  listingId: integer("listing_id"),
  contactId: integer("contact_id"),
  provider: text("provider").notNull().default("batch"),
  costCents: integer("cost_cents").notNull().default(0),
  resultQuality: text("result_quality").notNull().default("unknown"),
  response: text("response").notNull().default("{}"),
  createdAt: text("created_at").notNull().default(""),
});
export const insertSkipTraceLogSchema = createInsertSchema(skipTraceLog).omit({ id: true, createdAt: true });
export type InsertSkipTraceLog = z.infer<typeof insertSkipTraceLogSchema>;
export type SkipTraceLog = typeof skipTraceLog.$inferSelect;

// ═══════════════════════════════════════════════════════════════════════════
// SEO — idea pipeline, AEO-optimized articles, publish state
// ═══════════════════════════════════════════════════════════════════════════

export const seoArticleIdeas = sqliteTable("seo_article_ideas", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  targetQuery: text("target_query").notNull(),
  title: text("title").notNull(),
  angle: text("angle"),
  searchIntent: text("search_intent"), // informational | commercial | transactional | navigational
  icp: text("icp"), // buyer | seller | concierge
  tier: text("tier").notNull().default("cluster"), // pillar | cluster | competitor | longtail | local
  rationale: text("rationale"),
  estimatedDifficulty: text("estimated_difficulty"), // easy | medium | hard
  status: text("status").notNull().default("proposed"), // proposed | approved | rejected | written
  articleId: integer("article_id"),
  createdAt: text("created_at").notNull().default(""),
});
export const insertSeoArticleIdeaSchema = createInsertSchema(seoArticleIdeas).omit({ id: true, createdAt: true });
export type InsertSeoArticleIdea = z.infer<typeof insertSeoArticleIdeaSchema>;
export type SeoArticleIdea = typeof seoArticleIdeas.$inferSelect;

export const seoArticles = sqliteTable("seo_articles", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  slug: text("slug").notNull().unique(),
  title: text("title").notNull(),
  metaDescription: text("meta_description").notNull(),
  targetQuery: text("target_query").notNull(),
  icp: text("icp"),
  bodyHtml: text("body_html").notNull(),
  bodyMarkdown: text("body_markdown"),
  faqs: text("faqs").notNull().default("[]"), // JSON array of { q, a }
  structuredData: text("structured_data").notNull().default("{}"), // JSON-LD
  wordCount: integer("word_count").notNull().default(0),
  readingMinutes: integer("reading_minutes").notNull().default(0),
  ideaId: integer("idea_id"),
  status: text("status").notNull().default("draft"), // draft | published | archived
  publishedAt: text("published_at"),
  featuredImage: text("featured_image"),
  tags: text("tags").notNull().default("[]"),
  createdAt: text("created_at").notNull().default(""),
  updatedAt: text("updated_at").notNull().default(""),
});
export const insertSeoArticleSchema = createInsertSchema(seoArticles).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertSeoArticle = z.infer<typeof insertSeoArticleSchema>;
export type SeoArticle = typeof seoArticles.$inferSelect;

// ═══════════════════════════════════════════════════════════════════════════
// Meta (Facebook + Instagram) ad creatives
// Housing SAC is always enforced — no demographic targeting fields stored.
// ═══════════════════════════════════════════════════════════════════════════

export const metaAdCreatives = sqliteTable("meta_ad_creatives", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  icp: text("icp").notNull(), // buyer | seller | general
  brief: text("brief").notNull(), // what the ad should accomplish
  audienceNote: text("audience_note"), // freeform — for our records, not targeting
  objective: text("objective").notNull().default("OUTCOME_TRAFFIC"), // OUTCOME_LEADS | OUTCOME_TRAFFIC | OUTCOME_ENGAGEMENT
  primaryText: text("primary_text").notNull(), // 125 char recommended
  headline: text("headline").notNull(), // 40 char
  description: text("description"), // 30 char, optional
  ctaButton: text("cta_button").notNull().default("LEARN_MORE"), // LEARN_MORE | SIGN_UP | GET_OFFER | APPLY_NOW
  landingUrl: text("landing_url").notNull(),
  aspectRatio: text("aspect_ratio").notNull().default("1:1"), // 1:1 | 4:5 | 9:16
  imageUrl: text("image_url"), // hosted image url
  imagePrompt: text("image_prompt"), // prompt used to generate it, for re-rolls
  imageProvider: text("image_provider"), // dall-e-3 | manual
  generationCostCents: integer("generation_cost_cents").notNull().default(0),
  status: text("status").notNull().default("draft"), // draft | approved | rejected | launched | paused | archived
  rationale: text("rationale"), // one-line "why this creative will work"
  reviewedBy: integer("reviewed_by"),
  reviewedAt: text("reviewed_at"),
  launchedAt: text("launched_at"),
  metaCampaignId: text("meta_campaign_id"), // post-launch
  metaAdId: text("meta_ad_id"),
  createdAt: text("created_at").notNull().default(""),
  updatedAt: text("updated_at").notNull().default(""),
});
export const insertMetaAdCreativeSchema = createInsertSchema(metaAdCreatives).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertMetaAdCreative = z.infer<typeof insertMetaAdCreativeSchema>;
export type MetaAdCreative = typeof metaAdCreatives.$inferSelect;
