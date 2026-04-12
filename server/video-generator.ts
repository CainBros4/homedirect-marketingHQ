import { exec } from "child_process";
import { promisify } from "util";
import * as fs from "fs";
import * as path from "path";
import { storage } from "./storage";
import type { VideoJob, InsertVideoJob } from "@shared/schema";

const execAsync = promisify(exec);

// ── Helpers ────────────────────────────────────────────────────────────────────

function tmpDir(jobId: number): string {
  return `/tmp/mh-videos/${jobId}`;
}

function ensureDir(dir: string): void {
  fs.mkdirSync(dir, { recursive: true });
}

/** Escape special chars for FFmpeg drawtext filter */
function escapeDrawtext(text: string): string {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/'/g, "\\'")
    .replace(/:/g, "\\:")
    .replace(/\[/g, "\\[")
    .replace(/\]/g, "\\]");
}

// ── Default search terms by ICP ────────────────────────────────────────────────

const DEFAULT_SEARCH_TERMS: Record<string, string[]> = {
  buyer:     ["house keys", "couple home", "modern kitchen", "neighborhood walk"],
  seller:    ["home exterior", "house for sale", "real estate", "front door"],
  concierge: ["showing house", "open house", "real estate agent", "walking neighborhood"],
  default:   ["modern home", "real estate", "house keys", "neighborhood"],
};

// ── Stage 1: Generate voiceover with ElevenLabs ────────────────────────────────

async function generateVoiceover(
  script: string,
  voiceId: string,
  apiKey: string,
  jobId: number,
): Promise<{ path: string; duration: number }> {
  const dir = tmpDir(jobId);
  ensureDir(dir);
  const audioPath = path.join(dir, "voiceover.mp3");

  console.log(`[VideoJob ${jobId}] Generating voiceover with voice ${voiceId}...`);

  const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
    method: "POST",
    headers: {
      "xi-api-key": apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      text: script,
      model_id: "eleven_turbo_v2",
      voice_settings: {
        stability: 0.5,
        similarity_boost: 0.75,
      },
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`ElevenLabs API error ${response.status}: ${errText}`);
  }

  const buffer = await response.arrayBuffer();
  fs.writeFileSync(audioPath, Buffer.from(buffer));

  // Get duration using ffprobe
  const { stdout } = await execAsync(
    `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${audioPath}"`,
  );
  const duration = parseFloat(stdout.trim());
  if (isNaN(duration)) throw new Error("Could not determine audio duration");

  console.log(`[VideoJob ${jobId}] Voiceover ready: ${duration.toFixed(1)}s`);
  return { path: audioPath, duration };
}

// ── Stage 2: Fetch b-roll from Pexels ─────────────────────────────────────────

async function fetchBroll(
  searchTerms: string[],
  totalDuration: number,
  pexelsKey: string,
  jobId: number,
  aspectRatio: string,
): Promise<string[]> {
  const dir = tmpDir(jobId);
  ensureDir(dir);

  const orientation = aspectRatio === "9:16" ? "portrait" : "landscape";
  const downloadedPaths: string[] = [];

  console.log(`[VideoJob ${jobId}] Fetching b-roll for terms: ${searchTerms.join(", ")}`);

  for (let i = 0; i < searchTerms.length; i++) {
    const term = searchTerms[i];
    try {
      const url = `https://api.pexels.com/videos/search?query=${encodeURIComponent(term)}&per_page=3&orientation=${orientation}`;
      const resp = await fetch(url, {
        headers: { Authorization: pexelsKey },
      });
      if (!resp.ok) {
        console.warn(`[VideoJob ${jobId}] Pexels search failed for "${term}": ${resp.status}`);
        continue;
      }
      const data: any = await resp.json();
      const videos = data.videos || [];

      let chosen: string | null = null;
      for (const video of videos) {
        const files: any[] = video.video_files || [];
        // Try HD first
        let file = files.find((f: any) => f.quality === "hd" && f.width >= 720);
        if (!file) file = files.find((f: any) => f.width >= 720);
        if (!file) file = files[0];
        if (file && file.link) {
          chosen = file.link;
          break;
        }
      }

      if (!chosen) {
        console.warn(`[VideoJob ${jobId}] No suitable video found for "${term}"`);
        continue;
      }

      const outPath = path.join(dir, `broll_${downloadedPaths.length}.mp4`);
      console.log(`[VideoJob ${jobId}] Downloading b-roll clip ${downloadedPaths.length} for "${term}"...`);

      // Download with curl (streaming)
      await execAsync(`curl -sL -o "${outPath}" "${chosen}"`);
      downloadedPaths.push(outPath);
    } catch (err: any) {
      console.warn(`[VideoJob ${jobId}] Error fetching b-roll for "${term}": ${err.message}`);
    }
  }

  if (downloadedPaths.length === 0) {
    throw new Error("Could not download any b-roll clips from Pexels");
  }

  // Loop clips until we have enough coverage (5-8 seconds per clip estimate)
  const CLIP_DURATION = 7; // seconds per clip target
  const clipsNeeded = Math.ceil(totalDuration / CLIP_DURATION);
  const result: string[] = [];
  for (let i = 0; i < clipsNeeded; i++) {
    result.push(downloadedPaths[i % downloadedPaths.length]);
  }

  console.log(`[VideoJob ${jobId}] ${result.length} b-roll slots ready (${downloadedPaths.length} unique clips)`);
  return result;
}

// ── Stage 3: Compose video with FFmpeg ────────────────────────────────────────

async function composeVideo(
  job: VideoJob,
  audioPath: string,
  brollPaths: string[],
  audioDuration: number,
): Promise<string> {
  const dir = tmpDir(job.id);
  const isPortrait = job.aspectRatio === "9:16";
  const W = 1080;
  const H = isPortrait ? 1920 : 1080;
  const FONT = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf";

  console.log(`[VideoJob ${job.id}] Composing video ${W}x${H} for ${audioDuration.toFixed(1)}s...`);

  // Step 1: Trim and scale each unique broll clip
  const uniquePaths = [...new Set(brollPaths)];
  const scaledClips: string[] = [];
  for (let i = 0; i < uniquePaths.length; i++) {
    const inPath = uniquePaths[i];
    const outPath = path.join(dir, `clip_${i}.mp4`);
    // Scale with crop to fill target dimensions
    const scaleFilter = `scale=${W}:${H}:force_original_aspect_ratio=increase,crop=${W}:${H},setsar=1,fps=30`;
    await execAsync(
      `ffmpeg -y -i "${inPath}" -t 8 -vf "${scaleFilter}" -c:v libx264 -preset fast -crf 23 -an "${outPath}"`,
    );
    scaledClips.push(outPath);
  }

  // Step 2: Build concat file — loop clips to cover full audio duration
  const CLIP_DURATION = 7;
  const concatListPath = path.join(dir, "file_list.txt");
  let listContent = "";
  let accumulated = 0;
  let clipIdx = 0;
  while (accumulated < audioDuration) {
    const clipPath = scaledClips[clipIdx % scaledClips.length];
    listContent += `file '${clipPath}'\n`;
    accumulated += CLIP_DURATION;
    clipIdx++;
  }
  fs.writeFileSync(concatListPath, listContent);

  // Step 3: Concatenate clips
  const concatPath = path.join(dir, "concat.mp4");
  await execAsync(
    `ffmpeg -y -f concat -safe 0 -i "${concatListPath}" -t ${audioDuration.toFixed(3)} -c copy "${concatPath}"`,
  );

  // Step 4: Build drawtext filters
  const filters: string[] = [];

  // Green bottom bar (brand watermark): 8px strip at very bottom
  filters.push(
    `drawbox=x=0:y=ih-8:w=iw:h=8:color=#00C47A@1.0:t=fill`,
  );

  // Hook text overlay: 0-4s
  if (job.hookText && job.hookText.trim()) {
    const safe = escapeDrawtext(job.hookText.trim());
    filters.push(
      `drawtext=fontfile='${FONT}':text='${safe}':fontsize=72:fontcolor=white:x=(w-text_w)/2:y=(h/4-text_h/2):shadowx=3:shadowy=3:shadowcolor=black@0.8:enable='between(t,0,4)'`,
    );
  }

  // CTA text overlay: last 5 seconds
  if (job.ctaText && job.ctaText.trim()) {
    const safe = escapeDrawtext(job.ctaText.trim());
    const startTime = Math.max(0, audioDuration - 5);
    filters.push(
      `drawtext=fontfile='${FONT}':text='${safe}':fontsize=56:fontcolor=white:x=(w-text_w)/2:y=(h*3/4-text_h/2):box=1:boxcolor=#00C47A@0.9:boxborderw=20:enable='gte(t,${startTime.toFixed(3)})'`,
    );
  }

  const outputPath = path.join(dir, "output.mp4");
  const vfString = filters.join(",");

  // Step 5: Compose final video with audio + text overlays
  await execAsync(
    `ffmpeg -y -i "${concatPath}" -i "${audioPath}" ` +
    `-vf "${vfString}" ` +
    `-c:v libx264 -preset fast -crf 22 -c:a aac -b:a 128k ` +
    `-map 0:v -map 1:a -shortest "${outputPath}"`,
  );

  // Cleanup intermediate files (keep output.mp4)
  try {
    fs.unlinkSync(concatPath);
    for (const p of scaledClips) fs.unlinkSync(p);
    for (const p of uniquePaths) fs.unlinkSync(p);
    fs.unlinkSync(audioPath);
  } catch (_) { /* best-effort cleanup */ }

  console.log(`[VideoJob ${job.id}] Video composed: ${outputPath}`);
  return outputPath;
}

// ── Stage 4: Main orchestrator ─────────────────────────────────────────────────

export async function processVideoJob(jobId: number): Promise<void> {
  const elevenKey = process.env.ELEVENLABS_API_KEY;
  const pexelsKey = process.env.PEXELS_API_KEY;

  if (!elevenKey || !pexelsKey) {
    storage.updateVideoJob(jobId, {
      status: "failed",
      errorMessage: "Missing ELEVENLABS_API_KEY or PEXELS_API_KEY environment variables",
    });
    return;
  }

  let job = storage.getVideoJob(jobId);
  if (!job) {
    console.error(`[VideoJob ${jobId}] Job not found`);
    return;
  }

  try {
    // Stage 1: Generate voiceover
    storage.updateVideoJob(jobId, { status: "generating_audio" });
    const { path: audioPath, duration } = await generateVoiceover(
      job.script,
      job.voiceId,
      elevenKey,
      jobId,
    );
    storage.updateVideoJob(jobId, { audioDuration: duration });

    // Reload job for fresh data
    job = storage.getVideoJob(jobId)!;

    // Stage 2: Fetch b-roll
    storage.updateVideoJob(jobId, { status: "fetching_broll" });
    const icp = job.icp || "default";
    let searchTerms: string[];
    if (job.searchTerms && job.searchTerms.trim()) {
      searchTerms = job.searchTerms.split(",").map(t => t.trim()).filter(Boolean);
    } else {
      searchTerms = DEFAULT_SEARCH_TERMS[icp] || DEFAULT_SEARCH_TERMS.default;
    }

    const brollPaths = await fetchBroll(
      searchTerms,
      duration,
      pexelsKey,
      jobId,
      job.aspectRatio,
    );

    // Stage 3: Compose video
    storage.updateVideoJob(jobId, { status: "composing" });
    job = storage.getVideoJob(jobId)!;
    const outputPath = await composeVideo(job, audioPath, brollPaths, duration);

    // Done
    storage.updateVideoJob(jobId, {
      status: "done",
      outputPath,
      completedAt: Date.now(),
    });
    console.log(`[VideoJob ${jobId}] Complete!`);
  } catch (err: any) {
    console.error(`[VideoJob ${jobId}] Failed:`, err.message);
    storage.updateVideoJob(jobId, {
      status: "failed",
      errorMessage: err.message || "Unknown error",
    });
  }
}

// ── Export: startVideoJob ──────────────────────────────────────────────────────

export async function startVideoJob(jobData: InsertVideoJob): Promise<number> {
  const job = storage.createVideoJob({
    ...jobData,
    status: "pending",
    createdAt: Date.now(),
  });

  // Fire and forget — do NOT await
  setImmediate(() => {
    processVideoJob(job.id).catch(err => {
      console.error(`[VideoJob ${job.id}] Unhandled error:`, err.message);
    });
  });

  return job.id;
}
