// Tivieo chapter generator.
//
// Triggered by a Supabase Database Webhook on UPDATE of recordings.chapters_status
// to 'pending' (migration 0008). The transcribe function sets it 'pending' once a
// transcript exists; the regenerateChapters server action re-pends for a manual
// rerun. This reads the stored transcript (no Deepgram) and asks OpenAI to split
// it into named chapters.
//
// Flow: verify shared secret -> ack immediately (202) -> in the background:
// mark row `processing` -> load transcript segments + duration -> OpenAI ->
// validate/clamp/sort chapters -> write `chapters` + mark `ready` (or `error`).
//
// Required function secrets:
//   OPENAI_API_KEY           - OpenAI API key
//   CHAPTERS_WEBHOOK_SECRET  - shared secret echoed by the webhook header
// (SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are injected automatically.)

import { createClient } from "jsr:@supabase/supabase-js@2";

declare const EdgeRuntime: { waitUntil(promise: Promise<unknown>): void };

const MIN_CHAPTERS = 3;
const MAX_CHAPTERS = 8;

type TranscriptSegment = { start: number; end: number; text: string };

type WebhookPayload = {
  type: "INSERT" | "UPDATE" | "DELETE";
  record: { id: string; chapters_status: string | null } | null;
};

type Chapter = { start: number; title: string; description?: string };

const admin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { persistSession: false, autoRefreshToken: false } },
);

async function setStatus(
  id: string,
  fields: Record<string, unknown>,
): Promise<void> {
  await admin.from("recordings").update(fields).eq("id", id);
}

function clock(seconds: number): string {
  const whole = Math.max(0, Math.floor(seconds));
  const m = Math.floor(whole / 60);
  const s = whole % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

const CHAPTERS_SYSTEM_PROMPT = [
  "You split a screen recording's transcript into chapters — named, timestamped",
  "sections a viewer can jump between.",
  `Return STRICT JSON: { "chapters": [{ "start": <seconds, number>, "title": <string>, "description": <string> }] }.`,
  `Produce between ${MIN_CHAPTERS} and ${MAX_CHAPTERS} chapters.`,
  "The first chapter MUST start at 0. Starts must strictly increase and stay",
  "within the video's duration. Titles are concise (≤6 words), in Title Case, no",
  "trailing punctuation. Each description is ONE sentence (≤20 words) summarizing",
  "what happens in that chapter. Everything is grounded strictly in the transcript",
  "— do not invent content. Place each start at a natural topic shift.",
].join("\n");

async function generateChapters(
  segments: TranscriptSegment[],
  duration: number,
): Promise<Chapter[] | null> {
  const apiKey = Deno.env.get("OPENAI_API_KEY");
  if (!apiKey || segments.length === 0) return null;

  const transcript = segments
    .map((s) => `[${clock(s.start)}] ${s.text}`)
    .join("\n");
  const durationHint = duration > 0
    ? `The video is ${clock(duration)} (${Math.round(duration)} seconds) long.\n\n`
    : "";

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-5.4-mini",
        temperature: 0.3,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: CHAPTERS_SYSTEM_PROMPT },
          {
            role: "user",
            content:
              `${durationHint}Split this transcript into chapters.\n\nTranscript:\n${transcript}`,
          },
        ],
      }),
    });
    if (!response.ok) {
      console.error(`OpenAI ${response.status}: ${await response.text()}`);
      return null;
    }
    const data = await response.json();
    const raw = data?.choices?.[0]?.message?.content;
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { chapters?: unknown };
    return sanitizeChapters(parsed.chapters, duration);
  } catch (error) {
    console.error("OpenAI chapters failed:", error);
    return null;
  }
}

function sanitizeChapters(value: unknown, duration: number): Chapter[] | null {
  if (!Array.isArray(value)) return null;
  const max = duration > 0 ? duration : Infinity;
  const seen = new Set<number>();
  const chapters: Chapter[] = [];
  for (const item of value) {
    const start = Math.floor(Number((item as Chapter)?.start));
    const title = String((item as Chapter)?.title ?? "").trim();
    const description = String((item as Chapter)?.description ?? "").trim();
    if (!title || !Number.isFinite(start) || start < 0 || start > max) continue;
    if (seen.has(start)) continue;
    seen.add(start);
    chapters.push(description ? { start, title, description } : { start, title });
  }
  if (chapters.length === 0) return null;
  chapters.sort((a, b) => a.start - b.start);
  chapters[0].start = 0;
  return chapters;
}

async function processChapters(id: string): Promise<void> {
  try {
    await setStatus(id, { chapters_status: "processing" });

    const { data } = await admin
      .from("recordings")
      .select("transcript_segments, duration_seconds")
      .eq("id", id)
      .maybeSingle<{
        transcript_segments: TranscriptSegment[] | null;
        duration_seconds: number | null;
      }>();

    const segments = data?.transcript_segments ?? [];
    const duration = data?.duration_seconds ?? 0;
    const chapters = await generateChapters(segments, duration);

    if (!chapters) {
      await setStatus(id, { chapters_status: "error" });
      return;
    }

    await setStatus(id, { chapters, chapters_status: "ready" });
  } catch (error) {
    console.error(`generate-chapters ${id} failed:`, error);
    await setStatus(id, { chapters_status: "error" });
  }
}

Deno.serve(async (req) => {
  if (
    req.headers.get("x-webhook-secret") !==
      Deno.env.get("CHAPTERS_WEBHOOK_SECRET")
  ) {
    return new Response("Unauthorized", { status: 401 });
  }

  const payload = (await req.json()) as WebhookPayload;
  const record = payload.record;
  if (!record?.id || record.chapters_status !== "pending") {
    return new Response("Ignored", { status: 200 });
  }

  EdgeRuntime.waitUntil(processChapters(record.id));
  return new Response(JSON.stringify({ ok: true, queued: record.id }), {
    status: 202,
    headers: { "Content-Type": "application/json" },
  });
});
