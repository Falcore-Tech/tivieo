import { Sparkles } from "lucide-react";
import type { TranscriptStatus } from "@/lib/types";

type Props = {
  status: TranscriptStatus;
  summary: string | null;
  topics: string[] | null;
};

export function TranscriptInsights({ status, summary, topics }: Props) {
  if (status !== "ready") return null;
  const hasTopics = Boolean(topics && topics.length > 0);
  if (!summary && !hasTopics) return null;

  return (
    <section className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center gap-1.5 text-sm font-medium">
        <Sparkles className="size-4 text-primary" />
        Summary
      </div>

      {summary ? (
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          {summary}
        </p>
      ) : null}

      {hasTopics ? (
        <ul className="mt-3 flex flex-wrap gap-1.5">
          {topics!.map((topic) => (
            <li
              key={topic}
              className="rounded-full bg-secondary px-2.5 py-0.5 text-xs text-secondary-foreground"
            >
              {topic}
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
