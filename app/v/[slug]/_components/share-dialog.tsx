"use client";

import { useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Check, Copy, Mail, Share2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { watchPath, watchUrl } from "@/app/_components/share-link";

type Props = {
  slug: string;
  title: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function ShareDialog({ slug, title, open, onOpenChange }: Props) {
  const [copied, setCopied] = useState<string | null>(null);
  const url = watchUrl(slug);
  const embedSrc =
    typeof window === "undefined"
      ? `/embed/${slug}`
      : `${window.location.origin}/embed/${slug}`;
  const embedCode = `<iframe src="${embedSrc}" width="640" height="360" frameborder="0" allow="fullscreen" allowfullscreen></iframe>`;

  async function copy(value: string, label: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(label);
      toast.success("Copied");
      setTimeout(() => setCopied(null), 1800);
    } catch {
      toast.error("Could not copy");
    }
  }

  async function nativeShare() {
    if (navigator.share) {
      try {
        await navigator.share({ title, url });
      } catch {
        // user dismissed the share sheet
      }
    } else {
      copy(url, "link");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Share recording</DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="link">
          <TabsList className="w-full">
            <TabsTrigger value="link" className="flex-1">
              Link
            </TabsTrigger>
            <TabsTrigger value="embed" className="flex-1">
              Embed
            </TabsTrigger>
            <TabsTrigger value="qr" className="flex-1">
              QR
            </TabsTrigger>
          </TabsList>

          <TabsContent value="link" className="grid gap-3">
            <div className="flex gap-2">
              <Input readOnly value={url} className="font-mono text-xs" />
              <Button
                variant="secondary"
                onClick={() => copy(url, "link")}
                aria-label="Copy link"
              >
                {copied === "link" ? (
                  <Check className="size-4" />
                ) : (
                  <Copy className="size-4" />
                )}
              </Button>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={nativeShare}>
                <Share2 className="size-4" /> Share
              </Button>
              <Button asChild variant="outline" size="sm">
                <a
                  href={`https://twitter.com/intent/tweet?url=${encodeURIComponent(url)}&text=${encodeURIComponent(title)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  X / Twitter
                </a>
              </Button>
              <Button asChild variant="outline" size="sm">
                <a
                  href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  LinkedIn
                </a>
              </Button>
              <Button asChild variant="outline" size="sm">
                <a
                  href={`mailto:?subject=${encodeURIComponent(title)}&body=${encodeURIComponent(url)}`}
                >
                  <Mail className="size-4" /> Email
                </a>
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="embed" className="grid gap-2">
            <Textarea
              readOnly
              value={embedCode}
              rows={3}
              className="font-mono text-xs"
            />
            <Button
              variant="secondary"
              size="sm"
              className="w-fit"
              onClick={() => copy(embedCode, "embed")}
            >
              {copied === "embed" ? (
                <Check className="size-4" />
              ) : (
                <Copy className="size-4" />
              )}
              Copy embed code
            </Button>
          </TabsContent>

          <TabsContent value="qr" className="flex flex-col items-center gap-3 py-2">
            <div className="rounded-lg bg-white p-4">
              <QRCodeSVG value={url} size={176} />
            </div>
            <p className="text-xs text-muted-foreground">
              Scan to open {watchPath(slug)}
            </p>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
