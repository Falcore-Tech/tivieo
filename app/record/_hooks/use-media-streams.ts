"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type DeviceOption = { deviceId: string; label: string };

export function useMediaStreams() {
  const [webcamStream, setWebcamStream] = useState<MediaStream | null>(null);
  const [screenStream, setScreenStream] = useState<MediaStream | null>(null);
  const [cameras, setCameras] = useState<DeviceOption[]>([]);
  const [microphones, setMicrophones] = useState<DeviceOption[]>([]);
  const [selectedCameraId, setSelectedCameraId] = useState<string>("");
  const [selectedMicId, setSelectedMicId] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  const webcamRef = useRef<MediaStream | null>(null);
  const screenRef = useRef<MediaStream | null>(null);

  const refreshDevices = useCallback(async () => {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const toOption = (device: MediaDeviceInfo, fallback: string): DeviceOption => ({
      deviceId: device.deviceId,
      label: device.label || fallback,
    });
    setCameras(
      devices
        .filter((d) => d.kind === "videoinput")
        .map((d, i) => toOption(d, `Camera ${i + 1}`)),
    );
    setMicrophones(
      devices
        .filter((d) => d.kind === "audioinput")
        .map((d, i) => toOption(d, `Microphone ${i + 1}`)),
    );
  }, []);

  const enableCamera = useCallback(
    async (cameraId?: string, micId?: string) => {
      setError(null);
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: cameraId ? { deviceId: { exact: cameraId } } : true,
          audio: micId ? { deviceId: { exact: micId } } : true,
        });
        webcamRef.current?.getTracks().forEach((t) => t.stop());
        webcamRef.current = stream;
        setWebcamStream(stream);
        const camTrack = stream.getVideoTracks()[0];
        const micTrack = stream.getAudioTracks()[0];
        if (camTrack) setSelectedCameraId(camTrack.getSettings().deviceId ?? "");
        if (micTrack) setSelectedMicId(micTrack.getSettings().deviceId ?? "");
        await refreshDevices();
      } catch {
        setError("Camera or microphone access was blocked.");
      }
    },
    [refreshDevices],
  );

  const enableScreen = useCallback(async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { frameRate: 30 },
        audio: true,
      });
      screenRef.current?.getTracks().forEach((t) => t.stop());
      screenRef.current = stream;
      setScreenStream(stream);
      stream.getVideoTracks()[0]?.addEventListener("ended", () => {
        screenRef.current = null;
        setScreenStream(null);
      });
      return stream;
    } catch {
      setError("Screen sharing was cancelled.");
      return null;
    }
  }, []);

  const stopAll = useCallback(() => {
    webcamRef.current?.getTracks().forEach((t) => t.stop());
    screenRef.current?.getTracks().forEach((t) => t.stop());
    webcamRef.current = null;
    screenRef.current = null;
    setWebcamStream(null);
    setScreenStream(null);
  }, []);

  useEffect(() => {
    return () => stopAll();
  }, [stopAll]);

  return {
    webcamStream,
    screenStream,
    cameras,
    microphones,
    selectedCameraId,
    selectedMicId,
    error,
    enableCamera,
    enableScreen,
    stopAll,
  };
}
