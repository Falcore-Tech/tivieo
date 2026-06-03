"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type {
  Collection,
  Recording,
  RecordingVisibility,
} from "@/lib/types";
import { VISIBILITY, VISIBILITY_ORDER } from "@/app/_components/visibility";
import { ThumbnailPicker } from "./thumbnail-picker";
import { ShareProtection } from "./share-protection";
import { changeSlug, updateRecording } from "../_actions";

type Props = {
  recording: Recording;
  collections: Collection[];
  videoUrl: string | null;
  thumbnailUrl: string | null;
};

const NO_FOLDER = "none";

export function EditForm({
  recording,
  collections,
  videoUrl,
  thumbnailUrl,
}: Props) {
  const router = useRouter();
  const [title, setTitle] = useState(recording.title);
  const [visibility, setVisibility] = useState<RecordingVisibility>(
    recording.visibility,
  );
  const [folder, setFolder] = useState(recording.collection_id ?? NO_FOLDER);
  const [tags, setTags] = useState<string[]>(recording.tags ?? []);
  const [tagInput, setTagInput] = useState("");
  const [slug, setSlug] = useState(recording.slug);
  const [pending, startTransition] = useTransition();

  function addTag(raw: string) {
    const value = raw.trim().replace(/,+$/, "").trim();
    if (!value) return;
    setTags((prev) => (prev.includes(value) ? prev : [...prev, value]));
    setTagInput("");
  }

  function onTagKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter" || event.key === ",") {
      event.preventDefault();
      addTag(tagInput);
    } else if (event.key === "Backspace" && !tagInput && tags.length > 0) {
      setTags((prev) => prev.slice(0, -1));
    }
  }

  function save() {
    startTransition(async () => {
      const meta = await updateRecording(recording.id, {
        title,
        visibility,
        collectionId: folder === NO_FOLDER ? null : folder,
        tags,
      });
      if (meta.error) {
        toast.error(meta.error);
        return;
      }

      if (slug.trim() !== recording.slug) {
        const result = await changeSlug(recording.id, slug);
        if (result.error) {
          toast.error(result.error);
          return;
        }
        toast.success("Changes saved");
        if (result.slug && result.slug !== recording.slug) {
          router.replace(`/edit/${result.slug}`);
          return;
        }
      } else {
        toast.success("Changes saved");
      }
      router.refresh();
    });
  }

  return (
    <div className="mt-6 grid gap-6">
      <div className="grid gap-2">
        <Label htmlFor="title">Title</Label>
        <Input
          id="title"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
        />
      </div>

      <div className="grid gap-2">
        <Label htmlFor="slug">Share link</Label>
        <div className="flex items-center rounded-md border border-border focus-within:ring-2 focus-within:ring-ring">
          <span className="pl-3 pr-1 text-sm text-muted-foreground">/v/</span>
          <input
            id="slug"
            value={slug}
            onChange={(event) => setSlug(event.target.value)}
            className="flex-1 bg-transparent py-2 pr-3 text-sm outline-none"
          />
        </div>
        <p className="text-xs text-muted-foreground">
          Old links keep working: anyone who has the previous link is redirected
          here.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor="visibility">Visibility</Label>
          <Select
            value={visibility}
            onValueChange={(value) =>
              setVisibility(value as RecordingVisibility)
            }
          >
            <SelectTrigger id="visibility">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {VISIBILITY_ORDER.map((key) => (
                <SelectItem key={key} value={key}>
                  {VISIBILITY[key].label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid gap-2">
          <Label htmlFor="folder">Folder</Label>
          <Select value={folder} onValueChange={setFolder}>
            <SelectTrigger id="folder">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NO_FOLDER}>No folder</SelectItem>
              {collections.map((collection) => (
                <SelectItem key={collection.id} value={collection.id}>
                  {collection.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid gap-2">
        <Label htmlFor="tags">Tags</Label>
        <div className="flex flex-wrap items-center gap-1.5 rounded-md border border-border p-1.5 focus-within:ring-2 focus-within:ring-ring">
          {tags.map((tag) => (
            <Badge key={tag} variant="secondary" className="gap-1 font-normal">
              {tag}
              <button
                type="button"
                onClick={() => setTags((prev) => prev.filter((t) => t !== tag))}
                aria-label={`Remove ${tag}`}
              >
                <X className="size-3" />
              </button>
            </Badge>
          ))}
          <input
            id="tags"
            value={tagInput}
            onChange={(event) => setTagInput(event.target.value)}
            onKeyDown={onTagKeyDown}
            onBlur={() => addTag(tagInput)}
            placeholder={tags.length === 0 ? "Add a tag, press Enter" : ""}
            className="min-w-32 flex-1 bg-transparent px-1 py-1 text-sm outline-none"
          />
        </div>
      </div>

      <ThumbnailPicker
        recordingId={recording.id}
        videoUrl={videoUrl}
        initialThumbnailUrl={thumbnailUrl}
      />

      <ShareProtection
        recordingId={recording.id}
        initialHasPassword={Boolean(recording.share_password_hash)}
        initialExpiresAt={recording.expires_at}
      />

      <div className="flex gap-2">
        <Button onClick={save} disabled={pending}>
          Save changes
        </Button>
        <Button variant="ghost" onClick={() => router.push("/")}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
