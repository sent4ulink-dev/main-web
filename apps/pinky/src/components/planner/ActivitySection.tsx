/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Sparkles, Check, Heart, ArrowLeft, X, Plus } from 'lucide-react';
import { ActivityOption } from '../../types';
import { EditableText } from '../edit/EditableText';

interface ActivitySectionProps {
  activities: ActivityOption[];
  initialActivity: string;
  onSave: (activity: string) => void;
  onCancel: () => void;
  /** Owner edit mode: same card grid, but every card's emoji/text is directly editable
   * in place instead of selectable, cards can be removed, and the "custom activity" box
   * below becomes an "add activity" box. Navigation is via the editor toolbar's
   * Prev/Next, not this section's own header/footer, which are hidden in this mode. */
  editing?: boolean;
  onAddActivity?: (emoji: string, text: string) => void;
  onUpdateActivity?: (id: string, patch: Partial<Pick<ActivityOption, 'emoji' | 'text'>>) => void;
  onRemoveActivity?: (id: string) => void;
}

export function ActivitySection({
  activities,
  initialActivity,
  onSave,
  onCancel,
  editing = false,
  onAddActivity,
  onUpdateActivity,
  onRemoveActivity
}: ActivitySectionProps) {
  const [selectedTitle, setSelectedTitle] = useState<string>(
    initialActivity || activities[0]?.text || ''
  );
  const [customText, setCustomText] = useState<string>('');
  const [isCustom, setIsCustom] = useState<boolean>(
    Boolean(initialActivity && !activities.some((a) => a.text === initialActivity))
  );
  const [isClosing, setIsClosing] = useState<boolean>(false);

  const handleSelect = (title: string) => {
    setSelectedTitle(title);
    setIsCustom(false);
  };

  const handleTriggerCancel = () => {
    setIsClosing(true);
    setTimeout(() => {
      onCancel();
    }, 380);
  };

  const handleTriggerSave = () => {
    const finalActivity = isCustom && customText.trim() ? customText.trim() : selectedTitle;
    setIsClosing(true);
    setTimeout(() => {
      onSave(finalActivity);
    }, 380);
  };

  return (
    <div
      className={`w-full max-w-2xl bg-neutral-950/95 border border-[#FF2E7E]/40 rounded-3xl p-5 sm:p-7 shadow-[0_0_80px_rgba(255,46,126,0.4)] backdrop-blur-2xl text-white flex flex-col max-h-[90vh] ${
        isClosing ? 'animate-heart-shrink-back' : 'animate-heart-zoom-page'
      }`}
    >
      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b border-white/10 shrink-0">
        {editing ? (
          <div className="w-9" />
        ) : (
          <button
            type="button"
            onClick={handleTriggerCancel}
            className="p-2 rounded-full hover:bg-white/10 text-white/70 hover:text-white transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
        )}
        <div className="text-center">
          <div className="flex items-center justify-center gap-2">
            <Heart className="w-4 h-4 fill-[#FF2E7E] text-[#FF2E7E]" />
            <h2 className="text-lg sm:text-xl font-bold uppercase tracking-wider">
              {editing ? 'Activity Options' : 'Choose Activity'}
            </h2>
          </div>
          <p className="text-xs text-white/60 mt-0.5">
            {editing ? 'Tap an emoji or title to edit it' : 'What are we doing together on our date?'}
          </p>
        </div>
        <div className="w-9" />
      </div>

      {/* Activities Grid */}
      <div className="overflow-y-auto py-4 space-y-3 pr-1">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {activities.map((act) => {
            const isChosen = !isCustom && selectedTitle === act.text;
            return (
              <div
                key={act.id}
                role={editing ? undefined : 'button'}
                tabIndex={editing ? undefined : 0}
                onClick={editing ? undefined : () => handleSelect(act.text)}
                onKeyDown={
                  editing
                    ? undefined
                    : (e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          handleSelect(act.text);
                        }
                      }
                }
                className={`text-center p-4 rounded-2xl border transition-all duration-200 ${
                  editing ? '' : 'cursor-pointer'
                } flex flex-col items-center gap-2 relative group ${
                  isChosen
                    ? 'bg-[#FF2E7E]/25 border-[#FF2E7E] shadow-[0_0_20px_rgba(255,46,126,0.35)] scale-[1.01]'
                    : 'bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20'
                }`}
              >
                {editing ? (
                  <EditableText
                    tag="span"
                    className="text-3xl"
                    value={act.emoji}
                    onCommit={(v) => onUpdateActivity?.(act.id, { emoji: v || '💖' })}
                    ariaLabel={`Emoji for ${act.text || 'activity'}`}
                  />
                ) : (
                  <span className="text-3xl">{act.emoji}</span>
                )}
                {editing ? (
                  <EditableText
                    tag="h3"
                    className="font-bold text-xs sm:text-sm text-white leading-snug"
                    value={act.text}
                    onCommit={(v) => onUpdateActivity?.(act.id, { text: v })}
                    ariaLabel="Activity title"
                    placeholder="Activity title"
                  />
                ) : (
                  <h3 className="font-bold text-xs sm:text-sm text-white group-hover:text-[#FF80BF] transition-colors leading-snug">
                    {act.text}
                  </h3>
                )}
                {isChosen && !editing && (
                  <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-[#FF2E7E] flex items-center justify-center text-black">
                    <Check className="w-3.5 h-3.5 stroke-[3]" />
                  </div>
                )}
                {editing && (
                  <button
                    type="button"
                    id={`btn-remove-activity-${act.id}`}
                    onClick={() => onRemoveActivity?.(act.id)}
                    disabled={activities.length <= 1}
                    title={activities.length <= 1 ? 'At least one activity is required' : 'Remove'}
                    className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-black/60 hover:bg-red-500/80 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center text-white/70 hover:text-white transition-colors cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            );
          })}

          {/* Add-activity card — only in edit mode, same grid slot styling as a real card */}
          {editing && (
            <button
              type="button"
              id="btn-add-activity"
              onClick={() => onAddActivity?.('💖', 'New activity')}
              className="p-4 rounded-2xl border border-dashed border-white/20 hover:border-[#FF2E7E]/60 text-white/50 hover:text-white flex flex-col items-center justify-center gap-2 transition-colors cursor-pointer min-h-[104px]"
            >
              <Plus className="w-5 h-5" />
              <span className="text-xs font-semibold uppercase tracking-wide">Add</span>
            </button>
          )}
        </div>

        {/* Custom Activity Option — the visitor's free-text pick. Not shown while the
            owner is editing: they add new options via the card above instead, which
            edits the actual list rather than a one-off unsaved pick. */}
        {!editing && (
          <div className="pt-2">
            <div
              onClick={() => setIsCustom(true)}
              className={`p-3.5 rounded-2xl border transition-all cursor-pointer ${
                isCustom
                  ? 'bg-[#FF2E7E]/20 border-[#FF2E7E]'
                  : 'bg-white/5 border-white/10 hover:bg-white/10'
              }`}
            >
              <div className="flex items-center gap-2 mb-2">
                <Sparkles className="w-4 h-4 text-[#FF80BF]" />
                <span className="text-xs font-bold uppercase tracking-wider text-white">
                  Something Else in Mind? (Custom Activity)
                </span>
              </div>
              <input
                type="text"
                placeholder="e.g. Cooking homemade pasta & baking dessert..."
                value={customText}
                onChange={(e) => {
                  setCustomText(e.target.value);
                  setIsCustom(true);
                }}
                onFocus={() => setIsCustom(true)}
                className="w-full px-3.5 py-2 rounded-xl bg-black/60 border border-white/20 text-white text-xs placeholder:text-white/40 focus:outline-none focus:border-[#FF2E7E]"
              />
            </div>
          </div>
        )}
      </div>

      {/* Footer / Save Button — hidden while editing; the editor toolbar's Prev/Next
          and Save handle navigation and persistence there instead. */}
      {!editing && (
        <div className="pt-4 border-t border-white/10 flex items-center justify-end gap-3 shrink-0">
          <button
            type="button"
            onClick={handleTriggerCancel}
            className="px-5 py-2.5 rounded-full text-xs font-semibold text-white/70 hover:text-white transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleTriggerSave}
            className="px-7 py-2.5 rounded-full bg-[#FF2E7E] hover:bg-[#ff156e] active:scale-95 text-white font-bold text-xs uppercase tracking-widest transition-all duration-200 shadow-lg shadow-[#FF2E7E]/40 flex items-center gap-2 cursor-pointer"
          >
            <Check className="w-4 h-4" />
            <span>Save</span>
          </button>
        </div>
      )}
    </div>
  );
}
