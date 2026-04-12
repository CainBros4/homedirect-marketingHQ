import { drizzle } from "drizzle-orm/better-sqlite3";
import Database from "better-sqlite3";
import { eq, desc, and } from "drizzle-orm";
import {
  settings, generations, competitors, adDigests, campaigns, adPerformance, assets,
  feedbackReports, publishQueue, videoJobs,
  type Setting, type Generation, type InsertGeneration,
  type Competitor, type InsertCompetitor,
  type AdDigest, type InsertAdDigest,
  type Campaign, type InsertCampaign,
  type AdPerformanceRecord, type InsertAdPerformance,
  type Asset, type InsertAsset,
  type FeedbackReport, type InsertFeedbackReport,
  type PublishQueueItem, type InsertPublishQueueItem,
  type VideoJob, type InsertVideoJob,
} from "@shared/schema";

const sqlite = new Database("marketing-hub.db");
const db = drizzle(sqlite);

// Auto-create tables
sqlite.exec(`
  CREATE TABLE IF NOT EXISTS settings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    key TEXT NOT NULL UNIQUE,
    value TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS generations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    icp TEXT NOT NULL,
    angle TEXT,
    context TEXT,
    result TEXT NOT NULL,
    created_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS competitors (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    page_id TEXT NOT NULL UNIQUE,
    active INTEGER NOT NULL DEFAULT 1
  );
  CREATE TABLE IF NOT EXISTS ad_digests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    generated_at INTEGER NOT NULL,
    summary TEXT NOT NULL,
    raw_ads_count INTEGER NOT NULL DEFAULT 0
  );
  CREATE TABLE IF NOT EXISTS campaigns (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    icp TEXT NOT NULL,
    platform TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active',
    start_date INTEGER,
    budget INTEGER,
    created_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS ad_performance (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    campaign_id INTEGER NOT NULL,
    ad_name TEXT NOT NULL,
    format TEXT NOT NULL,
    icp TEXT NOT NULL,
    hook TEXT,
    impressions INTEGER NOT NULL DEFAULT 0,
    clicks INTEGER NOT NULL DEFAULT 0,
    leads INTEGER NOT NULL DEFAULT 0,
    spend INTEGER NOT NULL DEFAULT 0,
    date INTEGER NOT NULL,
    notes TEXT
  );
  CREATE TABLE IF NOT EXISTS assets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    format TEXT NOT NULL,
    icp TEXT NOT NULL,
    platform TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'draft',
    hook TEXT,
    angle TEXT,
    file_url TEXT,
    notes TEXT,
    linked_brief_id INTEGER,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS feedback_reports (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    generated_at INTEGER NOT NULL,
    week_of TEXT NOT NULL,
    summary TEXT NOT NULL,
    new_briefs_count INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'new'
  );
  CREATE TABLE IF NOT EXISTS publish_queue (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    asset_id INTEGER,
    platform TEXT NOT NULL,
    content_type TEXT NOT NULL,
    caption TEXT NOT NULL,
    icp TEXT NOT NULL,
    scheduled_for INTEGER,
    status TEXT NOT NULL DEFAULT 'queued',
    buffer_job_id TEXT,
    published_at INTEGER,
    created_at INTEGER NOT NULL,
    notes TEXT
  );
  CREATE TABLE IF NOT EXISTS video_jobs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    status TEXT NOT NULL DEFAULT 'pending',
    script TEXT NOT NULL,
    hook_text TEXT,
    cta_text TEXT,
    voice_id TEXT NOT NULL DEFAULT '21m00Tcm4TlvDq8ikWAM',
    aspect_ratio TEXT NOT NULL DEFAULT '9:16',
    search_terms TEXT,
    icp TEXT,
    output_path TEXT,
    audio_duration REAL,
    error_message TEXT,
    created_at INTEGER NOT NULL,
    completed_at INTEGER
  );
`);

// Seed default competitors if none exist
const existingCompetitors = sqlite.prepare("SELECT COUNT(*) as cnt FROM competitors").get() as { cnt: number };
if (existingCompetitors.cnt === 0) {
  const seedData = [
    { name: "Zillow",              page_id: "zillow"          },
    { name: "Redfin",              page_id: "redfin"          },
    { name: "Opendoor",            page_id: "opendoor"        },
    { name: "ForSaleByOwner.com",  page_id: "forsalebyowner"  },
    { name: "Houzeo",              page_id: "houzeo"          },
  ];
  for (const c of seedData) {
    sqlite.prepare("INSERT OR IGNORE INTO competitors (name, page_id, active) VALUES (?, ?, 1)").run(c.name, c.page_id);
  }
}

export interface IStorage {
  getSetting(key: string): Setting | undefined;
  setSetting(key: string, value: string): void;
  saveGeneration(data: InsertGeneration): Generation;
  getGenerations(limit?: number): Generation[];
  deleteGeneration(id: number): void;
  // Competitors
  getCompetitors(): Competitor[];
  // Ad Digests
  saveAdDigest(data: InsertAdDigest): AdDigest;
  getAdDigests(limit?: number): AdDigest[];
  getAdDigest(id: number): AdDigest | undefined;
  // Campaigns
  getCampaigns(): Campaign[];
  createCampaign(data: InsertCampaign): Campaign;
  updateCampaign(id: number, data: Partial<InsertCampaign>): Campaign | undefined;
  // Ad Performance
  getAdPerformance(campaignId?: number, limit?: number): AdPerformanceRecord[];
  addAdPerformance(data: InsertAdPerformance): AdPerformanceRecord;
  deleteAdPerformance(id: number): void;
  getPerformanceSummary(): PerformanceSummary;
  // Assets
  getAssets(filters?: { icp?: string; format?: string; status?: string; platform?: string }): Asset[];
  createAsset(data: InsertAsset): Asset;
  updateAsset(id: number, data: Partial<InsertAsset>): Asset | undefined;
  deleteAsset(id: number): void;
  getAssetStats(): { byStatus: Record<string, number>; byFormat: Record<string, number>; byIcp: Record<string, number> };
  // Feedback Reports
  saveFeedbackReport(data: InsertFeedbackReport): FeedbackReport;
  getFeedbackReports(limit?: number): FeedbackReport[];
  updateFeedbackReport(id: number, data: Partial<InsertFeedbackReport>): FeedbackReport | undefined;
  // Publish Queue
  getPublishQueue(filters?: { platform?: string; status?: string; icp?: string }): PublishQueueItem[];
  addToPublishQueue(data: InsertPublishQueueItem): PublishQueueItem;
  updateQueueItem(id: number, data: Partial<InsertPublishQueueItem>): PublishQueueItem | undefined;
  deleteQueueItem(id: number): void;
  getQueueStats(): { queued: number; published: number; failed: number; cancelled: number; byPlatform: Record<string, number> };
  // Video Jobs
  createVideoJob(data: InsertVideoJob): VideoJob;
  getVideoJob(id: number): VideoJob | undefined;
  updateVideoJob(id: number, data: Partial<VideoJob>): void;
  getVideoJobs(limit?: number): VideoJob[];
  deleteVideoJob(id: number): void;
}

export interface PerformanceSummary {
  totalSpend: number;
  totalLeads: number;
  totalClicks: number;
  totalImpressions: number;
  avgCTR: number;
  avgCPL: number;
  topPerformers: AdPerformanceRecord[];
  worstPerformers: AdPerformanceRecord[];
  byFormat: { format: string; impressions: number; clicks: number; leads: number; spend: number; ctr: number; cpl: number }[];
}

export const storage: IStorage = {
  getSetting(key) {
    return db.select().from(settings).where(eq(settings.key, key)).get();
  },
  setSetting(key, value) {
    const existing = db.select().from(settings).where(eq(settings.key, key)).get();
    if (existing) {
      db.update(settings).set({ value }).where(eq(settings.key, key)).run();
    } else {
      db.insert(settings).values({ key, value }).run();
    }
  },
  saveGeneration(data) {
    return db.insert(generations).values(data).returning().get();
  },
  getGenerations(limit = 20) {
    return db.select().from(generations)
      .orderBy(generations.createdAt)
      .all()
      .reverse()
      .slice(0, limit);
  },
  deleteGeneration(id) {
    db.delete(generations).where(eq(generations.id, id)).run();
  },
  getCompetitors() {
    return db.select().from(competitors).where(eq(competitors.active, 1)).all();
  },
  saveAdDigest(data) {
    return db.insert(adDigests).values(data).returning().get();
  },
  getAdDigests(limit = 10) {
    return db.select().from(adDigests)
      .orderBy(adDigests.generatedAt)
      .all()
      .reverse()
      .slice(0, limit);
  },
  getAdDigest(id) {
    return db.select().from(adDigests).where(eq(adDigests.id, id)).get();
  },
  // Campaigns
  getCampaigns() {
    return db.select().from(campaigns).orderBy(desc(campaigns.createdAt)).all();
  },
  createCampaign(data) {
    return db.insert(campaigns).values(data).returning().get();
  },
  updateCampaign(id, data) {
    return db.update(campaigns).set(data).where(eq(campaigns.id, id)).returning().get();
  },
  // Ad Performance
  getAdPerformance(campaignId, limit = 200) {
    if (campaignId !== undefined) {
      return db.select().from(adPerformance)
        .where(eq(adPerformance.campaignId, campaignId))
        .orderBy(desc(adPerformance.date))
        .limit(limit)
        .all();
    }
    return db.select().from(adPerformance)
      .orderBy(desc(adPerformance.date))
      .limit(limit)
      .all();
  },
  addAdPerformance(data) {
    return db.insert(adPerformance).values(data).returning().get();
  },
  deleteAdPerformance(id) {
    db.delete(adPerformance).where(eq(adPerformance.id, id)).run();
  },
  getPerformanceSummary() {
    const records = db.select().from(adPerformance).all();
    if (records.length === 0) {
      return {
        totalSpend: 0,
        totalLeads: 0,
        totalClicks: 0,
        totalImpressions: 0,
        avgCTR: 0,
        avgCPL: 0,
        topPerformers: [],
        worstPerformers: [],
        byFormat: [],
      };
    }
    const totalSpend = records.reduce((s, r) => s + r.spend, 0);
    const totalLeads = records.reduce((s, r) => s + r.leads, 0);
    const totalClicks = records.reduce((s, r) => s + r.clicks, 0);
    const totalImpressions = records.reduce((s, r) => s + r.impressions, 0);
    const avgCTR = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0;
    const avgCPL = totalLeads > 0 ? totalSpend / totalLeads : 0;

    // Sort by CTR for top/worst performers
    const withCTR = records.map(r => ({
      ...r,
      _ctr: r.impressions > 0 ? (r.clicks / r.impressions) * 100 : 0,
    })).sort((a, b) => b._ctr - a._ctr);
    const topPerformers = withCTR.slice(0, 5).map(({ _ctr, ...r }) => r);
    const worstPerformers = withCTR.slice(-5).reverse().map(({ _ctr, ...r }) => r);

    // Aggregate by format
    const formatMap: Record<string, { impressions: number; clicks: number; leads: number; spend: number }> = {};
    for (const r of records) {
      if (!formatMap[r.format]) formatMap[r.format] = { impressions: 0, clicks: 0, leads: 0, spend: 0 };
      formatMap[r.format].impressions += r.impressions;
      formatMap[r.format].clicks += r.clicks;
      formatMap[r.format].leads += r.leads;
      formatMap[r.format].spend += r.spend;
    }
    const byFormat = Object.entries(formatMap).map(([format, agg]) => ({
      format,
      ...agg,
      ctr: agg.impressions > 0 ? (agg.clicks / agg.impressions) * 100 : 0,
      cpl: agg.leads > 0 ? agg.spend / agg.leads : 0,
    }));

    return { totalSpend, totalLeads, totalClicks, totalImpressions, avgCTR, avgCPL, topPerformers, worstPerformers, byFormat };
  },
  // Assets
  getAssets(filters = {}) {
    let query = db.select().from(assets);
    const conditions = [];
    if (filters.icp)      conditions.push(eq(assets.icp, filters.icp));
    if (filters.format)   conditions.push(eq(assets.format, filters.format));
    if (filters.status)   conditions.push(eq(assets.status, filters.status));
    if (filters.platform) conditions.push(eq(assets.platform, filters.platform));
    if (conditions.length > 0) {
      return (query as any).where(and(...conditions)).orderBy(desc(assets.createdAt)).all();
    }
    return query.orderBy(desc(assets.createdAt)).all();
  },
  createAsset(data) {
    return db.insert(assets).values(data).returning().get();
  },
  updateAsset(id, data) {
    return db.update(assets).set(data).where(eq(assets.id, id)).returning().get();
  },
  deleteAsset(id) {
    db.delete(assets).where(eq(assets.id, id)).run();
  },
  getAssetStats() {
    const all = db.select().from(assets).all();
    const byStatus: Record<string, number> = {};
    const byFormat: Record<string, number> = {};
    const byIcp: Record<string, number> = {};
    for (const a of all) {
      byStatus[a.status] = (byStatus[a.status] || 0) + 1;
      byFormat[a.format] = (byFormat[a.format] || 0) + 1;
      byIcp[a.icp] = (byIcp[a.icp] || 0) + 1;
    }
    return { byStatus, byFormat, byIcp };
  },
  // Feedback Reports
  saveFeedbackReport(data) {
    return db.insert(feedbackReports).values(data).returning().get();
  },
  getFeedbackReports(limit = 20) {
    return db.select().from(feedbackReports)
      .orderBy(desc(feedbackReports.generatedAt))
      .limit(limit)
      .all();
  },
  updateFeedbackReport(id, data) {
    return db.update(feedbackReports).set(data).where(eq(feedbackReports.id, id)).returning().get();
  },
  // Publish Queue
  getPublishQueue(filters = {}) {
    let query = db.select().from(publishQueue);
    const conditions = [];
    if (filters.platform) conditions.push(eq(publishQueue.platform, filters.platform));
    if (filters.status)   conditions.push(eq(publishQueue.status, filters.status));
    if (filters.icp)      conditions.push(eq(publishQueue.icp, filters.icp));
    if (conditions.length > 0) {
      return (query as any).where(and(...conditions)).orderBy(desc(publishQueue.createdAt)).all();
    }
    return query.orderBy(desc(publishQueue.createdAt)).all();
  },
  addToPublishQueue(data) {
    return db.insert(publishQueue).values(data).returning().get();
  },
  updateQueueItem(id, data) {
    return db.update(publishQueue).set(data).where(eq(publishQueue.id, id)).returning().get();
  },
  deleteQueueItem(id) {
    db.delete(publishQueue).where(eq(publishQueue.id, id)).run();
  },
  getQueueStats() {
    const all = db.select().from(publishQueue).all();
    const stats = { queued: 0, published: 0, failed: 0, cancelled: 0, byPlatform: {} as Record<string, number> };
    for (const item of all) {
      if (item.status === "queued")    stats.queued++;
      if (item.status === "published") stats.published++;
      if (item.status === "failed")    stats.failed++;
      if (item.status === "cancelled") stats.cancelled++;
      stats.byPlatform[item.platform] = (stats.byPlatform[item.platform] || 0) + 1;
    }
    return stats;
  },
  // Video Jobs
  createVideoJob(data) {
    return db.insert(videoJobs).values(data).returning().get();
  },
  getVideoJob(id) {
    return db.select().from(videoJobs).where(eq(videoJobs.id, id)).get();
  },
  updateVideoJob(id, data) {
    db.update(videoJobs).set(data).where(eq(videoJobs.id, id)).run();
  },
  getVideoJobs(limit = 20) {
    return db.select().from(videoJobs).orderBy(desc(videoJobs.createdAt)).limit(limit).all();
  },
  deleteVideoJob(id) {
    db.delete(videoJobs).where(eq(videoJobs.id, id)).run();
  },
};
