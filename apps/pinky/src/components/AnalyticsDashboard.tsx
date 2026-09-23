import React, { useState } from 'react';
import { Invitation } from '../types';
import { calculateAnalytics, encodeInviteToShareUrl } from '../utils/storage';
import { generateGoogleCalendarUrl, downloadICalendarFile } from '../utils/calendar';
import { 
  Heart, 
  X, 
  Clock, 
  Share2, 
  Copy, 
  Check, 
  Calendar, 
  Download, 
  ExternalLink,
  MessageSquare, 
  Eye, 
  Users,
  Activity,
  Plus
} from 'lucide-react';

interface AnalyticsDashboardProps {
  invitation: Invitation;
  onOpenInviteCard: () => void;
  onCreateNewInvite: () => void;
  onSelectOtherInvite?: (inviteId: string) => void;
  allInvitations?: Invitation[];
}

export const AnalyticsDashboard: React.FC<AnalyticsDashboardProps> = ({
  invitation,
  onOpenInviteCard,
  onCreateNewInvite,
  onSelectOtherInvite,
  allInvitations = []
}) => {
  const [copiedLink, setCopiedLink] = useState(false);
  const analytics = calculateAnalytics(invitation);

  const shareUrl = encodeInviteToShareUrl(invitation);

  const handleCopyLink = () => {
    navigator.clipboard.writeText(shareUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleSyncHostCalendar = () => {
    const url = generateGoogleCalendarUrl(invitation);
    window.open(url, '_blank');
  };

  return (
    <div id="analytics-dashboard" className="w-full max-w-5xl mx-auto space-y-6 animate-in fade-in duration-300 select-none">
      {/* Top Header & Invite Selector */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-white/10">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] font-bold uppercase tracking-[0.25em] text-[#F27D26]">
              Analytics Hub
            </span>
            <span className="text-white/20">•</span>
            <span className="text-[11px] text-white/50 uppercase tracking-wider">{invitation.vibe} Experience</span>
          </div>
          <h2 className="text-3xl font-serif-display font-bold text-white tracking-tight">
            {invitation.title}
          </h2>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          {allInvitations.length > 1 && onSelectOtherInvite && (
            <select
              id="select-active-invitation"
              value={invitation.id}
              onChange={(e) => onSelectOtherInvite(e.target.value)}
              className="bg-black border border-white/15 text-white text-xs uppercase tracking-wider rounded-lg px-3 py-2 outline-none focus:border-[#F27D26]"
            >
              {allInvitations.map((inv) => (
                <option key={inv.id} value={inv.id}>
                  {inv.title}
                </option>
              ))}
            </select>
          )}

          <button
            id="btn-create-new-date"
            onClick={onCreateNewInvite}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs uppercase tracking-wider font-semibold transition-colors border border-white/10"
          >
            <Plus className="w-3.5 h-3.5 text-[#F27D26]" />
            <span>New Date</span>
          </button>

          <button
            id="btn-open-gesture-preview"
            onClick={onOpenInviteCard}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#F27D26] hover:bg-[#ff8a34] text-black text-xs uppercase tracking-wider font-bold shadow-md shadow-[#F27D26]/20 transition-all"
          >
            <Heart className="w-3.5 h-3.5 fill-black" />
            <span>Gesture Card</span>
          </button>
        </div>
      </div>

      {/* Primary KPI Metric Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        {/* Acceptance Rate */}
        <div className="p-5 rounded-2xl bg-[#0a0a0a] border-2 border-white/15 backdrop-blur-md">
          <div className="flex items-center justify-between text-white/50 text-[11px] uppercase tracking-wider font-semibold mb-2">
            <span>Acceptance</span>
            <Heart className="w-4 h-4 text-[#F27D26]" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-4xl font-display font-black text-white">
              {analytics.acceptanceRate}%
            </span>
          </div>
          <p className="text-[10px] uppercase tracking-wider text-white/40 mt-1">
            {analytics.yesCount} of {analytics.totalResponses} respondents
          </p>
        </div>

        {/* Total Views */}
        <div className="p-5 rounded-2xl bg-[#0a0a0a] border-2 border-white/15 backdrop-blur-md">
          <div className="flex items-center justify-between text-white/50 text-[11px] uppercase tracking-wider font-semibold mb-2">
            <span>Total Views</span>
            <Eye className="w-4 h-4 text-white/60" />
          </div>
          <span className="text-4xl font-display font-black text-white">
            {analytics.totalViews}
          </span>
          <p className="text-[10px] uppercase tracking-wider text-white/40 mt-1">
            {analytics.totalResponses > 0
              ? `${Math.round((analytics.totalResponses / analytics.totalViews) * 100)}% engagement`
              : 'Waiting for views'}
          </p>
        </div>

        {/* Responses Breakdown */}
        <div className="p-5 rounded-2xl bg-[#0a0a0a] border-2 border-white/15 backdrop-blur-md">
          <div className="flex items-center justify-between text-white/50 text-[11px] uppercase tracking-wider font-semibold mb-2">
            <span>Total RSVPs</span>
            <Users className="w-4 h-4 text-[#F27D26]" />
          </div>
          <span className="text-4xl font-display font-black text-white">
            {analytics.totalResponses}
          </span>
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-white/50 mt-1">
            <span className="text-green-400 font-semibold">{analytics.yesCount} Yes</span>
            <span>•</span>
            <span className="text-white/40">{analytics.noCount} No</span>
            {analytics.rescheduleCount > 0 && (
              <>
                <span>•</span>
                <span className="text-[#F27D26]">{analytics.rescheduleCount} Resched</span>
              </>
            )}
          </div>
        </div>

        {/* Calendar Sync Ready */}
        <div className="p-5 rounded-2xl bg-[#0a0a0a] border-2 border-white/15 backdrop-blur-md">
          <div className="flex items-center justify-between text-white/50 text-[11px] uppercase tracking-wider font-semibold mb-2">
            <span>Google Sync</span>
            <Calendar className="w-4 h-4 text-[#F27D26]" />
          </div>
          <button
            id="btn-sync-host-google-calendar"
            onClick={handleSyncHostCalendar}
            className="text-xs font-bold uppercase tracking-wider text-[#F27D26] hover:underline flex items-center gap-1.5 mt-1"
          >
            <span>Sync Host Event</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </button>
          <p className="text-[10px] uppercase tracking-wider text-white/40 mt-2">
            1-click sync link ready for guests
          </p>
        </div>
      </div>

      {/* Shareable Link Strip */}
      <div className="p-4 rounded-2xl bg-[#0a0a0a] border-2 border-white/15 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-[#F27D26]/10 border border-[#F27D26]/30 flex items-center justify-center text-[#F27D26] shrink-0">
            <Share2 className="w-4 h-4" />
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-white">Shareable Gesture Invite Link</p>
            <p className="text-xs text-white/50 font-editorial-body">
              Send to your date. They can swipe right to accept without logging in.
            </p>
          </div>
        </div>

        <button
          id="btn-copy-invite-link"
          onClick={handleCopyLink}
          className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs uppercase tracking-wider font-semibold transition-colors shrink-0 border border-white/15"
        >
          {copiedLink ? (
            <>
              <Check className="w-3.5 h-3.5 text-green-400" />
              <span className="text-green-400">Link Copied!</span>
            </>
          ) : (
            <>
              <Copy className="w-3.5 h-3.5 text-white/60" />
              <span>Copy Invite URL</span>
            </>
          )}
        </button>
      </div>

      {/* Two-Column Analytics Layout: Responses Feed & Preference Distribution */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Guest Responses & Notes Feed */}
        <div className="p-6 rounded-2xl bg-[#0a0a0a] border-2 border-white/15 backdrop-blur-md space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-white/10">
            <div className="flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-[#F27D26]" />
              <span className="text-[10px] font-bold uppercase tracking-[0.25em] text-white/70">
                Responses & Notes
              </span>
            </div>
            <span className="text-xs font-mono text-white/40">
              {invitation.responses?.length || 0} Total
            </span>
          </div>

          <div className="space-y-3 max-h-[340px] overflow-y-auto pr-1 no-scrollbar">
            {invitation.responses && invitation.responses.length > 0 ? (
              invitation.responses.map((resp) => (
                <div
                  key={resp.id}
                  className="p-4 rounded-xl bg-white/[0.03] border border-white/10 space-y-2 text-xs"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold uppercase tracking-wider text-white text-[11px]">{resp.responderName}</span>
                    <span
                      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider ${
                        resp.status === 'yes'
                          ? 'bg-green-950/80 text-green-400 border border-green-800/40'
                          : resp.status === 'reschedule'
                          ? 'bg-[#F27D26]/20 text-[#F27D26] border border-[#F27D26]/40'
                          : 'bg-white/10 text-white/50 border border-white/10'
                      }`}
                    >
                      {resp.status === 'yes' ? (
                        <>
                          <Heart className="w-2.5 h-2.5 fill-green-400" />
                          <span>Accepted</span>
                        </>
                      ) : resp.status === 'reschedule' ? (
                        <>
                          <Clock className="w-2.5 h-2.5 text-[#F27D26]" />
                          <span>Reschedule</span>
                        </>
                      ) : (
                        <>
                          <X className="w-2.5 h-2.5 text-white/50" />
                          <span>Declined</span>
                        </>
                      )}
                    </span>
                  </div>

                  {resp.note && (
                    <p className="text-white/90 font-serif-italic text-sm pl-2.5 border-l-2 border-[#F27D26]">
                      "{resp.note}"
                    </p>
                  )}

                  {resp.rescheduleSuggestion && (
                    <p className="text-[#F27D26] text-[11px] bg-[#F27D26]/10 p-2.5 rounded-lg border border-[#F27D26]/25 font-medium">
                      💡 Suggestion: {resp.rescheduleSuggestion}
                    </p>
                  )}

                  {resp.selectedPreferences && Object.keys(resp.selectedPreferences).length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {Object.entries(resp.selectedPreferences).map(([k, v]) => (
                        <span
                          key={k}
                          className="px-2 py-0.5 rounded bg-white/5 text-white/60 text-[10px] uppercase tracking-wider border border-white/10"
                        >
                          {v}
                        </span>
                      ))}
                    </div>
                  )}

                  <div className="flex items-center justify-between text-[10px] text-white/40 pt-1">
                    <span>
                      {new Date(resp.timestamp).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        hour: 'numeric',
                        minute: '2-digit'
                      })}
                    </span>
                    {resp.syncedToCalendar && (
                      <span className="text-green-400 flex items-center gap-1 font-semibold uppercase tracking-wider text-[9px]">
                        <Check className="w-3 h-3" />
                        Added to Calendar
                      </span>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <div className="py-8 text-center text-white/40 text-xs uppercase tracking-wider">
                No RSVP responses yet. Share the invite link to start gathering RSVPs!
              </div>
            )}
          </div>
        </div>

        {/* Preference Breakdown & Calendar Options */}
        <div className="space-y-4">
          {/* Preferences Stats */}
          <div className="p-6 rounded-2xl bg-[#0a0a0a] border-2 border-white/15 backdrop-blur-md space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-white/10">
              <Activity className="w-4 h-4 text-[#F27D26]" />
              <span className="text-[10px] font-bold uppercase tracking-[0.25em] text-white/70">
                Preferences & Choices
              </span>
            </div>

            {Object.keys(analytics.preferenceBreakdown).length > 0 ? (
              <div className="space-y-4">
                {Object.entries(analytics.preferenceBreakdown).map(([question, optionCounts]) => (
                  <div key={question} className="space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-wide text-white/90">{question}</p>
                    <div className="space-y-1.5">
                      {Object.entries(optionCounts).map(([opt, count]) => {
                        const totalForQ = Object.values(optionCounts).reduce((a, b) => a + b, 0);
                        const pct = totalForQ > 0 ? Math.round((count / totalForQ) * 100) : 0;
                        return (
                          <div key={opt} className="space-y-1">
                            <div className="flex items-center justify-between text-[11px] text-white/60 uppercase tracking-wide">
                              <span>{opt}</span>
                              <span className="font-mono text-white">
                                {count} ({pct}%)
                              </span>
                            </div>
                            <div className="w-full h-1.5 rounded-full bg-white/10 overflow-hidden">
                              <div
                                className="h-full rounded-full bg-[#F27D26] transition-all"
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-white/40 text-xs py-4 text-center uppercase tracking-wider">
                No preference questions configured for this date.
              </p>
            )}
          </div>

          {/* Calendar Management Hub for Host */}
          <div className="p-6 rounded-2xl bg-[#0a0a0a] border-2 border-white/15 backdrop-blur-md space-y-3">
            <div className="flex items-center gap-2 pb-1">
              <Calendar className="w-4 h-4 text-[#F27D26]" />
              <span className="text-[10px] font-bold uppercase tracking-[0.25em] text-white/70">
                Host Calendar Sync
              </span>
            </div>
            <p className="text-xs text-white/60 font-editorial-body">
              Synchronize this event to your personal Google Calendar or export universal .ics for Apple/Outlook:
            </p>
            <div className="grid grid-cols-2 gap-2.5 pt-1">
              <button
                id="btn-host-open-gcal"
                onClick={() => window.open(generateGoogleCalendarUrl(invitation), '_blank')}
                className="flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg bg-[#F27D26] hover:bg-[#ff8a34] text-black text-xs uppercase tracking-wider font-bold transition-colors"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>Google Calendar</span>
              </button>

              <button
                id="btn-host-download-ics"
                onClick={() => downloadICalendarFile(invitation)}
                className="flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs uppercase tracking-wider font-semibold transition-colors border border-white/15"
              >
                <Download className="w-3.5 h-3.5 text-white/60" />
                <span>Export .ics</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
