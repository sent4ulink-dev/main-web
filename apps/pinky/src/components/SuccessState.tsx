import React, { useEffect, useState } from 'react';
import { Invitation, RSVPResponse } from '../types';
import { generateGoogleCalendarUrl, downloadICalendarFile } from '../utils/calendar';
import { CountdownTimer } from './CountdownTimer';
import { 
  Calendar, 
  Download, 
  Heart, 
  Send, 
  RotateCcw, 
  MapPin, 
  CheckCircle2, 
  ExternalLink,
  Sparkles,
  MessageSquare
} from 'lucide-react';
import confetti from 'canvas-confetti';

interface SuccessStateProps {
  invitation: Invitation;
  response: RSVPResponse;
  onUpdateNote: (note: string, rescheduleSuggestion?: string) => void;
  onResetRSVP: () => void;
  onViewAnalytics: () => void;
}

export const SuccessState: React.FC<SuccessStateProps> = ({
  invitation,
  response,
  onUpdateNote,
  onResetRSVP,
  onViewAnalytics,
}) => {
  const [noteText, setNoteText] = useState(response.note || '');
  const [rescheduleText, setRescheduleText] = useState(response.rescheduleSuggestion || '');
  const [hasSavedNote, setHasSavedNote] = useState(false);
  const [calSynced, setCalSynced] = useState(response.syncedToCalendar || false);

  const isYes = response.status === 'yes';

  useEffect(() => {
    if (isYes) {
      // Fire festive celebration confetti with bold palette
      confetti({
        particleCount: 75,
        spread: 80,
        origin: { y: 0.6 },
        colors: ['#F27D26', '#FFA666', '#ffffff', '#e5e5e5', '#333333']
      });
      const timeout = setTimeout(() => {
        confetti({
          particleCount: 40,
          angle: 60,
          spread: 55,
          origin: { x: 0 },
          colors: ['#F27D26', '#ffffff', '#FFA666']
        });
        confetti({
          particleCount: 40,
          angle: 120,
          spread: 55,
          origin: { x: 1 },
          colors: ['#F27D26', '#ffffff', '#FFA666']
        });
      }, 350);
      return () => clearTimeout(timeout);
    }
  }, [isYes]);

  const handleGoogleCalendarSync = () => {
    setCalSynced(true);
    const gCalUrl = generateGoogleCalendarUrl(invitation);
    window.open(gCalUrl, '_blank');
  };

  const handleDownloadIcs = () => {
    setCalSynced(true);
    downloadICalendarFile(invitation);
  };

  const handleSaveNote = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateNote(noteText, rescheduleText);
    setHasSavedNote(true);
    setTimeout(() => setHasSavedNote(false), 2500);
  };

  const formattedDate = new Date(invitation.date).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  });

  return (
    <div id="rsvp-success-view" className="w-full max-w-md mx-auto p-6 md:p-8 bg-[#0a0a0a] border-2 border-white/15 backdrop-blur-2xl rounded-2xl text-white shadow-2xl space-y-6 animate-in fade-in zoom-in-95 duration-300">
      {/* Header Status */}
      <div className="text-center space-y-2">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-xl bg-[#F27D26]/10 border border-[#F27D26]/30 text-[#F27D26] mb-2">
          {isYes ? (
            <Heart className="w-8 h-8 fill-[#F27D26] text-[#F27D26] animate-pulse" />
          ) : (
            <Sparkles className="w-8 h-8 text-white/60" />
          )}
        </div>
        <h2 className="text-3xl md:text-4xl font-serif-display font-bold text-white tracking-tight">
          {isYes ? "It's a Date." : "Response Recorded."}
        </h2>
        <p className="text-white/60 text-xs md:text-sm font-editorial-body">
          {isYes
            ? `You and ${invitation.hostName} are locked in for ${invitation.title}.`
            : `We let ${invitation.hostName} know you won't be able to make it this time.`}
        </p>
      </div>

      {/* Date Recap Card */}
      <div className="p-4 rounded-xl bg-white/[0.04] border border-white/10 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-[10px] uppercase tracking-widest text-[#F27D26] font-bold">
            {invitation.title}
          </span>
          <span className="text-xs font-mono text-white/60">{formattedDate}</span>
        </div>

        <div className="flex items-center gap-2 text-xs text-white/80">
          <MapPin className="w-3.5 h-3.5 text-[#F27D26] shrink-0" />
          <span className="truncate uppercase text-[11px] tracking-wide">{invitation.location}</span>
        </div>

        {isYes && (
          <div className="pt-2 border-t border-white/10 flex items-center justify-between">
            <span className="text-xs text-white/60">Countdown to date:</span>
            <CountdownTimer targetDate={invitation.date} />
          </div>
        )}
      </div>

      {/* Calendar Synchronization Actions (For YES RSVPs) */}
      {isYes && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-white/80 flex items-center gap-1.5">
              <Calendar className="w-4 h-4 text-[#F27D26]" />
              Calendar Sync
            </span>
            {calSynced && (
              <span className="inline-flex items-center gap-1 text-[11px] text-green-400 font-semibold uppercase tracking-wider">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Synced!
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {/* Direct Google Calendar Web Sync Button */}
            <button
              id="btn-sync-google-calendar"
              onClick={handleGoogleCalendarSync}
              className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-[#F27D26] hover:bg-[#ff8a34] text-black font-bold text-xs uppercase tracking-wider transition-all shadow-md shadow-[#F27D26]/20 cursor-pointer"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Google Calendar</span>
            </button>

            {/* Apple / Outlook .ics Export */}
            <button
              id="btn-download-ics"
              onClick={handleDownloadIcs}
              className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-white/10 hover:bg-white/20 text-white font-semibold text-xs uppercase tracking-wider transition-all cursor-pointer border border-white/15"
            >
              <Download className="w-3.5 h-3.5 text-white/70" />
              <span>Export (.ics)</span>
            </button>
          </div>
        </div>
      )}

      {/* Note / Reschedule suggestion Form */}
      <form onSubmit={handleSaveNote} className="space-y-3 pt-1">
        <div className="flex items-center justify-between">
          <label htmlFor="input-guest-note" className="text-xs font-semibold uppercase tracking-wider text-white/80 flex items-center gap-1.5">
            <MessageSquare className="w-3.5 h-3.5 text-[#F27D26]" />
            <span>{isYes ? `Note for ${invitation.hostName}` : `Propose alternate date`}</span>
          </label>
        </div>

        <div className="relative">
          <textarea
            id="input-guest-note"
            rows={2}
            value={isYes ? noteText : rescheduleText}
            onChange={(e) => (isYes ? setNoteText(e.target.value) : setRescheduleText(e.target.value))}
            placeholder={
              isYes
                ? "e.g. Can't wait! I'll bring the wine..."
                : "e.g. Can't do Thursday, but how about Saturday brunch?"
            }
            className="w-full p-3 rounded-xl bg-white/[0.04] border border-white/15 focus:border-[#F27D26] text-xs text-white placeholder:text-white/30 outline-none resize-none transition-all font-editorial-body"
          />
        </div>

        <div className="flex items-center justify-between">
          <button
            type="submit"
            id="btn-submit-note"
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs uppercase tracking-wider font-semibold transition-colors border border-white/10"
          >
            <Send className="w-3 h-3 text-[#F27D26]" />
            <span>{hasSavedNote ? 'Saved!' : 'Send Note'}</span>
          </button>
        </div>
      </form>

      {/* Navigation Footer */}
      <div className="flex items-center justify-between pt-4 border-t border-white/10 text-xs">
        <button
          id="btn-re-swipe"
          onClick={onResetRSVP}
          className="flex items-center gap-1.5 text-white/60 hover:text-white uppercase tracking-wider font-semibold transition-colors"
        >
          <RotateCcw className="w-3.5 h-3.5 text-[#F27D26]" />
          <span>Change RSVP</span>
        </button>

        <button
          id="btn-view-analytics"
          onClick={onViewAnalytics}
          className="text-[#F27D26] hover:underline uppercase tracking-wider font-semibold transition-colors"
        >
          RSVP Analytics →
        </button>
      </div>
    </div>
  );
};
