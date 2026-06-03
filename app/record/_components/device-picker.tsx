"use client";

import { Camera, Mic } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";

type DeviceOption = { deviceId: string; label: string };

type Props = {
  cameras: DeviceOption[];
  microphones: DeviceOption[];
  selectedCameraId: string;
  selectedMicId: string;
  disabled?: boolean;
  onSelectCamera: (deviceId: string) => void;
  onSelectMic: (deviceId: string) => void;
};

export function DevicePicker({
  cameras,
  microphones,
  selectedCameraId,
  selectedMicId,
  disabled,
  onSelectCamera,
  onSelectMic,
}: Props) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="flex flex-col gap-2">
        <Label className="flex items-center gap-1.5 text-muted-foreground">
          <Camera className="size-4" /> Camera
        </Label>
        <Select
          value={selectedCameraId}
          onValueChange={onSelectCamera}
          disabled={disabled || cameras.length === 0}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Select camera" />
          </SelectTrigger>
          <SelectContent>
            {cameras.map((camera) => (
              <SelectItem key={camera.deviceId} value={camera.deviceId}>
                {camera.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col gap-2">
        <Label className="flex items-center gap-1.5 text-muted-foreground">
          <Mic className="size-4" /> Microphone
        </Label>
        <Select
          value={selectedMicId}
          onValueChange={onSelectMic}
          disabled={disabled || microphones.length === 0}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Select microphone" />
          </SelectTrigger>
          <SelectContent>
            {microphones.map((mic) => (
              <SelectItem key={mic.deviceId} value={mic.deviceId}>
                {mic.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
