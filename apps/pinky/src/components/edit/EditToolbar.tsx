/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Save, ChevronLeft, ChevronRight, Lock } from 'lucide-react';
import { ShareMode } from '../../types';

interface EditToolbarProps {
  screenIndex: number;
  screenCount: number;
  screenLabel: string;
  onPrev: () => void;
  onNext: () => void;
  /** Commits and drops out to a live preview of the card — reversible (the pencil
   * button re-opens the editor), unlike Finish editing. */
  onSave: () => void;
  onFinish: () => void | Promise<void>;
  mode: ShareMode;
  /** Only passed on the first screen — the background-music field lives here (see
   * App.tsx), never as a floating panel over the card itself. */
  musicSlot?: React.ReactNode;
}

/**
 * A real DOM flex sibling of the card, never a `fixed`/`absolute` overlay — so it always
 * reserves its own row of layout space and the card content area shrinks to fit above it.
 * That's what actually guarantees it can never cover the design, on mobile or anywhere
 * else, rather than just visually appearing not to.
 */
export function EditToolbar({
  screenIndex,
  screenCount,
  screenLabel,
  onPrev,
  onNext,
  onSave,
  onFinish,
  mode,
  musicSlot
}: EditToolbarProps) {
  const [confirmingFinish, setConfirmingFinish] = useState(false);
  const [finishing, setFinishing] = useState(false);

  const handleConfirmYes = async () => {
    setFinishing(true);
    try {
      await onFinish();
    } finally {
      setFinishing(false);
      setConfirmingFinish(false);
    }
  };

  return (
    <div
      id="edit-toolbar"
      className="w-full shrink-0 bg-neutral-950/97 border-t border-white/10 backdrop-blur-xl relative z-[70]"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      {musicSlot && <div className="px-3 pt-2.5">{musicSlot}</div>}

      {!confirmingFinish ? (
        <div className="h-14 px-2 sm:px-4 flex items-center justify-between gap-1 sm:gap-3">
          <button
            type="button"
            id="btn-edit-save"
            onClick={onSave}
            title="Save & preview — you can keep editing after"
            className="flex items-center gap-1.5 px-2.5 sm:px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-[11px] sm:text-xs font-bold uppercase tracking-wide transition-colors cursor-pointer shrink-0"
          >
            <Save className="w-3.5 h-3.5" />
            <span className="hidden xs:inline">Save &amp; Preview</span>
          </button>

          <div className="flex items-center gap-1 sm:gap-2 min-w-0">
            <button
              type="button"
              id="btn-edit-prev"
              onClick={onPrev}
              disabled={screenIndex === 0}
              aria-label="Previous screen"
              className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/15 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center text-white/80 transition-colors cursor-pointer shrink-0"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-[10px] text-white/50 tabular-nums text-center truncate max-w-[7rem] sm:max-w-none">
              {screenLabel} · {screenIndex + 1}/{screenCount}
            </span>
            <button
              type="button"
              id="btn-edit-next"
              onClick={onNext}
              disabled={screenIndex === screenCount - 1}
              aria-label="Next screen"
              className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/15 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center text-white/80 transition-colors cursor-pointer shrink-0"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <button
            type="button"
            id="btn-edit-finish"
            onClick={() => setConfirmingFinish(true)}
            className="flex items-center gap-1.5 px-2.5 sm:px-3.5 py-2 rounded-xl bg-red-500/15 hover:bg-red-500/25 text-red-300 hover:text-red-200 text-[11px] sm:text-xs font-bold uppercase tracking-wide transition-colors cursor-pointer shrink-0"
          >
            <Lock className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Finish editing</span>
          </button>
        </div>
      ) : (
        <div className="min-h-14 px-3 py-2 flex items-center justify-between gap-2 flex-wrap sm:flex-nowrap">
          <span className="text-[11px] text-white/80 leading-snug">
            {mode === 'real'
              ? 'Permanently finish editing? The card will lock and editing cannot be restored afterward.'
              : 'Stop editing for now? Nothing is locked — you can reopen the editor anytime.'}
          </span>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              id="btn-edit-finish-yes"
              onClick={handleConfirmYes}
              disabled={finishing}
              className="px-3.5 py-1.5 rounded-lg bg-red-500/80 hover:bg-red-500 disabled:opacity-60 text-white text-[11px] font-bold uppercase cursor-pointer"
            >
              {finishing ? 'Working…' : 'Yes'}
            </button>
            <button
              type="button"
              id="btn-edit-finish-no"
              onClick={() => setConfirmingFinish(false)}
              disabled={finishing}
              className="px-3.5 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white text-[11px] font-semibold cursor-pointer"
            >
              No
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
