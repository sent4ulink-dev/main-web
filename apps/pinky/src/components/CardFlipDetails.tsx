import React from 'react';
import { Invitation } from '../types';
import { 
  MapPin, 
  Sparkles, 
  Shirt, 
  Music, 
  Clock, 
  Compass, 
  RotateCcw,
  Check
} from 'lucide-react';

interface CardFlipDetailsProps {
  invitation: Invitation;
  selectedPreferences: Record<string, string>;
  onSelectPreference: (questionId: string, option: string) => void;
  onFlipBack: () => void;
}

export const CardFlipDetails: React.FC<CardFlipDetailsProps> = ({
  invitation,
  selectedPreferences,
  onSelectPreference,
  onFlipBack,
}) => {
  const openMaps = (e: React.MouseEvent) => {
    e.stopPropagation();
    const query = encodeURIComponent(`${invitation.location}`);
    window.open(`https://www.google.com/maps/search/?api=1&query=${query}`, '_blank');
  };

  return (
    <div 
      id="card-flip-details-container" 
      className="w-full h-full p-6 flex flex-col justify-between overflow-y-auto bg-[#0a0a0a] text-white backdrop-blur-xl border-2 border-white/15 rounded-2xl"
    >
      {/* Top Bar */}
      <div className="flex items-center justify-between pb-4 border-b border-white/10">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-[#F27D26]" />
          <span className="text-[10px] font-bold uppercase tracking-[0.25em] text-white/70">
            Itinerary & Experience
          </span>
        </div>
        <button
          id="btn-flip-back"
          onClick={(e) => {
            e.stopPropagation();
            onFlipBack();
          }}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white text-[11px] uppercase tracking-wider font-semibold transition-colors border border-white/10"
          title="Flip back to invitation"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>Card</span>
        </button>
      </div>

      {/* Main Content Scroll Area */}
      <div className="space-y-5 my-3 flex-1 overflow-y-auto pr-1 no-scrollbar">
        {/* Host Note */}
        <div className="p-4 rounded-xl bg-white/[0.04] border border-white/10">
          <p className="text-[10px] font-bold uppercase tracking-wider text-[#F27D26] mb-1.5">Note from {invitation.hostName}:</p>
          <p className="text-base font-serif-italic text-white/90 leading-relaxed">
            "{invitation.description}"
          </p>
        </div>

        {/* Location & Map Action */}
        <div className="space-y-2">
          <div className="flex items-start gap-2.5">
            <MapPin className="w-4 h-4 text-[#F27D26] shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-white">{invitation.location}</p>
              {invitation.locationDetails && (
                <p className="text-xs text-white/60 mt-0.5">{invitation.locationDetails}</p>
              )}
            </div>
          </div>
          <button
            id="btn-open-google-maps"
            onClick={openMaps}
            className="w-full flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg bg-white/10 hover:bg-white/20 border border-white/15 text-white text-xs uppercase tracking-wider font-semibold transition-colors"
          >
            <Compass className="w-3.5 h-3.5 text-[#F27D26]" />
            <span>Open in Google Maps</span>
          </button>
        </div>

        {/* Dress Code & Vibe */}
        <div className="grid grid-cols-2 gap-2 text-xs">
          {invitation.dressCode && (
            <div className="p-3 rounded-lg bg-white/[0.04] border border-white/10">
              <div className="flex items-center gap-1.5 text-white/50 mb-1">
                <Shirt className="w-3.5 h-3.5 text-[#F27D26]" />
                <span className="font-bold text-[10px] uppercase tracking-wider">Dress Code</span>
              </div>
              <p className="text-white font-medium text-xs uppercase tracking-tight">{invitation.dressCode}</p>
            </div>
          )}
          <div className="p-3 rounded-lg bg-white/[0.04] border border-white/10">
            <div className="flex items-center gap-1.5 text-white/50 mb-1">
              <Music className="w-3.5 h-3.5 text-[#F27D26]" />
              <span className="font-bold text-[10px] uppercase tracking-wider">Vibe</span>
            </div>
            <p className="text-white font-medium text-xs uppercase tracking-tight">{invitation.vibe} Energy</p>
          </div>
        </div>

        {/* Timeline Itinerary */}
        {invitation.itinerary && invitation.itinerary.length > 0 && (
          <div className="space-y-2.5">
            <div className="flex items-center gap-1.5 text-white/50">
              <Clock className="w-3.5 h-3.5 text-[#F27D26]" />
              <span className="text-[10px] font-bold uppercase tracking-[0.25em] text-white/70">
                Timeline Plan
              </span>
            </div>
            <div className="space-y-2 relative pl-3 before:absolute before:left-1 before:top-2 before:bottom-2 before:w-[1px] before:bg-white/15">
              {invitation.itinerary.map((item, idx) => (
                <div key={idx} className="relative pl-3 text-xs">
                  <div className="absolute -left-[14px] top-1.5 w-2 h-2 rounded-full bg-[#F27D26] ring-4 ring-[#0a0a0a]" />
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="font-semibold text-white uppercase text-[11px] tracking-wide">{item.activity}</span>
                    <span className="text-[11px] text-[#F27D26] font-mono shrink-0">{item.time}</span>
                  </div>
                  {item.detail && (
                    <p className="text-white/60 text-[11px] mt-0.5">{item.detail}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Preference Questions */}
        {invitation.questions && invitation.questions.length > 0 && (
          <div className="space-y-3 pt-2 border-t border-white/10">
            <span className="text-[10px] font-bold uppercase tracking-[0.25em] text-white/70">
              Preferences
            </span>
            {invitation.questions.map((q) => (
              <div key={q.id} className="space-y-1.5">
                <p className="text-xs text-white/80 font-medium">{q.question}</p>
                <div className="grid grid-cols-2 gap-1.5">
                  {q.options.map((opt) => {
                    const isSelected = selectedPreferences[q.id] === opt;
                    return (
                      <button
                        key={opt}
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectPreference(q.id, opt);
                        }}
                        className={`p-2.5 rounded-lg text-left text-xs transition-all flex items-center justify-between border ${
                          isSelected
                            ? 'bg-[#F27D26]/20 border-[#F27D26] text-white font-semibold'
                            : 'bg-white/5 border-white/10 text-white/60 hover:text-white hover:bg-white/10'
                        }`}
                      >
                        <span className="truncate pr-1 text-[11px] uppercase tracking-wide">{opt}</span>
                        {isSelected && <Check className="w-3.5 h-3.5 text-[#F27D26] shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Bottom Action */}
      <button
        id="btn-return-to-swipe"
        onClick={(e) => {
          e.stopPropagation();
          onFlipBack();
        }}
        className="w-full py-3 rounded-xl bg-[#F27D26] hover:bg-[#ff8a34] text-black text-xs font-bold tracking-widest uppercase transition-all shadow-lg shadow-[#F27D26]/25 cursor-pointer"
      >
        Return to Gesture Card
      </button>
    </div>
  );
};
