// Marketing-specific database connection.
//
// When DATABASE_URL is set (Railway production with shared Postgres),
// marketing tables live in that shared Postgres alongside homedirect's tables.
// This gives us access to the `users` table for admin auth and allows cross-
// service queries on MLS listings / contacts.
//
// When DATABASE_URL is not set (local dev, legacy Railway), marketing tables
// live in marketing-hub.db alongside the existing creative-ops tables. In
// that mode there's no shared users table — we fall back to env-var admin
// auth (MARKETING_ADMIN_PASSWORD) instead.
//
// Either way, tables are auto-created via raw SQL on startup (idempotent
// CREATE TABLE IF NOT EXISTS). Keeps the Drizzle schema definitions as the
// source of truth while avoiding drizzle-kit migrations for this project.

import Database from "better-sqlite3";
import { drizzle as drizzleSqlite } from "drizzle-orm/better-sqlite3";

export let marketingDb: any;
export let marketingDbKind: "postgres" | "sqlite" = "sqlite";

const MARKETING_SQLITE_TABLES_SQL = `
  CREATE TABLE IF NOT EXISTS contacts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL UNIQUE,
    first_name TEXT,
    last_name TEXT,
    phone TEXT,
    address TEXT,
    city TEXT,
    state TEXT,
    zip TEXT,
    source TEXT NOT NULL DEFAULT 'manual',
    source_ref TEXT,
    verified_email INTEGER DEFAULT 0,
    opted_out INTEGER DEFAULT 0,
    opted_out_at TEXT,
    bounced_at TEXT,
    metadata TEXT NOT NULL DEFAULT '{}',
    created_at TEXT NOT NULL DEFAULT '',
    updated_at TEXT NOT NULL DEFAULT ''
  );
  CREATE INDEX IF NOT EXISTS idx_contacts_email ON contacts(email);
  CREATE INDEX IF NOT EXISTS idx_contacts_source ON contacts(source);
  CREATE INDEX IF NOT EXISTS idx_contacts_opted_out ON contacts(opted_out);

  CREATE TABLE IF NOT EXISTS email_lists (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    type TEXT NOT NULL DEFAULT 'static',
    filter_query TEXT NOT NULL DEFAULT '{}',
    created_at TEXT NOT NULL DEFAULT '',
    updated_at TEXT NOT NULL DEFAULT ''
  );

  CREATE TABLE IF NOT EXISTS list_memberships (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    list_id INTEGER NOT NULL,
    contact_id INTEGER NOT NULL,
    added_at TEXT NOT NULL DEFAULT '',
    UNIQUE(list_id, contact_id)
  );
  CREATE INDEX IF NOT EXISTS idx_list_memberships_list ON list_memberships(list_id);
  CREATE INDEX IF NOT EXISTS idx_list_memberships_contact ON list_memberships(contact_id);

  CREATE TABLE IF NOT EXISTS email_templates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    subject TEXT NOT NULL,
    preheader TEXT,
    html_body TEXT NOT NULL,
    text_body TEXT,
    variables TEXT NOT NULL DEFAULT '[]',
    ai_generated INTEGER DEFAULT 0,
    ai_prompt TEXT,
    created_at TEXT NOT NULL DEFAULT '',
    updated_at TEXT NOT NULL DEFAULT ''
  );

  CREATE TABLE IF NOT EXISTS email_campaigns (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    list_id INTEGER NOT NULL,
    template_id INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'draft',
    scheduled_at TEXT,
    started_at TEXT,
    completed_at TEXT,
    stats TEXT NOT NULL DEFAULT '{}',
    created_by INTEGER,
    created_at TEXT NOT NULL DEFAULT '',
    updated_at TEXT NOT NULL DEFAULT ''
  );
  CREATE INDEX IF NOT EXISTS idx_email_campaigns_status ON email_campaigns(status);

  CREATE TABLE IF NOT EXISTS drip_sequences (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    trigger_type TEXT NOT NULL DEFAULT 'list_join',
    trigger_config TEXT NOT NULL DEFAULT '{}',
    status TEXT NOT NULL DEFAULT 'draft',
    created_at TEXT NOT NULL DEFAULT '',
    updated_at TEXT NOT NULL DEFAULT ''
  );

  CREATE TABLE IF NOT EXISTS drip_steps (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sequence_id INTEGER NOT NULL,
    step_order INTEGER NOT NULL,
    delay_hours INTEGER NOT NULL,
    template_id INTEGER NOT NULL,
    condition TEXT NOT NULL DEFAULT '{}',
    created_at TEXT NOT NULL DEFAULT ''
  );
  CREATE INDEX IF NOT EXISTS idx_drip_steps_sequence ON drip_steps(sequence_id, step_order);

  CREATE TABLE IF NOT EXISTS drip_enrollments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sequence_id INTEGER NOT NULL,
    contact_id INTEGER NOT NULL,
    current_step INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'active',
    next_send_at TEXT,
    last_sent_at TEXT,
    enrolled_at TEXT NOT NULL DEFAULT '',
    UNIQUE(sequence_id, contact_id)
  );
  CREATE INDEX IF NOT EXISTS idx_drip_enrollments_next_send ON drip_enrollments(status, next_send_at);

  CREATE TABLE IF NOT EXISTS email_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    contact_id INTEGER,
    campaign_id INTEGER,
    drip_step_id INTEGER,
    resend_email_id TEXT,
    event_type TEXT NOT NULL,
    event_data TEXT NOT NULL DEFAULT '{}',
    created_at TEXT NOT NULL DEFAULT ''
  );
  CREATE INDEX IF NOT EXISTS idx_email_events_contact ON email_events(contact_id);
  CREATE INDEX IF NOT EXISTS idx_email_events_campaign ON email_events(campaign_id);
  CREATE INDEX IF NOT EXISTS idx_email_events_resend ON email_events(resend_email_id);

  CREATE TABLE IF NOT EXISTS mls_listings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    provider TEXT NOT NULL,
    provider_listing_id TEXT NOT NULL,
    status TEXT NOT NULL,
    status_changed_at TEXT,
    address TEXT,
    city TEXT,
    state TEXT,
    zip TEXT,
    county TEXT,
    price REAL,
    beds INTEGER,
    baths REAL,
    sqft INTEGER,
    property_type TEXT,
    days_on_market INTEGER,
    listing_agent TEXT,
    owner_name TEXT,
    latitude REAL,
    longitude REAL,
    raw_data TEXT NOT NULL DEFAULT '{}',
    contact_id INTEGER,
    skip_traced_at TEXT,
    created_at TEXT NOT NULL DEFAULT '',
    updated_at TEXT NOT NULL DEFAULT '',
    UNIQUE(provider, provider_listing_id)
  );
  CREATE INDEX IF NOT EXISTS idx_mls_status ON mls_listings(status);
  CREATE INDEX IF NOT EXISTS idx_mls_city ON mls_listings(city);

  CREATE TABLE IF NOT EXISTS skip_trace_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    listing_id INTEGER,
    contact_id INTEGER,
    provider TEXT NOT NULL DEFAULT 'batch',
    cost_cents INTEGER NOT NULL DEFAULT 0,
    result_quality TEXT NOT NULL DEFAULT 'unknown',
    response TEXT NOT NULL DEFAULT '{}',
    created_at TEXT NOT NULL DEFAULT ''
  );
`;

// Postgres version — boolean columns become BOOLEAN, INTEGER PRIMARY KEY
// AUTOINCREMENT becomes SERIAL, and TEXT columns without DEFAULT '' become
// plain TEXT. We match the Drizzle schema's semantics rather than the
// SQLite-specific storage format.
const MARKETING_PG_TABLES_SQL = `
  CREATE TABLE IF NOT EXISTS contacts (
    id SERIAL PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    first_name TEXT,
    last_name TEXT,
    phone TEXT,
    address TEXT,
    city TEXT,
    state TEXT,
    zip TEXT,
    source TEXT NOT NULL DEFAULT 'manual',
    source_ref TEXT,
    verified_email BOOLEAN DEFAULT FALSE,
    opted_out BOOLEAN DEFAULT FALSE,
    opted_out_at TEXT,
    bounced_at TEXT,
    metadata TEXT NOT NULL DEFAULT '{}',
    created_at TEXT NOT NULL DEFAULT '',
    updated_at TEXT NOT NULL DEFAULT ''
  );
  CREATE INDEX IF NOT EXISTS idx_contacts_email ON contacts(email);
  CREATE INDEX IF NOT EXISTS idx_contacts_source ON contacts(source);
  CREATE INDEX IF NOT EXISTS idx_contacts_opted_out ON contacts(opted_out);

  CREATE TABLE IF NOT EXISTS email_lists (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    type TEXT NOT NULL DEFAULT 'static',
    filter_query TEXT NOT NULL DEFAULT '{}',
    created_at TEXT NOT NULL DEFAULT '',
    updated_at TEXT NOT NULL DEFAULT ''
  );

  CREATE TABLE IF NOT EXISTS list_memberships (
    id SERIAL PRIMARY KEY,
    list_id INTEGER NOT NULL,
    contact_id INTEGER NOT NULL,
    added_at TEXT NOT NULL DEFAULT '',
    UNIQUE(list_id, contact_id)
  );
  CREATE INDEX IF NOT EXISTS idx_list_memberships_list ON list_memberships(list_id);
  CREATE INDEX IF NOT EXISTS idx_list_memberships_contact ON list_memberships(contact_id);

  CREATE TABLE IF NOT EXISTS email_templates (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    subject TEXT NOT NULL,
    preheader TEXT,
    html_body TEXT NOT NULL,
    text_body TEXT,
    variables TEXT NOT NULL DEFAULT '[]',
    ai_generated BOOLEAN DEFAULT FALSE,
    ai_prompt TEXT,
    created_at TEXT NOT NULL DEFAULT '',
    updated_at TEXT NOT NULL DEFAULT ''
  );

  CREATE TABLE IF NOT EXISTS email_campaigns (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    list_id INTEGER NOT NULL,
    template_id INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'draft',
    scheduled_at TEXT,
    started_at TEXT,
    completed_at TEXT,
    stats TEXT NOT NULL DEFAULT '{}',
    created_by INTEGER,
    created_at TEXT NOT NULL DEFAULT '',
    updated_at TEXT NOT NULL DEFAULT ''
  );
  CREATE INDEX IF NOT EXISTS idx_email_campaigns_status ON email_campaigns(status);

  CREATE TABLE IF NOT EXISTS drip_sequences (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    trigger_type TEXT NOT NULL DEFAULT 'list_join',
    trigger_config TEXT NOT NULL DEFAULT '{}',
    status TEXT NOT NULL DEFAULT 'draft',
    created_at TEXT NOT NULL DEFAULT '',
    updated_at TEXT NOT NULL DEFAULT ''
  );

  CREATE TABLE IF NOT EXISTS drip_steps (
    id SERIAL PRIMARY KEY,
    sequence_id INTEGER NOT NULL,
    step_order INTEGER NOT NULL,
    delay_hours INTEGER NOT NULL,
    template_id INTEGER NOT NULL,
    condition TEXT NOT NULL DEFAULT '{}',
    created_at TEXT NOT NULL DEFAULT ''
  );
  CREATE INDEX IF NOT EXISTS idx_drip_steps_sequence ON drip_steps(sequence_id, step_order);

  CREATE TABLE IF NOT EXISTS drip_enrollments (
    id SERIAL PRIMARY KEY,
    sequence_id INTEGER NOT NULL,
    contact_id INTEGER NOT NULL,
    current_step INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'active',
    next_send_at TEXT,
    last_sent_at TEXT,
    enrolled_at TEXT NOT NULL DEFAULT '',
    UNIQUE(sequence_id, contact_id)
  );
  CREATE INDEX IF NOT EXISTS idx_drip_enrollments_next_send ON drip_enrollments(status, next_send_at);

  CREATE TABLE IF NOT EXISTS email_events (
    id SERIAL PRIMARY KEY,
    contact_id INTEGER,
    campaign_id INTEGER,
    drip_step_id INTEGER,
    resend_email_id TEXT,
    event_type TEXT NOT NULL,
    event_data TEXT NOT NULL DEFAULT '{}',
    created_at TEXT NOT NULL DEFAULT ''
  );
  CREATE INDEX IF NOT EXISTS idx_email_events_contact ON email_events(contact_id);
  CREATE INDEX IF NOT EXISTS idx_email_events_campaign ON email_events(campaign_id);
  CREATE INDEX IF NOT EXISTS idx_email_events_resend ON email_events(resend_email_id);

  CREATE TABLE IF NOT EXISTS mls_listings (
    id SERIAL PRIMARY KEY,
    provider TEXT NOT NULL,
    provider_listing_id TEXT NOT NULL,
    status TEXT NOT NULL,
    status_changed_at TEXT,
    address TEXT,
    city TEXT,
    state TEXT,
    zip TEXT,
    county TEXT,
    price REAL,
    beds INTEGER,
    baths REAL,
    sqft INTEGER,
    property_type TEXT,
    days_on_market INTEGER,
    listing_agent TEXT,
    owner_name TEXT,
    latitude REAL,
    longitude REAL,
    raw_data TEXT NOT NULL DEFAULT '{}',
    contact_id INTEGER,
    skip_traced_at TEXT,
    created_at TEXT NOT NULL DEFAULT '',
    updated_at TEXT NOT NULL DEFAULT '',
    UNIQUE(provider, provider_listing_id)
  );
  CREATE INDEX IF NOT EXISTS idx_mls_status ON mls_listings(status);
  CREATE INDEX IF NOT EXISTS idx_mls_city ON mls_listings(city);

  CREATE TABLE IF NOT EXISTS skip_trace_log (
    id SERIAL PRIMARY KEY,
    listing_id INTEGER,
    contact_id INTEGER,
    provider TEXT NOT NULL DEFAULT 'batch',
    cost_cents INTEGER NOT NULL DEFAULT 0,
    result_quality TEXT NOT NULL DEFAULT 'unknown',
    response TEXT NOT NULL DEFAULT '{}',
    created_at TEXT NOT NULL DEFAULT ''
  );
`;

export async function initMarketingDb(): Promise<void> {
  if (process.env.DATABASE_URL) {
    marketingDbKind = "postgres";
    const pg = await import("pg");
    const { drizzle: drizzlePg } = await import("drizzle-orm/node-postgres");
    const pool = new pg.default.Pool({ connectionString: process.env.DATABASE_URL });
    marketingDb = drizzlePg(pool);
    // Execute each statement separately — node-postgres allows multi-statement
    // queries but CREATE INDEX + CREATE TABLE in one string can fail on some
    // setups. Split on semicolons followed by newline.
    const statements = MARKETING_PG_TABLES_SQL.split(/;\s*\n/).map(s => s.trim()).filter(Boolean);
    for (const stmt of statements) {
      try {
        await pool.query(stmt);
      } catch (err: any) {
        console.error(`[marketing/db] failed:`, stmt.slice(0, 60), "—", err?.message);
      }
    }
    console.log(`[marketing/db] connected to Postgres (shared with homedirect), ${statements.length} statements applied`);
  } else {
    marketingDbKind = "sqlite";
    const sqlite = new Database("marketing-hub.db");
    sqlite.pragma("journal_mode = WAL");
    marketingDb = drizzleSqlite(sqlite);
    sqlite.exec(MARKETING_SQLITE_TABLES_SQL);
    console.log("[marketing/db] using SQLite (marketing-hub.db) — set DATABASE_URL for shared Postgres");
  }
}
