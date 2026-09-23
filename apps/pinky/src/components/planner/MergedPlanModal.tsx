/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  Heart,
  Sparkles,
  Calendar,
  Clock,
  MapPin,
  Film,
  CheckCircle2,
  ExternalLink,
  Compass,
  Image as ImageIcon,
  MessageSquare,
  CalendarPlus,
  Loader2,
  XCircle
} from 'lucide-react';
import { DatePlan } from '../../types';
import { createPlanImageFile, shareOrDownloadPlanImage, ShareImageResult } from '../../utils/planImage';
import { openSmsComposer } from '../../utils/planMessage';
import { downloadDatePlanIcs, isPlanDateTimeValid } from '../../utils/planCalendar';

interface MergedPlanModalProps {
  plan: DatePlan;
  celebrationWord: string;
}

type ImageActionState = 'idle' | 'creating' | 'ready' | 'cancelled' | 'failed';

export function MergedPlanModal({ plan, celebrationWord }: MergedPlanModalProps) {
  const [imageState, setImageState] = useState<ImageActionState>('idle');

  // The note that rides along in the SMS / calendar entry. Fixed now that the editable
  // "sweet note" field is gone — kept so those still carry a line.
  const customMessage = 'Counting down the minutes until our date! 🥰';

  // Format readable date without UTC timezone shift
  const formattedDate = plan.date
    ? (() => {
        const parts = plan.date.split('-').map(Number);
        if (parts.length === 3) {
          const [y, m, d] = parts;
          return new Date(y, m - 1, d).toLocaleDateString('en-US', {
            weekday: 'short',
            month: 'short',
            day: 'numeric',
            year: 'numeric'
          });
        }
        return plan.date;
      })()
    : 'Date TBA';

  const mapsQuery =
    plan.mapsLink ||
    (plan.restaurant
      ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(plan.restaurant)}`
      : '');

  const handleCreateAndShareImage = async () => {
    setImageState('creating');
    try {
      const file = await createPlanImageFile(plan, { celebrationWord, formattedDate });
      const result: ShareImageResult = await shareOrDownloadPlanImage(file, {
        title: 'Our Date Plan',
        text: `${plan.activity} · ${formattedDate} · ${plan.time}`
      });
      setImageState(result === 'shared' || result === 'downloaded' ? 'ready' : result);
    } catch {
      setImageState('failed');
    } finally {
      setTimeout(() => setImageState('idle'), 2600);
    }
  };

  const handleSendByMessage = () => {
    openSmsComposer(plan, { heading: "It's official — our date is set!", message: customMessage, formattedDate });
  };

  const canSaveToCalendar = isPlanDateTimeValid(plan);
  const handleSaveToCalendar = () => {
    if (!canSaveToCalendar) return;
    downloadDatePlanIcs(plan, { message: customMessage });
  };

  return (
    <div className="w-full max-w-lg mx-auto animate-big-heart-pop relative z-50 flex flex-col items-center max-h-[92vh] sm:max-h-[88vh]">
      {/* Big Heart Glass Container with inner scroll and sleek borders */}
      <div className="w-full bg-neutral-950/95 border border-[#FF2E7E]/70 rounded-3xl p-4 sm:p-6 shadow-[0_0_70px_rgba(255,46,126,0.6)] backdrop-blur-2xl text-white relative flex flex-col overflow-hidden max-h-full">
        {/* Subtle Ambient Heart Glow */}
        <div className="absolute -top-16 -right-16 w-36 h-36 bg-[#FF2E7E]/25 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-16 -left-16 w-36 h-36 bg-[#FF80BF]/20 rounded-full blur-3xl pointer-events-none" />

        {/* Compact Header */}
        <div className="flex items-center gap-3 pb-3 border-b border-white/10 shrink-0">
          <div className="relative shrink-0">
            <Heart className="w-10 h-10 sm:w-12 sm:h-12 fill-[#FF2E7E] text-[#FF2E7E] drop-shadow-[0_0_20px_rgba(255,46,126,0.8)] animate-pulse" />
            <Sparkles className="w-4 h-4 text-white absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
          </div>
          <div>
            <h2 className="text-lg sm:text-xl font-black uppercase tracking-tight text-white font-sans">
              Our Date is Set!
            </h2>
            <p className="text-xs text-[#FF80BF] font-medium">
              All 3 pieces united into our perfect date plan ✨
            </p>
          </div>
        </div>

        {/* Scrollable Content Body */}
        <div className="overflow-y-auto py-3 space-y-3.5 pr-1 text-xs sm:text-sm">
          {/* The 3 Selected Components Summary Card */}
          <div className="space-y-2.5 bg-white/5 border border-white/10 rounded-2xl p-3 sm:p-4 text-xs">
            {/* 1. Activity */}
            <div className="flex items-start gap-2.5 pb-2.5 border-b border-white/10">
              <div className="p-1.5 rounded-lg bg-[#FF2E7E]/20 text-[#FF80BF] shrink-0 mt-0.5">
                <Film className="w-3.5 h-3.5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[10px] font-bold uppercase tracking-wider text-white/50">
                  Activity
                </div>
                <div className="font-bold text-white text-xs sm:text-sm mt-0.5 truncate">
                  {plan.activity}
                </div>
              </div>
            </div>

            {/* 2. Date & Time */}
            <div className="flex items-start gap-2.5 pb-2.5 border-b border-white/10">
              <div className="p-1.5 rounded-lg bg-[#FF2E7E]/20 text-[#FF80BF] shrink-0 mt-0.5">
                <Calendar className="w-3.5 h-3.5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[10px] font-bold uppercase tracking-wider text-white/50">
                  When We Meet
                </div>
                <div className="font-bold text-white text-xs sm:text-sm mt-0.5 flex flex-wrap items-center gap-1.5">
                  <span>{formattedDate}</span>
                  <span className="text-[#FF80BF] flex items-center gap-1 font-semibold text-[11px] px-2 py-0.5 rounded-full bg-white/10">
                    <Clock className="w-3 h-3" />
                    {plan.time}
                  </span>
                </div>
              </div>
            </div>

            {/* 3. Restaurant & Google Maps Link */}
            <div className="flex items-start gap-2.5">
              <div className="p-1.5 rounded-lg bg-[#FF2E7E]/20 text-[#FF80BF] shrink-0 mt-0.5">
                <MapPin className="w-3.5 h-3.5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-1 flex-wrap">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-white/50">
                    Romantic Dinner
                  </span>
                  {mapsQuery && (
                    <a
                      href={mapsQuery}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-[10px] text-[#FF80BF] hover:text-white transition-colors underline"
                    >
                      <Compass className="w-3 h-3 text-[#FF2E7E]" />
                      <span>Google Maps Location</span>
                      <ExternalLink className="w-2.5 h-2.5" />
                    </a>
                  )}
                </div>
                <div className="font-bold text-white text-xs sm:text-sm mt-0.5">
                  {plan.restaurant}
                </div>
                {plan.restaurantImageUrl && (
                  <img
                    src={plan.restaurantImageUrl}
                    alt={plan.restaurant}
                    referrerPolicy="no-referrer"
                    className="mt-2 w-full aspect-square object-cover rounded-xl"
                  />
                )}
              </div>
            </div>
          </div>

          {/* Final-plan actions — image/SMS/calendar all read the same plan; none touch a server. */}
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              id="btn-create-share-image"
              onClick={handleCreateAndShareImage}
              disabled={imageState === 'creating'}
              className="flex flex-col items-center gap-1 py-2.5 px-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white/80 hover:text-white transition-colors cursor-pointer disabled:opacity-60"
            >
              {imageState === 'creating' ? (
                <Loader2 className="w-4 h-4 animate-spin text-[#FF80BF]" />
              ) : imageState === 'ready' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              ) : imageState === 'failed' ? (
                <XCircle className="w-4 h-4 text-red-400" />
              ) : imageState === 'cancelled' ? (
                <ImageIcon className="w-4 h-4 text-white/40" />
              ) : (
                <ImageIcon className="w-4 h-4 text-[#FF80BF]" />
              )}
              <span className="text-[10px] font-bold uppercase tracking-wide text-center leading-tight">
                {imageState === 'creating'
                  ? 'Creating…'
                  : imageState === 'ready'
                  ? 'Ready ✓'
                  : imageState === 'failed'
                  ? 'Failed'
                  : imageState === 'cancelled'
                  ? 'Cancelled'
                  : 'Share Image'}
              </span>
            </button>

            <button
              type="button"
              id="btn-send-by-message"
              onClick={handleSendByMessage}
              className="flex flex-col items-center gap-1 py-2.5 px-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white/80 hover:text-white transition-colors cursor-pointer"
            >
              <MessageSquare className="w-4 h-4 text-[#FF80BF]" />
              <span className="text-[10px] font-bold uppercase tracking-wide text-center leading-tight">
                Send by Message
              </span>
            </button>

            <button
              type="button"
              id="btn-save-to-calendar"
              onClick={handleSaveToCalendar}
              disabled={!canSaveToCalendar}
              title={canSaveToCalendar ? 'Download a calendar file for this plan' : 'Set a future date & time first'}
              className="flex flex-col items-center gap-1 py-2.5 px-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white/80 hover:text-white transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <CalendarPlus className="w-4 h-4 text-[#FF80BF]" />
              <span className="text-[10px] font-bold uppercase tracking-wide text-center leading-tight">
                Save to Calendar
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
