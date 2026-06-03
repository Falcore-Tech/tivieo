import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isExpired } from "@/lib/utils";
import type { Recording, TranscriptSegment } from "@/lib/types";

function vttTimestamp(seconds: number) {
  const whole = Math.max(0, Math.floor(seconds));
  const ms = Math.round((seconds - whole) * 1000);
  const hh = String(Math.floor(whole / 3600)).padStart(2, "0");
  const mm = String(Math.floor((whole % 3600) / 60)).padStart(2, "0");
  const ss = String(whole % 60).padStart(2, "0");
  return `${hh}:${mm}:${ss}.${String(ms).padStart(3, "0")}`;
}

function toVtt(segments: TranscriptSegment[]) {
  const cues = segments.map(
    (s, i) =>
      `${i + 1}\n${vttTimestamp(s.start)} --> ${vttTimestamp(s.end)}\n${s.text}`,
  );
  return `WEBVTT\n\n${cues.join("\n\n")}\n`;
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
