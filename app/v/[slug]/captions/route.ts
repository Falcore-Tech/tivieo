import { cookies } from "next/headers";
import { webvtt } from "@deepgram/captions";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isExpired } from "@/lib/utils";
import type { Recording, TranscriptSegment } from "@/lib/types";

const MAX_WORDS_PER_CUE = 10;

function vttTimestamp(seconds: number) {
  const whole = Math.max(0, Math.floor(seconds));
  const ms = Math.round((seconds - whole) * 1000);
  const hh = String(Math.floor(whole / 3600)).padStart(2, "0");
  const mm = String(Math.floor((whole % 3600) / 60)).padStart(2, "0");
  const ss = String(whole % 60).padStart(2, "0");
  return `${hh}:${mm}:${ss}.${String(ms).padStart(3, "0")}`;
}

function hasWordTimings(segments: TranscriptSegment[]) {
  return (
    segments.length > 0 &&
    segments.every((s) => Array.isArray(s.words) && s.words.length > 0)
  );
}

// Word-level path: Deepgram's own converter chunks each utterance's words into
// lines of at most MAX_WORDS_PER_CUE, cueing on real per-word timestamps.
function toVttFromWords(segments: TranscriptSegment[]) {
  const utterances = segments.map((s) => ({
    start: s.start,
    end: s.end,
    transcript: s.text,
    words: s.words ?? [],
    ...(s.speaker !== undefined ? { speaker: s.speaker } : {}),
  }));
  return `${webvtt({ results: { utterances } }, MAX_WORDS_PER_CUE)}\n`;
}

// Legacy path for recordings transcribed before word timings were stored:
// split each utterance's text into ≤MAX_WORDS_PER_CUE cues with interpolated
// timestamps.
function splitSegmentIntoCues(segment: TranscriptSegment) {
  const words = segment.text.trim().split(/\s+/).filter(Boolean);
  if (words.length <= MAX_WORDS_PER_CUE) {
    return [{ start: segment.start, end: segment.end, text: segment.text.trim() }];
  }

  const chunkCount = Math.ceil(words.length / MAX_WORDS_PER_CUE);
  const wordsPerChunk = Math.ceil(words.length / chunkCount);
  const duration = Math.max(0, segment.end - segment.start);

  const cues = [];
  for (let i = 0; i < words.length; i += wordsPerChunk) {
    const chunkWords = words.slice(i, i + wordsPerChunk);
    const start = segment.start + (duration * i) / words.length;
    const end =
      segment.start + (duration * Math.min(i + wordsPerChunk, words.length)) / words.length;
    cues.push({ start, end, text: chunkWords.join(" ") });
  }
  return cues;
}

function toVttFromText(segments: TranscriptSegment[]) {
  const cues = segments.flatMap(splitSegmentIntoCues).map(
    (cue, i) =>
      `${i + 1}\n${vttTimestamp(cue.start)} --> ${vttTimestamp(cue.end)}\n${cue.text}`,
  );
  return `WEBVTT\n\n${cues.join("\n\n")}\n`;
}

function toVtt(segments: TranscriptSegment[]) {
  return hasWordTimings(segments)
    ? toVttFromWords(segments)
    : toVttFromText(segments);
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const admin = createAdminClient();
  const { data: recording } = await admin
    .from("recordings")
    .select("*")
    .eq("slug", slug)
    .maybeSingle<Recording>();

  if (!recording || recording.deleted_at) {
    return new Response("Not found", { status: 404 });
  }

  const isOwner = recording.user_id === user?.id;
  if (recording.visibility === "private" && !isOwner) {
    return new Response("Not found", { status: 404 });
  }
  if (isExpired(recording.expires_at) && !isOwner) {
    return new Response("Gone", { status: 410 });
  }
  if (recording.share_password_hash && !isOwner) {
    const store = await cookies();
    if (!store.get(`tv_pw_${recording.id}`)) {
      return new Response("Forbidden", { status: 403 });
    }
  }

  const segments = recording.transcript_segments ?? [];
  if (recording.transcript_status !== "ready" || segments.length === 0) {
    return new Response("WEBVTT\n\n", {
      headers: { "Content-Type": "text/vtt; charset=utf-8" },
    });
  }

  return new Response(toVtt(segments), {
    headers: {
      "Content-Type": "text/vtt; charset=utf-8",
      "Cache-Control": "private, max-age=300",
    },
  });
}
