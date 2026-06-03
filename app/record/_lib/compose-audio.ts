export type MixedAudio = {
  track: MediaStreamTrack | null;
  cleanup: () => void;
};

export function mixAudioTracks(streams: MediaStream[]): MixedAudio {
  const sources = streams.filter((stream) => stream.getAudioTracks().length > 0);

  if (sources.length === 0) {
    return { track: null, cleanup: () => {} };
  }

  // A single source needs no mixing — use its track directly. This avoids a
  // WebAudio graph (and a possibly-suspended AudioContext) in the common case.
  if (sources.length === 1) {
    return { track: sources[0].getAudioTracks()[0] ?? null, cleanup: () => {} };
  }

  const AudioCtor =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext: typeof AudioContext })
      .webkitAudioContext;
  const context = new AudioCtor();
  void context.resume();
  const destination = context.createMediaStreamDestination();

  for (const stream of sources) {
    const node = context.createMediaStreamSource(stream);
    node.connect(destination);
  }

  return {
    track: destination.stream.getAudioTracks()[0] ?? null,
    cleanup: () => {
      void context.close();
    },
  };
}
