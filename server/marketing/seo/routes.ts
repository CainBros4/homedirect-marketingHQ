// SEO routes — admin CRUD (gated), public read API (for trykeylime.ai
// to consume), sitemap XML, and a public HTML render at /guides/:slug
// so articles are directly crawlable from marketingHQ while we wait for
// the trykeylime.ai integration to land.

import type { Express } from "express";
import { marketingDb as db } from "../db";
import { seoArticleIdeas, seoArticles } from "../../../shared/schema";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { requireAdmin } from "../auth";
import { generateIdeas, isClaudeConfigured } from "./ideator";
import { writeArticle } from "./writer";

const nowIso = () => new Date().toISOString();
const APP_BASE_URL = process.env.APP_BASE_URL || "https://marketinghq-production.up.railway.app";

export function registerSeoRoutes(app: Express) {
  // ── Ideas — admin ──

  app.get("/api/marketing/seo/ideas", requireAdmin, async (req, res) => {
    const statusParam = req.query.status;
    const statuses = typeof statusParam === "string" && statusParam !== "all"
      ? statusParam.split(",")
      : null;
    const rows = statuses
      ? await db.select().from(seoArticleIdeas).where(eq(seoArticleIdeas.status, statuses[0])).orderBy(desc(seoArticleIdeas.createdAt))
      : await db.select().from(seoArticleIdeas).orderBy(desc(seoArticleIdeas.createdAt));
    res.json({ ideas: rows });
  });

  app.post("/api/marketing/seo/ideas/generate", requireAdmin, async (req, res) => {
    const schema = z.object({
      focus: z.string().optional(),
      count: z.number().min(1).max(20).optional(),
      geoMix: z.enum(["local_heavy", "balanced", "national_heavy"]).optional(),
    });
    const parsed = schema.safeParse(req.body || {});
    if (!parsed.success) return res.status(400).json({ message: "Invalid body" });
    if (!isClaudeConfigured()) return res.status(503).json({ message: "ANTHROPIC_API_KEY not set" });

    try {
      const ideas = await generateIdeas(parsed.data);
      const inserted = [];
      for (const i of ideas) {
        const [row] = await db
          .insert(seoArticleIdeas)
          .values({
            targetQuery: i.targetQuery,
            title: i.title,
            angle: i.angle,
            searchIntent: i.searchIntent,
            icp: i.icp,
            tier: i.tier,
            rationale: i.rationale,
            estimatedDifficulty: i.estimatedDifficulty,
            status: "proposed",
            createdAt: nowIso(),
          })
          .returning();
        inserted.push(row);
      }
      res.json({ inserted: inserted.length, ideas: inserted });
    } catch (err: any) {
      console.error("[seo/ideate]", err);
      res.status(500).json({ message: "Ideation failed", error: err?.message });
    }
  });

  app.patch("/api/marketing/seo/ideas/:id", requireAdmin, async (req, res) => {
    const id = parseInt(String(req.params.id), 10);
    const schema = z.object({ status: z.enum(["proposed", "approved", "rejected", "written"]).optional() });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: "Invalid body" });
    await db.update(seoArticleIdeas).set(parsed.data).where(eq(seoArticleIdeas.id, id));
    res.json({ ok: true });
  });

  app.delete("/api/marketing/seo/ideas/:id", requireAdmin, async (req, res) => {
    const id = parseInt(String(req.params.id), 10);
    await db.delete(seoArticleIdeas).where(eq(seoArticleIdeas.id, id));
    res.json({ ok: true });
  });

  // ── Articles — admin ──

  app.get("/api/marketing/seo/articles", requireAdmin, async (_req, res) => {
    const rows = await db.select().from(seoArticles).orderBy(desc(seoArticles.updatedAt));
    res.json({ articles: rows });
  });

  app.get("/api/marketing/seo/articles/:id", requireAdmin, async (req, res) => {
    const id = parseInt(String(req.params.id), 10);
    const [row] = await db.select().from(seoArticles).where(eq(seoArticles.id, id)).limit(1);
    if (!row) return res.status(404).json({ message: "Not found" });
    res.json({ article: row });
  });

  app.post("/api/marketing/seo/articles/generate", requireAdmin, async (req, res) => {
    const schema = z.object({ ideaId: z.number() });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: "Invalid body" });
    if (!isClaudeConfigured()) return res.status(503).json({ message: "ANTHROPIC_API_KEY not set" });

    const [idea] = await db.select().from(seoArticleIdeas).where(eq(seoArticleIdeas.id, parsed.data.ideaId)).limit(1);
    if (!idea) return res.status(404).json({ message: "Idea not found" });

    try {
      const generated = await writeArticle({
        targetQuery: idea.targetQuery,
        title: idea.title,
        angle: idea.angle,
        icp: idea.icp,
        searchIntent: idea.searchIntent,
        tier: idea.tier,
      });
      // Ensure slug uniqueness — if collision, suffix with id.
      let slug = generated.slug;
      const existing = await db.select().from(seoArticles).where(eq(seoArticles.slug, slug)).limit(1);
      if (existing.length) slug = `${slug}-${Date.now().toString(36)}`;

      const [row] = await db
        .insert(seoArticles)
        .values({
          slug,
          title: generated.title,
          metaDescription: generated.metaDescription,
          targetQuery: idea.targetQuery,
          icp: idea.icp,
          bodyHtml: generated.bodyHtml,
          bodyMarkdown: generated.bodyMarkdown,
          faqs: JSON.stringify(generated.faqs),
          structuredData: JSON.stringify(generated.structuredData),
          wordCount: generated.wordCount,
          readingMinutes: generated.readingMinutes,
          ideaId: idea.id,
          status: "draft",
          tags: JSON.stringify(generated.tags),
          createdAt: nowIso(),
          updatedAt: nowIso(),
        })
        .returning();

      await db
        .update(seoArticleIdeas)
        .set({ status: "written", articleId: row.id })
        .where(eq(seoArticleIdeas.id, idea.id));

      res.json({ article: row });
    } catch (err: any) {
      console.error("[seo/generate]", err);
      res.status(500).json({ message: "Writing failed", error: err?.message });
    }
  });

  app.patch("/api/marketing/seo/articles/:id", requireAdmin, async (req, res) => {
    const id = parseInt(String(req.params.id), 10);
    const schema = z.object({
      title: z.string().optional(),
      metaDescription: z.string().optional(),
      bodyHtml: z.string().optional(),
      bodyMarkdown: z.string().optional(),
      tags: z.array(z.string()).optional(),
      featuredImage: z.string().nullable().optional(),
      slug: z.string().optional(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: "Invalid body" });
    const patch: any = { ...parsed.data, updatedAt: nowIso() };
    if (parsed.data.tags) patch.tags = JSON.stringify(parsed.data.tags);
    await db.update(seoArticles).set(patch).where(eq(seoArticles.id, id));
    res.json({ ok: true });
  });

  app.post("/api/marketing/seo/articles/:id/publish", requireAdmin, async (req, res) => {
    const id = parseInt(String(req.params.id), 10);
    await db
      .update(seoArticles)
      .set({ status: "published", publishedAt: nowIso(), updatedAt: nowIso() })
      .where(eq(seoArticles.id, id));
    res.json({ ok: true });
  });

  app.post("/api/marketing/seo/articles/:id/unpublish", requireAdmin, async (req, res) => {
    const id = parseInt(String(req.params.id), 10);
    await db
      .update(seoArticles)
      .set({ status: "draft", updatedAt: nowIso() })
      .where(eq(seoArticles.id, id));
    res.json({ ok: true });
  });

  app.delete("/api/marketing/seo/articles/:id", requireAdmin, async (req, res) => {
    const id = parseInt(String(req.params.id), 10);
    await db.delete(seoArticles).where(eq(seoArticles.id, id));
    res.json({ ok: true });
  });

  // ── Public API — consumed by trykeylime.ai ──

  // List all published articles (for sitemap + blog index pages).
  app.get("/api/seo/public/articles", async (_req, res) => {
    const rows = await db
      .select({
        slug: seoArticles.slug,
        title: seoArticles.title,
        metaDescription: seoArticles.metaDescription,
        icp: seoArticles.icp,
        publishedAt: seoArticles.publishedAt,
        updatedAt: seoArticles.updatedAt,
        readingMinutes: seoArticles.readingMinutes,
        tags: seoArticles.tags,
      })
      .from(seoArticles)
      .where(eq(seoArticles.status, "published"))
      .orderBy(desc(seoArticles.publishedAt));
    res.setHeader("Cache-Control", "public, max-age=300"); // 5 min CDN cache
    res.json({ articles: rows });
  });

  // Single article by slug — full body + FAQ + JSON-LD.
  app.get("/api/seo/public/articles/:slug", async (req, res) => {
    const [row] = await db
      .select()
      .from(seoArticles)
      .where(and(eq(seoArticles.slug, String(req.params.slug)), eq(seoArticles.status, "published")))
      .limit(1);
    if (!row) return res.status(404).json({ message: "Not found" });
    res.setHeader("Cache-Control", "public, max-age=300");
    res.json({
      article: {
        ...row,
        faqs: safeJson(row.faqs, []),
        structuredData: safeJson(row.structuredData, {}),
        tags: safeJson(row.tags, []),
      },
    });
  });

  // Sitemap — published articles only.
  app.get("/sitemap-seo.xml", async (_req, res) => {
    const rows = await db
      .select({ slug: seoArticles.slug, updatedAt: seoArticles.updatedAt, publishedAt: seoArticles.publishedAt })
      .from(seoArticles)
      .where(eq(seoArticles.status, "published"));
    const urls = rows
      .map((r: any) => {
        const loc = `${APP_BASE_URL}/guides/${r.slug}`;
        const lastmod = (r.updatedAt || r.publishedAt || nowIso()).split("T")[0];
        return `  <url><loc>${escapeXml(loc)}</loc><lastmod>${lastmod}</lastmod><changefreq>weekly</changefreq><priority>0.8</priority></url>`;
      })
      .join("\n");
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>`;
    res.type("application/xml").send(xml);
  });

  // Public HTML render of an article — for previewing + for crawlers to hit
  // directly if the trykeylime.ai integration isn't wired yet. This URL is
  // what the sitemap points at. Serves fully-rendered SSR HTML so Googlebot
  // and LLM crawlers see the full content without JS.
  app.get("/guides/:slug", async (req, res) => {
    const [row] = await db
      .select()
      .from(seoArticles)
      .where(and(eq(seoArticles.slug, String(req.params.slug)), eq(seoArticles.status, "published")))
      .limit(1);
    if (!row) return res.status(404).type("text/html").send(notFoundHtml(String(req.params.slug)));
    const structuredData = safeJson(row.structuredData, {});
    const html = renderArticlePage({
      title: row.title,
      metaDescription: row.metaDescription,
      slug: row.slug,
      bodyHtml: row.bodyHtml,
      publishedAt: row.publishedAt || row.createdAt,
      updatedAt: row.updatedAt,
      readingMinutes: row.readingMinutes,
      structuredData,
    });
    res.setHeader("Cache-Control", "public, max-age=300");
    res.type("text/html").send(html);
  });
}

// ── helpers ──

function safeJson<T>(s: string, fallback: T): T {
  try { return JSON.parse(s); } catch { return fallback; }
}

function escapeXml(s: string): string {
  return s.replace(/[<>&'"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" }[c] || c));
}

function escapeHtml(s: string): string {
  return s.replace(/[<>&"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" }[c] || c));
}

function renderArticlePage(a: {
  title: string;
  metaDescription: string;
  slug: string;
  bodyHtml: string;
  publishedAt: string | null;
  updatedAt: string;
  readingMinutes: number;
  structuredData: Record<string, any>;
}): string {
  const canonical = `${APP_BASE_URL}/guides/${a.slug}`;
  const published = (a.publishedAt || a.updatedAt || nowIso()).split("T")[0];
  const updated = (a.updatedAt || nowIso()).split("T")[0];
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>${escapeHtml(a.title)}</title>
<meta name="description" content="${escapeHtml(a.metaDescription)}" />
<link rel="canonical" href="${escapeHtml(canonical)}" />
<meta property="og:type" content="article" />
<meta property="og:title" content="${escapeHtml(a.title)}" />
<meta property="og:description" content="${escapeHtml(a.metaDescription)}" />
<meta property="og:url" content="${escapeHtml(canonical)}" />
<meta property="og:site_name" content="Key Lime" />
<meta property="article:published_time" content="${published}" />
<meta property="article:modified_time" content="${updated}" />
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="${escapeHtml(a.title)}" />
<meta name="twitter:description" content="${escapeHtml(a.metaDescription)}" />
<script type="application/ld+json">${JSON.stringify(a.structuredData)}</script>
<style>
  :root {
    --ink: #2a1f14; --crust: #3E2C1C; --cream: #FFF8ED; --surface: #FFFFFF;
    --lime: #A8C856; --lime-dark: #8BAF3E; --gold: #E8A317; --teal: #5BB5A2;
    --border: rgba(62,44,28,0.12); --text: #2a1f14; --text-muted: #7a6b5a;
  }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; background: var(--cream); color: var(--text); font-family: "DM Sans", system-ui, -apple-system, BlinkMacSystemFont, sans-serif; }
  header.site { background: var(--crust); color: var(--cream); padding: 16px 24px; }
  header.site a { color: var(--cream); text-decoration: none; font-weight: 800; letter-spacing: -0.01em; }
  main { max-width: 720px; margin: 0 auto; padding: 48px 24px 96px; }
  article { background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: 40px 40px; }
  article h1 { font-family: "Manrope", system-ui, sans-serif; font-size: 2rem; font-weight: 800; letter-spacing: -0.02em; line-height: 1.2; margin: 0 0 8px; color: var(--ink); }
  article h2 { font-family: "Manrope", system-ui, sans-serif; font-size: 1.35rem; font-weight: 700; letter-spacing: -0.01em; margin: 2em 0 0.5em; color: var(--ink); }
  article h3 { font-family: "Manrope", system-ui, sans-serif; font-size: 1.08rem; font-weight: 700; margin: 1.5em 0 0.4em; color: var(--ink); }
  article p, article li { line-height: 1.75; font-size: 1rem; }
  article ul, article ol { padding-left: 1.2em; }
  article a { color: var(--lime-dark); text-decoration: underline; }
  article blockquote { border-left: 3px solid var(--lime); padding: 4px 16px; margin: 1em 0; color: var(--text-muted); background: rgba(168,200,86,0.06); border-radius: 0 6px 6px 0; }
  article table { border-collapse: collapse; width: 100%; margin: 1em 0; font-size: 0.95rem; }
  article th, article td { border: 1px solid var(--border); padding: 8px 12px; text-align: left; }
  article th { background: rgba(62,44,28,0.04); font-weight: 700; }
  article code { background: rgba(62,44,28,0.06); padding: 1px 6px; border-radius: 4px; font-family: "Fira Code", Menlo, monospace; font-size: 0.88em; }
  article .tldr { background: rgba(168,200,86,0.14); border: 1px solid rgba(168,200,86,0.4); border-radius: 8px; padding: 16px 20px; margin: 1.5em 0; font-size: 1.02rem; }
  .meta { font-size: 0.85rem; color: var(--text-muted); margin-bottom: 2em; display: flex; gap: 12px; }
  footer.site { padding: 40px 24px; text-align: center; color: var(--text-muted); font-size: 0.85rem; }
  footer.site a { color: var(--lime-dark); }
</style>
</head>
<body>
<header class="site">
  <a href="${escapeHtml(APP_BASE_URL)}">Key Lime</a>
</header>
<main>
  <article>
    <h1>${escapeHtml(a.title)}</h1>
    <div class="meta">
      <span>Published ${published}</span>
      <span>·</span>
      <span>${a.readingMinutes} min read</span>
      ${updated !== published ? `<span>·</span><span>Updated ${updated}</span>` : ""}
    </div>
    ${a.bodyHtml}
  </article>
</main>
<footer class="site">
  <p>Key Lime · Tampa, FL · <a href="${escapeHtml(APP_BASE_URL)}">trykeylime.ai</a></p>
</footer>
</body>
</html>`;
}

function notFoundHtml(slug: string): string {
  return `<!doctype html><html><head><meta charset="utf-8"/><title>Not found</title><style>body{font-family:system-ui;background:#FFF8ED;color:#2a1f14;padding:80px 24px;text-align:center;}a{color:#8BAF3E;}</style></head><body><h1>404 · Guide not found</h1><p>No published guide at <code>/guides/${escapeHtml(slug)}</code></p><p><a href="${escapeHtml(APP_BASE_URL)}">Back to Key Lime</a></p></body></html>`;
}
