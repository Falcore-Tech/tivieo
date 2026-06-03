import { Globe, Link2, Lock } from "lucide-react";
import type { RecordingVisibility } from "@/lib/types";

export const VISIBILITY: Record<
  RecordingVisibility,
  { label: string; description: string; icon: typeof Globe }
> = {
  public: {
    label: "Public",
    description: "Anyone with the link, listed publicly",
    icon: Globe,
  },
  unlisted: {
    label: "Unlisted",
    description: "Anyone with the link can watch",
    icon: Link2,
  },
  private: {
    label: "Private",
    description: "Only you can watch",
    icon: Lock,
  },
};

export const VISIBILITY_ORDER: RecordingVisibility[] = [
  "public",
  "unlisted",
  "private",
];
