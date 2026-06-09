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
//   OPENAI_API_KEY             - OpenAI API key (first-person summary)
//   TRANSCRIBE_WEBHOOK_SECRET  - shared secret echoed by the webhook header
//   R2_ACCOUNT_ID              - Cloudflare R2 account id
//   R2_ACCESS_KEY_ID           - R2 S3 API access key id
//   R2_SECRET_ACCESS_KEY       - R2 S3 API secret
//   R2_VIDEOS_BUCKET           - private R2 bucket holding the webm recordings
// (SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are injected automatically.)

import { createClient } from "jsr:@supabase/supabase-js@2";
import { AwsClient } from "https://esm.sh/aws4fetch@1.0.20";

declare const EdgeRuntime: { waitUntil(promise: Promise<unknown>): void };

const SIGNED_URL_TTL_SECONDS = 60 * 30;
const MAX_TOPICS = 6;

// The recording owner. Boosted as a Deepgram keyterm so his name is
// transcribed correctly at the source, and named to the summarizer.
const SPEAKER_NAME = "Faez";

// Topic detection is English-only; on non-English audio the whole request
// fails, so we fall back to a transcript-only request.
function deepgramEndpoint(withIntelligence: boolean) {
  const params = new URLSearchParams({
    model: "nova-3",
    smart_format: "true",
    punctuate: "true",
    utterances: "true",
    detect_language: "true",
  });
  // Boost recognition of the owner's name (nova-3 only).
  params.append("keyterm", SPEAKER_NAME);
  if (withIntelligence) {
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

type DeepgramWord = {
  word: string;
  start: number;
  end: number;
  punctuated_word?: string;
  speaker?: number;
};

type DeepgramUtterance = {
  start: number;
  end: number;
  transcript: string;
  speaker?: number;
  words?: DeepgramWord[];
};

type DeepgramTopic = { topic: string; confidence_score?: number };

type DeepgramResponse = {
  results?: {
    utterances?: DeepgramUtterance[];
    channels?: Array<{
      detected_language?: string;
      alternatives?: Array<{ transcript?: string }>;
    }>;
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

// Presign an R2 GET URL (query-signed) that Deepgram fetches as a plain remote
// URL. R2 is S3-compatible, so aws4fetch signs it the same as any S3 request.
const r2 = new AwsClient({
  accessKeyId: Deno.env.get("R2_ACCESS_KEY_ID")!,
  secretAccessKey: Deno.env.get("R2_SECRET_ACCESS_KEY")!,
  service: "s3",
  region: "auto",
});

async function presignR2Get(key: string, expiresSeconds: number): Promise<string> {
  const accountId = Deno.env.get("R2_ACCOUNT_ID")!;
  const bucket = Deno.env.get("R2_VIDEOS_BUCKET")!;
  const url = new URL(
    `https://${accountId}.r2.cloudflarestorage.com/${bucket}/${key}`,
  );
  url.searchParams.set("X-Amz-Expires", String(expiresSeconds));
  const signed = await r2.sign(url.toString(), {
    method: "GET",
    aws: { signQuery: true },
  });
  return signed.url;
}

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

// First-person video description, written as the owner. Deepgram's extractive
// summarizer can't produce this voice, so we generate it from the transcript
// with OpenAI. Returns null if there's no transcript or the call fails, so a
// summarizer outage never breaks transcription.
const SUMMARY_SYSTEM_PROMPT = [
  `You write the description for a screen recording narrated by ${SPEAKER_NAME}.`,
  "Write in the FIRST PERSON as the narrator (\"I walk through…\", \"I demonstrate…\").",
  "Produce ONE concise paragraph of plain prose — MAXIMUM 50 words, no headings, lists, or markdown.",
  "State what the video covers and its purpose. Be concrete and grounded strictly in",
  "the transcript; do not invent details. Match this voice:",
  "",
  "In this video, I walk through several custom software and automation projects I have built, including a customized CRM, WhatsApp chatbot automations, and order and lead management workflows, to give an overview of my experience and discuss the expected scope and budget for a similar implementation.",
].join("\n");

async function summarizeTranscript(transcript: string): Promise<string | null> {
  const apiKey = Deno.env.get("OPENAI_API_KEY");
  if (!apiKey || !transcript.trim()) return null;
  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-5.4-mini",
        temperature: 0.4,
        max_completion_tokens: 120,
        messages: [
          { role: "system", content: SUMMARY_SYSTEM_PROMPT },
          {
            role: "user",
            content: `Write the description for this video.\n\nTranscript:\n${transcript}`,
          },
        ],
      }),
    });
    if (!response.ok) {
      console.error(`OpenAI ${response.status}: ${await response.text()}`);
      return null;
    }
    const data = await response.json();
    const text = data?.choices?.[0]?.message?.content?.trim();
    return text || null;
  } catch (error) {
    console.error("OpenAI summary failed:", error);
    return null;
  }
}

async function transcribeRecording(
  id: string,
  storagePath: string,
): Promise<void> {
  try {
    await setStatus(id, { transcript_status: "processing" });

    const signedUrl = await presignR2Get(storagePath, SIGNED_URL_TTL_SECONDS);
    const result = await requestDeepgram(signedUrl);
    const channel = result.results?.channels?.[0];
    const fullText = channel?.alternatives?.[0]?.transcript ?? "";
    const segments = (result.results?.utterances ?? []).map((u) => ({
      start: u.start,
      end: u.end,
      text: u.transcript,
      ...(u.speaker !== undefined ? { speaker: u.speaker } : {}),
      ...(u.words
        ? {
            words: u.words.map((w) => ({
              word: w.word,
              start: w.start,
              end: w.end,
              ...(w.punctuated_word !== undefined
                ? { punctuated_word: w.punctuated_word }
                : {}),
              ...(w.speaker !== undefined ? { speaker: w.speaker } : {}),
            })),
          }
        : {}),
    }));
    const summary = await summarizeTranscript(fullText);
    const topics = topTopics(result);

    await setStatus(id, {
      transcript_status: "ready",
      transcript_lang: channel?.detected_language ?? null,
      transcript_text: fullText,
      transcript_segments: segments,
      transcript_summary: summary,
      transcript_topics: topics.length > 0 ? topics : null,
      // Hand off to the generate-chapters function (only when there's speech to
      // chapter). Setting 'pending' crosses the generate_chapters_on_pend
      // trigger (migration 0008), which POSTs to that function.
      ...(segments.length > 0 ? { chapters_status: "pending" } : {}),
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
