import React, { useState } from 'react';
import { Music, Check, Play, Square } from 'lucide-react';

interface MusicControlProps {
  musicUrl: string;
  onSaveMusicUrl: (url: string) => void;
  music: { isPlaying: boolean; hasVideo: boolean; stop: () => void };
}

function looksLikeUrl(value: string): boolean {
  if (!value.trim()) return false;
  try {
    new URL(value.trim());
    return true;
  } catch {
    return false;
  }
}

/** Set here in edit mode; once saved it plays as the live background music for everyone. */
export const MusicControl: React.FC<MusicControlProps> = ({ musicUrl, onSaveMusicUrl, music }) => {
  const [musicInput, setMusicInput] = useState(musicUrl);
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    if (!looksLikeUrl(musicInput)) return;
    onSaveMusicUrl(musicInput.trim());
    setSaved(true);
    setTimeout(() => setSaved(false), 1600);
  };

  return (
    <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10 space-y-2">
      <label className="text-[11px] font-bold uppercase tracking-wider text-white/70 flex items-center gap-1.5">
        <Music className="w-3.5 h-3.5 text-[#FF2E7E]" />
        Background Music (YouTube)
      </label>
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={musicInput}
          onChange={(e) => setMusicInput(e.target.value)}
          placeholder="https://youtube.com/watch?v=... or youtu.be/..."
          className="flex-1 min-w-0 px-3 py-2 rounded-xl bg-black/60 border border-white/20 text-white text-xs placeholder:text-white/40 focus:outline-none focus:border-[#FF2E7E]"
        />
        <button
          type="button"
          onClick={handleSave}
          disabled={!looksLikeUrl(musicInput)}
          className="shrink-0 px-3.5 py-2 rounded-xl bg-[#FF2E7E] hover:bg-[#ff156e] disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-bold uppercase tracking-wide transition-colors flex items-center gap-1.5 cursor-pointer"
        >
          {saved ? <Check className="w-3.5 h-3.5" /> : null}
          <span>{saved ? 'Saved' : 'Save & Play'}</span>
        </button>
      </div>
      {music.hasVideo && (
        <div className="flex items-center justify-between">
          <span
            className={`inline-flex items-center gap-1.5 text-[11px] font-semibold ${
              music.isPlaying ? 'text-emerald-400' : 'text-white/50'
            }`}
          >
            <Play className="w-3 h-3" />
            {music.isPlaying ? 'playing' : 'tap anywhere to start'}
          </span>
          <button
            type="button"
            onClick={music.stop}
            className="inline-flex items-center gap-1 text-[11px] text-white/60 hover:text-white transition-colors cursor-pointer"
          >
            <Square className="w-3 h-3" />
            <span>Stop</span>
          </button>
        </div>
      )}
    </div>
  );
};
