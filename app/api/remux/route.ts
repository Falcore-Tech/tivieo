import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { remuxRecordingVideo } from "./_lib/remux";

// ffmpeg-static is a native binary + /tmp filesystem → Node runtime, not Edge.
export const runtime = "nodejs";
export const maxDuration = 300;

const MAX_ATTEMPTS = 3;
const SWEEP_LIMIT = 5;

type Job = { id: string; storage_path: string; remux_attempts: number };
type Admin = ReturnType<typeof createAdminClient>;

// Atomically claim a row by flipping pending/error → processing only if it is
// still in that state, so concurrent workers never grab the same job.
async function claim(admin: Admin, id: string, attempts: number) {
  const { data } = await admin
    .from("recordings")
    .update({ remux_status: "processing", remux_attempts: attempts + 1 })
    .eq("id", id)
    .in("remux_status", ["pending", "error"])
    .select("id")
    .maybeSingle();
  return Boolean(data);
}

async function runJob(admin: Admin, job: Job) {
  if (!(await claim(admin, job.id, job.remux_attempts))) return "skipped";
  try {
    await remuxRecordingVideo(job.id, job.storage_path);
    await admin.from("recordings").update({ remux_status: "ready" }).eq("id", job.id);
    return "ready";
  } catch (error) {
    const failed = job.remux_attempts + 1 >= MAX_ATTEMPTS;
    await admin
      .from("recordings")
      .update({ remux_status: failed ? "error" : "pending" })
      .eq("id", job.id);
    console.error(`remux ${job.id} failed:`, error);
    return failed ? "error" : "retry";
  }
}

function isCron(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  return (
    Boolean(secret) &&
    request.headers.get("authorization") === `Bearer ${secret}`
  );
}

// Cron sweep (Vercel cron sends GET): process a batch of pending/error jobs.
export async function GET(request: NextRequest) {
  if (!isCron(request))
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();
  const { data: jobs } = await admin
    .from("recordings")
    .select("id, storage_path, remux_attempts")
    .in("remux_status", ["pending", "error"])
    .lt("remux_attempts", MAX_ATTEMPTS)
    .order("created_at", { ascending: true })
    .limit(SWEEP_LIMIT)
    .returns<Job[]>();

  const results: Record<string, string> = {};
  for (const job of jobs ?? []) results[job.id] = await runJob(admin, job);
  return NextResponse.json({ processed: jobs?.length ?? 0, results });
}

// Owner kick right after upload: process one recording the caller owns.
export async function POST(request: NextRequest) {
  let body: { recordingId?: string } = {};
  try {
    body = await request.json();
  } catch {
    // ignore
  }
  if (!body.recordingId)
    return NextResponse.json({ error: "Missing recordingId" }, { status: 400 });

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();
  const { data: job } = await admin
    .from("recordings")
    .select("id, user_id, storage_path, remux_attempts")
    .eq("id", body.recordingId)
    .maybeSingle<Job & { user_id: string }>();
  if (!job || job.user_id !== user.id)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  const result = await runJob(admin, job);
  return NextResponse.json({ result });
}
