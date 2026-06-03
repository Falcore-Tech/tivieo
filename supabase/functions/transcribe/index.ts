// Tivieo transcription worker.
//
// Triggered by a Supabase Database Webhook on INSERT into public.recordings.
// Flow: verify shared secret -> ack immediately (202) -> in the background:
// mark row `processing` -> mint a signed URL for the private webm -> Deepgram
// pre-recorded transcription (remote URL) -> store full text, per-utterance
// segments, summary, topics -> mark row `ready` (or `error`).
//
// Required function secrets:
//   DEEPGRAM_API_KEY           - Deepgram API key
//   TRANSCRIBE_WEBHOOK_SECRET  - shared secret echoed by the webhook header
// (SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are injected automatically.)

import { createClient } from "jsr:@supabase/supabase-js@2";

declare const EdgeRuntime: { waitUntil(promise: Promise<unknown>): void };

const RECORDINGS_BUCKET = "recordings";
const SIGNED_URL_TTL_SECONDS = 60 * 30;
const MAX_TOPICS = 6;

// Summarization + topic detection are English-only; on non-English audio the
// whole request fails, so we fall back to a transcript-only request.
function deepgramEndpoint(withIntelligence: boolean) {
  const params = new URLSearchParams({
    model: "nova-3",
    smart_format: "true",
    punctuate: "true",
    utterances: "true",
    detect_language: "true",
  });
  if (withIntelligence) {
    params.set("summarize", "v2");
    params.set("topics", "true");
  }
  return `https://api.deepgram.com/v1/listen?${params.toString()}`;
}

type WebhookPayload = {
  type: "INSERT" | "UPDATE" | "DELETE";
  record: {
    id: string;
    storage_path: string;
    transcript_status: string | null;
  } | null;
};

type DeepgramUtterance = {
  start: number;
  end: number;
  transcript: string;
  speaker?: number;
};

type DeepgramTopic = { topic: string; confidence_score?: number };

type DeepgramResponse = {
  results?: {
    utterances?: DeepgramUtterance[];
    channels?: Array<{
      detected_language?: string;
      alternatives?: Array<{ transcript?: string }>;
    }>;
    summary?: { result?: string; short?: string };
    topics?: {
      segments?: Array<{ topics?: DeepgramTopic[] }>;
    };
  };
};

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

async function requestDeepgram(signedUrl: string): Promise<DeepgramResponse> {
  async function call(withIntelligence: boolean) {
    return await fetch(deepgramEndpoint(withIntelligence), {
      method: "POST",
      headers: {
        Authorization: `Token ${Deno.env.get("DEEPGRAM_API_KEY")}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ url: signedUrl }),
    });
  }

  let response = await call(true);
  if (!response.ok) {
    // Most likely non-English audio (summary/topics unsupported) — retry plain.
    response = await call(false);
  }
  if (!response.ok) {
    throw new Error(`Deepgram ${response.status}: ${await response.text()}`);
  }
  return (await response.json()) as DeepgramResponse;
}

function topTopics(result: DeepgramResponse): string[] {
  const best = new Map<string, number>();
  for (const segment of result.results?.topics?.segments ?? []) {
    for (const { topic, confidence_score = 0 } of segment.topics ?? []) {
      if (!topic) continue;
      best.set(topic, Math.max(best.get(topic) ?? 0, confidence_score));
    }
  }
  return [...best.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, MAX_TOPICS)
    .map(([topic]) => topic);
}

async function transcribeRecording(
  id: string,
  storagePath: string,
): Promise<void> {
  try {
    await setStatus(id, { transcript_status: "processing" });

    const { data: signed, error: signError } = await admin.storage
      .from(RECORDINGS_BUCKET)
      .createSignedUrl(storagePath, SIGNED_URL_TTL_SECONDS);
    if (signError || !signed?.signedUrl) {
      throw new Error(signError?.message ?? "Could not sign recording URL");
    }

    const result = await requestDeepgram(signed.signedUrl);
    const channel = result.results?.channels?.[0];
    const fullText = channel?.alternatives?.[0]?.transcript ?? "";
    const segments = (result.results?.utterances ?? []).map((u) => ({
      start: u.start,
      end: u.end,
      text: u.transcript,
      ...(u.speaker !== undefined ? { speaker: u.speaker } : {}),
    }));
    const summary = result.results?.summary?.short ?? null;
    const topics = topTopics(result);

    await setStatus(id, {
      transcript_status: "ready",
      transcript_lang: channel?.detected_language ?? null,
      transcript_text: fullText,
      transcript_segments: segments,
      transcript_summary: summary,
      transcript_topics: topics.length > 0 ? topics : null,
    });
  } catch (error) {
    console.error(`transcribe ${id} failed:`, error);
    await setStatus(id, { transcript_status: "error" });
  }
}

Deno.serve(async (req) => {
  if (req.headers.get("x-webhook-secret") !== Deno.env.get("TRANSCRIBE_WEBHOOK_SECRET")) {
    return new Response("Unauthorized", { status: 401 });
  }

  const payload = (await req.json()) as WebhookPayload;
  const record = payload.record;
  if (payload.type !== "INSERT" || !record?.storage_path) {
    return new Response("Ignored", { status: 200 });
  }

  // Ack the webhook immediately; transcription runs in the background so a long
  // Deepgram call never trips the trigger's HTTP timeout.
  EdgeRuntime.waitUntil(transcribeRecording(record.id, record.storage_path));
  return new Response(JSON.stringify({ ok: true, queued: record.id }), {
    status: 202,
    headers: { "Content-Type": "application/json" },
  });
});
