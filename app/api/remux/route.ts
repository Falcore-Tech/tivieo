import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { remuxRecordingVideo } from "./_lib/remux";

// ffmpeg-static is a native binary + /tmp filesystem → Node runtime, not Edge.
export const runtime = "nodejs";
export const maxDuration = 300;

const MAX_ATTEMPTS = 3;

type Job = { id: string; storage_path: string; remux_attempts: number };
type Admin = ReturnType<typeof createAdminClient>;

// Atomically claim a row by flipping pending/error → processing only if it is
// still in that state, so a duplicate webhook delivery never double-processes.
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

// Invoked by the Supabase Database Webhook on recordings INSERT (and re-pend).
// Auth is the shared secret stored in Vault and sent as x-webhook-secret —
// mirrors the transcribe pipeline.
export async function POST(request: NextRequest) {
  const secret = process.env.REMUX_WEBHOOK_SECRET;
  if (!secret || request.headers.get("x-webhook-secret") !== secret)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let payload: { record?: { id?: string }; recordingId?: string } = {};
  try {
    payload = await request.json();
  } catch {
    // ignore
  }
  const recordingId = payload.record?.id ?? payload.recordingId;
  if (!recordingId)
    return NextResponse.json({ error: "Missing recording id" }, { status: 400 });

  const admin = createAdminClient();
  const { data: job } = await admin
    .from("recordings")
    .select("id, storage_path, remux_attempts")
    .eq("id", recordingId)
    .maybeSingle<Job>();
  if (!job) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const result = await runJob(admin, job);
  return NextResponse.json({ result });
}
