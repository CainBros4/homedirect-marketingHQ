# HomeDirectAI — Marketing Hub

Internal creative and advertising operations center.

## Live URL
Hosted on Perplexity Computer:
https://www.perplexity.ai/computer/a/homedirectai-marketing-hub-EZWU81Z.T6KISFvXLyhTnA

## Tools
- **Copy Generator** — ICP-targeted ad copy, hooks, video scripts, social captions, CTAs
- **Competitor Monitor** — Meta Ad Library + Google Ads Transparency automated digest (coming soon)
- **Brief Generator** — Performance data → creative briefs (coming soon)
- **Performance Board** — Multi-channel attribution dashboard (coming soon)

## Local Development
```bash
cd marketing-hub
npm install
npm run dev
```

## Deploy to Railway
1. Create a new Railway service pointing to the `marketing-hub/` subfolder
2. Build command: `npm run build`
3. Start command: `NODE_ENV=production node dist/index.cjs`
4. Railway will generate a public URL

## First Setup
After deploying, go to `/settings` and add an AI API key:
- **Together AI** (recommended): https://api.together.xyz/settings/api-keys
- **OpenAI**: https://platform.openai.com/api-keys
- **DeepSeek**: https://platform.deepseek.com/api_keys

## Stack
- React + Vite + Tailwind CSS + shadcn/ui (frontend)
- Express.js + SQLite via Drizzle ORM (backend)
- OpenAI-compatible API calls (Together AI / OpenAI / DeepSeek / Fireworks)
