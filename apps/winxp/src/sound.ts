type Sound =
  | "click"
  | "minimize"
  | "restore"
  | "startup"
  | "open"
  | "error"
  | "notification"
  | "heart"
  | "complete"
  | "confirm";
let context: AudioContext | undefined;
const clips: Partial<Record<Sound, string>> = {
  click: "click",
  open: "restore",
  minimize: "minimize",
  restore: "restore",
  startup: "startup",
  error: "error",
  notification: "notification",
};
const active = new Set<HTMLAudioElement>();
export function stopSounds() {
  for (const clip of active) clip.pause();
  active.clear();
}
export function sound(kind: Sound, muted: boolean) {
  if (muted) return;
  if (clips[kind]) {
    const clip = new Audio(`/sounds/${clips[kind]}.wav`);
    clip.volume = 0.45;
    active.add(clip);
    clip.onended = () => active.delete(clip);
    void clip.play().catch(() => active.delete(clip));
    return;
  }
  try {
    context ??= new AudioContext();
    void context.resume();
    const melodies: Record<Sound, number[]> = {
      click: [680],
      minimize: [660, 440],
      restore: [440, 660],
      startup: [523, 659, 784],
      open: [440, 660],
      error: [330, 260],
      notification: [659, 784, 988],
      heart: [523, 784, 1047],
      complete: [523, 659, 784, 1047, 784, 1047],
      confirm: [523, 659, 784, 1047],
    };
    melodies[kind].forEach((f, i) => {
      const oscillator = context!.createOscillator(),
        gain = context!.createGain(),
        at = context!.currentTime + i * 0.12;
      oscillator.type = "sine";
      oscillator.frequency.value = f;
      gain.gain.setValueAtTime(0, at);
      gain.gain.linearRampToValueAtTime(0.07, at + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.001, at + 0.23);
      oscillator.connect(gain);
      gain.connect(context!.destination);
      oscillator.start(at);
      oscillator.stop(at + 0.24);
    });
  } catch {
    /* Sound is optional. */
  }
}
