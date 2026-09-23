'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
type Tone = 'nav' | 'yes' | 'heart' | 'success' | 'message';
export function useSound() {
  const [enabled, setEnabled] = useState(false);
  const ctx = useRef<AudioContext | null>(null),
    master = useRef<GainNode | null>(null),
    active = useRef(false);
  const clips = useRef<Partial<Record<'nav' | 'message', HTMLAudioElement>>>(
    {},
  );
  useEffect(() => {
    clips.current = {
      nav: new Audio('/audio/nokia-keypad.mp3'),
      message: new Audio('/audio/nokia-3310-message.mp3'),
    };
    Object.values(clips.current).forEach((clip) => {
      clip.preload = 'auto';
      clip.volume = 0.42;
      clip.load();
    });
    return () => {
      Object.values(clips.current).forEach((clip) => clip.pause());
      void ctx.current?.close().catch(() => {});
    };
  }, []);
  const play = useCallback((kind: Tone) => {
    if (!active.current) return;
    try {
      if (kind === 'nav' || kind === 'message') {
        const clip = clips.current[kind];
        if (clip) {
          clip.currentTime = 0;
          void clip.play().catch(() => {});
        }
        return;
      }
      ctx.current ??= new AudioContext();
      const audio = ctx.current;
      if (!master.current) {
        master.current = audio.createGain();
        master.current.connect(audio.destination);
      }
      master.current.gain.setValueAtTime(1, audio.currentTime);
      void audio.resume().catch(() => {});
      // A warm, original 3-second music-box phrase; short heart notes stay snappy.
      const melody: [number, number][] =
        kind === 'success'
          ? [
              [72, 0.18],
              [76, 0.18],
              [79, 0.26],
              [76, 0.18],
              [81, 0.26],
              [79, 0.3],
              [0, 0.12],
              [76, 0.18],
              [79, 0.18],
              [84, 0.3],
              [83, 0.18],
              [79, 0.2],
              [76, 0.18],
              [84, 0.5],
            ]
          : kind === 'yes'
            ? [
                [67, 0.1],
                [72, 0.1],
                [76, 0.18],
              ]
            : [
                [79, 0.08],
                [84, 0.12],
              ];
      let start = audio.currentTime;
      melody.forEach(([note, duration]) => {
        if (note) {
          const oscillator = audio.createOscillator(),
            gain = audio.createGain();
          oscillator.type = kind === 'success' ? 'triangle' : 'square';
          oscillator.frequency.value = 440 * 2 ** ((note - 69) / 12);
          gain.gain.setValueAtTime(0, start);
          gain.gain.linearRampToValueAtTime(
            kind === 'success' ? 0.13 : 0.025,
            start + 0.006,
          );
          gain.gain.exponentialRampToValueAtTime(
            0.0001,
            start + duration - 0.005,
          );
          oscillator.connect(gain);
          gain.connect(master.current!);
          oscillator.start(start);
          oscillator.stop(start + duration);
        }
        start += duration;
      });
    } catch {
      /* Optional sound never blocks a choice. */
    }
  }, []);
  const enable = useCallback(() => {
    if (active.current) return false;
    active.current = true;
    setEnabled(true);
    if (master.current && ctx.current)
      master.current.gain.setValueAtTime(1, ctx.current.currentTime);
    return true;
  }, []);
  const toggle = () => {
    if (!active.current) enable();
    else {
      active.current = false;
      setEnabled(false);
    }
    if (master.current && ctx.current)
      master.current.gain.setValueAtTime(
        active.current ? 1 : 0,
        ctx.current.currentTime,
      );
    if (active.current) play('nav');
    else Object.values(clips.current).forEach((clip) => clip.pause());
  };
  return { enabled, enable, toggle, play };
}
