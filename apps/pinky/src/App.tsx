/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import confetti from 'canvas-confetti';
import { Heart, Pencil } from 'lucide-react';
import { CelebrationSalute } from './components/CelebrationSalute';
import { ScreenCracks } from './components/ScreenCracks';
import { LoveGrowthVisuals } from './components/LoveGrowthVisuals';
import { YesCelebrationOverlay } from './components/YesCelebrationOverlay';
import { ShareErrorScreen } from './components/ShareErrorScreen';
import { MusicControl } from './components/MusicControl';
import { EditableText } from './components/edit/EditableText';
import { EditToolbar } from './components/edit/EditToolbar';
import { useShareSession } from './hooks/useShareSession';
import { useBackgroundMusic } from './hooks/useBackgroundMusic';
import { formatCountdown, useEditWindowCountdown } from './hooks/useEditWindowCountdown';

// The 4 screens the editor toolbar's Prev/Next step through — every piece of owner-
// editable content (see ShareContent in types.ts) lives on exactly one of these, in the
// same place it's shown live. DateTime and the merged plan aren't here: those are the
// VISITOR's own live plan, not something the owner configures ahead of time.
const EDIT_SCREENS = [
  { key: 'question', label: 'Question' },
  { key: 'celebration', label: 'Celebration' },
  { key: 'activity', label: 'Activities' },
  { key: 'restaurant', label: 'Restaurants' }
] as const;
type EditScreenKey = (typeof EDIT_SCREENS)[number]['key'];

export default function App() {
  const session = useShareSession();
  const music = useBackgroundMusic(session.content.musicUrl);
  const msLeft = useEditWindowCountdown(session.editUntil);

  const [selectedChoice, setSelectedChoice] = useState<'yes' | 'no' | null>(null);
  const [noCount, setNoCount] = useState<number>(0);
  const [isShaking, setIsShaking] = useState<boolean>(false);
  const [celebrationScene, setCelebrationScene] = useState<1 | 2 | 3>(1);

  // Inline edit mode: which of the EDIT_SCREENS is showing, and which of the 10 "No"
  // plea texts is showing (only relevant on the 'question' screen). Reset to a clean
  // start every time editing turns on.
  const [editScreenIndex, setEditScreenIndex] = useState(0);
  const [editPleaIndex, setEditPleaIndex] = useState(0);

  useEffect(() => {
    if (session.isEditing) {
      setSelectedChoice(null);
      setNoCount(0);
      setEditScreenIndex(0);
      setEditPleaIndex(0);
    }
  }, [session.isEditing]);

  // Save = commit and drop out to a live preview of the card. NOT finalize — the card
  // stays editable, so the pencil button is right there to jump back in.
  const handleSaveClick = () => {
    (document.activeElement as HTMLElement | null)?.blur?.();
    session.saveNow();
    session.setIsEditing(false);
  };

  const handleFinishEditing = async () => {
    (document.activeElement as HTMLElement | null)?.blur?.();
    session.saveNow();
    if (session.mode === 'real') {
      try {
        await session.finalize();
      } catch {
        // best-effort — if this fails the card just stays editable; nothing destructive happened
      }
    }
    session.setIsEditing(false);
  };

  useEffect(() => {
    if (selectedChoice === 'yes') {
      setCelebrationScene(1);
      // Scene 2 starts after 1 second of emoji explosion
      const t1 = setTimeout(() => {
        setCelebrationScene(2);
      }, 1000);
      // Scene 3 starts after 2 seconds of pure Yes text zoom
      const t2 = setTimeout(() => {
        setCelebrationScene(3);
      }, 3000);
      return () => {
        clearTimeout(t1);
        clearTimeout(t2);
      };
    } else {
      setCelebrationScene(1);
    }
  }, [selectedChoice]);

  const triggerLoveCelebration = () => {
    try {
      // 1. Primary Warm Amber & Rose Heart Salute
      confetti({
        particleCount: 80,
        spread: 110,
        origin: { y: 0.5 },
        colors: ['#F27D26', '#FF2E7E', '#FF6B6B', '#FFD166', '#FFFFFF'],
        ticks: 240,
        gravity: 0.75,
        scalar: 1.25
      });

      // 2. Left and Right romantic side cannons
      setTimeout(() => {
        confetti({
          particleCount: 50,
          angle: 60,
          spread: 75,
          origin: { x: 0.05, y: 0.6 },
          colors: ['#F27D26', '#FF3366', '#FFEAA7']
        });
        confetti({
          particleCount: 50,
          angle: 120,
          spread: 75,
          origin: { x: 0.95, y: 0.6 },
          colors: ['#F27D26', '#FF3366', '#FFEAA7']
        });
      }, 250);

      // 3. Gentle lingering starry burst
      setTimeout(() => {
        confetti({
          particleCount: 60,
          spread: 130,
          origin: { y: 0.35 },
          colors: ['#FF69B4', '#F27D26', '#FFF0F5', '#FFD700'],
          shapes: ['circle'],
          scalar: 1,
          gravity: 0.55
        });
      }, 500);
    } catch {
      // Graceful fallback
    }
  };

  const handleYes = () => {
    setSelectedChoice('yes');
    triggerLoveCelebration();
  };

  const handleNoClick = (e: React.MouseEvent) => {
    e.stopPropagation();

    // Trigger dramatic shake
    setIsShaking(false);
    setTimeout(() => setIsShaking(true), 10);
    setTimeout(() => setIsShaking(false), 550);

    const nextCount = noCount + 1;
    if (nextCount >= 10) {
      // 10th attempt: Yes fully takes over!
      handleYes();
    } else {
      setNoCount(nextCount);
    }
  };

  const handleNoHover = () => {
    if (selectedChoice !== null) return;
    setIsShaking(true);
    setTimeout(() => setIsShaking(false), 450);
  };

  const isYesSelected = selectedChoice === 'yes';

  // The screen the editor toolbar's Prev/Next currently has open, and whether it's one
  // of the 3 screens that live behind the (normally Yes-triggered) celebration overlay —
  // forcing that overlay open here is what lets clicking Next actually show them, without
  // the owner ever needing to tap Yes/pick a heart themselves.
  const editScreen: EditScreenKey | null = session.isEditing ? EDIT_SCREENS[editScreenIndex].key : null;
  const forceCelebration = editScreen !== null && editScreen !== 'question';
  const showQuestionScreen = !isYesSelected && !forceCelebration;
  const showCelebrationOverlay = (isYesSelected && celebrationScene === 3) || forceCelebration;

  // Yes and No stay an even 50/50 split the whole time now — refusals no longer
  // shrink No away and inflate Yes. The escalation moved to the question bubble
  // itself (see questionScale below) instead of the buttons.
  const noFlex = isYesSelected ? 0 : 1;
  const yesFlex = 1;

  // Font sizes stay at their resting value too — same reasoning as the flex split above.
  const noFontSizeVmin = 18;
  const yesFontSizeVmin = isYesSelected ? 24 : 18;

  const noPleaTexts = session.content.noPleaTexts;
  const currentPlea = noCount > 0 ? noPleaTexts[Math.min(noCount - 1, noPleaTexts.length - 1)] : null;

  // The question bubble grows a little with every refusal instead — capped so it
  // never overwhelms the screen even at the highest plea stage.
  const questionScale = Math.min(1.35, 1 + noCount * 0.035);

  if (session.notFound) {
    return <ShareErrorScreen message="This link doesn't look right. Double-check the URL you were sent." />;
  }
  if (session.mode === 'real' && session.loading) {
    return (
      <div className="h-[100dvh] w-full bg-black text-white flex items-center justify-center">
        <Heart className="w-8 h-8 fill-[#FF2E7E] text-[#FF2E7E] animate-pulse" />
      </div>
    );
  }
  if (session.mode === 'real' && session.error) {
    return <ShareErrorScreen message={session.error} />;
  }

  return (
    // Outer wrapper is a plain column: the card content area, then (only while editing)
    // the toolbar as a real flex sibling below it. That's what makes the toolbar reserve
    // its own row of layout space rather than floating over the card — the content area
    // gets flex-1 and simply shrinks to fit above it, on every screen size including mobile.
    <div className="h-[100dvh] w-full bg-black text-white flex flex-col overflow-hidden">
    <div
      className={`flex-1 min-h-0 w-full flex flex-col sm:flex-row overflow-hidden relative ${
        session.isEditing ? '' : 'select-none touch-none'
      }`}
    >
      {/* Edit-window countdown — hidden once canEdit goes false (finalized, or the window
          naturally expired): a frozen "3d left" badge after the card is already locked
          would be actively misleading, so it just vanishes instead of showing a stale
          number. Deliberately no copy-link control here — the link is already in the
          address bar for whoever created it. */}
      {!session.isEditing && session.canEdit && (
        <div
          className="fixed top-3 left-3 z-[100] px-3 py-1.5 rounded-full bg-black/70 border border-white/20 backdrop-blur-md text-[11px] font-semibold text-white/70 shadow-lg"
          title="Time left to edit this card before it locks"
        >
          {formatCountdown(msLeft)}
        </div>
      )}

      {/* Top-right: the persistent Edit entry point, whenever the card is still editable. */}
      {!session.isEditing && session.canEdit && (
        <div className="fixed top-3 right-3 z-[100] flex items-center gap-2">
          <button
            type="button"
            id="btn-open-edit"
            onClick={() => session.setIsEditing(true)}
            className="w-9 h-9 rounded-full bg-black/70 hover:bg-black border border-white/20 backdrop-blur-md flex items-center justify-center text-white/70 hover:text-white transition-colors cursor-pointer shadow-lg"
            title="Edit this card"
          >
            <Pencil className="w-4 h-4" />
          </button>
        </div>
      )}
      {/* Wordmark — top and center, same fixed-overlay treatment as the countdown/edit
          controls flanking it (so it never competes with the Yes/No layout underneath). */}
      {!session.isEditing && (
        <div className="fixed top-3 inset-x-0 z-[90] flex justify-center pointer-events-none px-20 sm:px-24">
          <span className="text-white/90 font-semibold tracking-tight text-lg sm:text-xl drop-shadow-[0_0_8px_rgba(255,255,255,0.35)]">
            sent4u
          </span>
        </div>
      )}

      {/* Ambient background glow when YES is dominant or chosen */}
      <div
        className={`absolute inset-0 pointer-events-none transition-opacity duration-700 ease-out ${
          isYesSelected
            ? 'opacity-100'
            : noCount > 0
            ? 'opacity-60'
            : 'opacity-0'
        }`}
        style={{
          background:
            'radial-gradient(ellipse 80% 80% at 50% 50%, rgba(255, 46, 126, 0.3) 0%, rgba(255, 105, 180, 0.18) 45%, rgba(0, 0, 0, 0.95) 85%)'
        }}
      />

      {/* Cute Love Shapes Celebration Salute (Hearts, Teddy Bears, Roses, Sparkles) */}
      {isYesSelected && <CelebrationSalute />}

      {/* Scene 3: Kinetic Typography YES Screen Fill Celebration Overlay — also forced
          open (via editingStep) whenever the editor toolbar has stepped to one of the
          screens that live behind it, so Next/Prev alone is enough to reach them. */}
      {showCelebrationOverlay && (
        <YesCelebrationOverlay
          celebrationWord={session.content.celebrationWord}
          activities={session.content.activities}
          restaurants={session.content.restaurants}
          editingStep={forceCelebration ? (editScreen as 'celebration' | 'activity' | 'restaurant') : undefined}
          onEditCelebrationWord={session.setCelebrationWord}
          onAddActivity={session.addActivity}
          onUpdateActivity={session.updateActivity}
          onRemoveActivity={session.removeActivity}
          onAddRestaurant={session.addRestaurant}
          onUpdateRestaurant={session.updateRestaurant}
          onRemoveRestaurant={session.removeRestaurant}
        />
      )}

      {/* Opening question — a floating overlay (fixed, positioned like the
          countdown/edit controls), styled as a glowing neon speech bubble
          (pink outline, soft outer/inner glow, a small pointed tail, a
          heart accent on the corner) matching the app's pink neon
          aesthetic elsewhere (the Yes text glow, the hearts). Never a solid
          fill, so whatever's underneath — plain black, the pink glow,
          LoveGrowthVisuals' sky — still reads through it. Hidden once Yes
          is chosen: the celebration takeover has its own huge text and the
          question has already been answered. */}
      {showQuestionScreen && (session.content.question || session.isEditing) && (
        <div className="fixed inset-0 z-40 px-6 flex items-center justify-center pointer-events-none">
          {/* Starts big and roughly screen-centered (a translateY/scale
              transform, so it never affects layout) then flies up into its
              compact resting spot. */}
          <motion.div
            initial={{ y: '16vh', scale: 1.15, opacity: 0 }}
            animate={{ y: 0, scale: questionScale, opacity: 1 }}
            transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
            whileHover={{ scale: questionScale * 1.05 }}
            style={{ willChange: 'transform, opacity' }}
            className="pointer-events-auto relative max-w-2xl"
          >
            {/* Bubble body — the outline, fill, and tail used to be two
                separate translucent+blurred divs (a rounded rect plus a
                rotated square for the tail), and stacking two independent
                glass layers is exactly what made the tail read as its own
                little rectangle instead of part of one shape: each div's
                backdrop-blur samples independently, and the tail's own
                unbordered edges created a visible seam against the bubble.
                Drawn as a single SVG path instead — one fill, one stroke,
                one drop-shadow — so the body and tail are genuinely one
                continuous outline with no seam possible. */}
            <div className="relative px-6 pt-3.5 pb-7 sm:px-8 sm:pt-4 sm:pb-8">
              <svg
                className="absolute inset-0 w-full h-full"
                viewBox="0 0 300 100"
                preserveAspectRatio="none"
                aria-hidden="true"
                style={{
                  filter:
                    'drop-shadow(0 0 8px rgba(255,46,126,0.85)) drop-shadow(0 0 24px rgba(255,46,126,0.4))'
                }}
              >
                <path
                  d="M26 3 H274 A23 23 0 0 1 297 26 V51 A23 23 0 0 1 274 74 H50 L36 97 L30 74 H26 A23 23 0 0 1 3 51 V26 A23 23 0 0 1 26 3 Z"
                  fill="rgba(58,0,24,0.45)"
                  stroke="#FF2E7E"
                  strokeWidth="3"
                  vectorEffect="non-scaling-stroke"
                />
              </svg>
              {session.isEditing ? (
                <EditableText
                  tag="p"
                  className="relative font-serif-italic font-light text-base sm:text-xl md:text-2xl text-white tracking-tight leading-snug text-center drop-shadow-[0_0_10px_rgba(255,255,255,0.5)]"
                  value={session.content.question}
                  onCommit={session.setQuestion}
                  ariaLabel="Opening question"
                  placeholder="Will you go on a date with me?"
                />
              ) : (
                <p className="relative font-serif-italic font-light text-base sm:text-xl md:text-2xl text-white tracking-tight leading-snug text-center drop-shadow-[0_0_10px_rgba(255,255,255,0.5)]">
                  {session.content.question}
                </p>
              )}
            </div>
            {/* Neon heart accent, overlapping the top-right corner */}
            <Heart
              className="absolute -top-3 -right-3 w-7 h-7 sm:w-8 sm:h-8 fill-[#FF2E7E] text-[#FF2E7E] rotate-6"
              style={{
                filter:
                  'drop-shadow(0 0 6px rgba(255,46,126,0.95)) drop-shadow(0 0 16px rgba(255,46,126,0.6))'
              }}
            />
          </motion.div>
        </div>
      )}

      {/* YES Button Section (Expands and dominates the screen - Top on Mobile, Left on Desktop/Tablet) */}
      <div
        id="btn-yes"
        role="button"
        tabIndex={0}
        onClick={!isYesSelected && !session.isEditing ? handleYes : undefined}
        onKeyDown={(e) => {
          if (!isYesSelected && !session.isEditing && (e.key === 'Enter' || e.key === ' ')) {
            e.preventDefault();
            handleYes();
          }
        }}
        style={{
          flex: `${yesFlex} 1 0%`,
          transition: 'all 0.5s cubic-bezier(0.16, 1, 0.3, 1)'
        }}
        className={`w-full h-auto sm:h-full flex flex-col items-center justify-center relative outline-none cursor-pointer overflow-hidden p-4 sm:p-6 md:p-8 ${
          isYesSelected
            ? 'bg-[#FF2E7E]/20 shadow-[inset_0_0_120px_rgba(255,46,126,0.3)] z-30'
            : noCount > 0
            ? 'bg-[#FF2E7E]/[0.08] shadow-[inset_0_0_80px_rgba(255,46,126,0.15)]'
            : 'bg-transparent'
        }`}
      >
        {/* Dynamic vector love visuals (butterflies, rising flowers, heart pulse, sun & clouds) */}
        <LoveGrowthVisuals growthStage={noCount} />

        {/* The Real Present Yes Text - Zooms in 700x during Scene 2 to engulf the entire background in vibrant pink */}
        <span
          id="main-yes-text"
          style={{
            fontSize: `clamp(3.5rem, ${yesFontSizeVmin}vmin, 18rem)`,
            lineHeight: 0.9,
            transformOrigin: 'center center',
          }}
          className={`relative z-20 font-serif-italic font-light tracking-tighter text-[#FF2E7E] select-none inline-block transition-transform ${
            isYesSelected && celebrationScene === 2
              ? 'animate-yes-zoom-direct z-40'
              : isYesSelected
              ? 'opacity-100 drop-shadow-[0_0_70px_rgba(255,46,126,0.85)]'
              : noCount > 3
              ? 'opacity-100 drop-shadow-[0_0_50px_rgba(255,46,126,0.65)] animate-pulse'
              : 'opacity-85 hover:opacity-100 drop-shadow-[0_0_30px_rgba(255,46,126,0.45)]'
          }`}
        >
          {session.isEditing && showQuestionScreen ? (
            <EditableText
              tag="span"
              value={session.content.yesLabel}
              onCommit={session.setYesLabel}
              ariaLabel="Yes button label"
              placeholder="Yes"
              className="inline-block"
            />
          ) : (
            session.content.yesLabel
          )}
        </span>

        {/* Sub-label before selection — during editing this becomes a stepper over all
            10 stored plea texts instead of only whichever one the real noCount would
            show, since there's no single "current" one to point at while editing. */}
        {showQuestionScreen &&
          (session.isEditing ? (
            <div className="relative z-20 mt-4 flex items-center gap-1.5 max-w-[92%]">
              <button
                type="button"
                id="btn-plea-prev"
                onClick={(e) => {
                  e.stopPropagation();
                  setEditPleaIndex((i) => Math.max(0, i - 1));
                }}
                disabled={editPleaIndex === 0}
                className="shrink-0 w-6 h-6 rounded-full bg-white/10 hover:bg-white/20 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center text-white text-xs cursor-pointer"
              >
                ‹
              </button>
              <div className="px-4 py-1.5 rounded-full bg-[#FF2E7E]/20 border border-[#FF2E7E]/40 text-white text-[11px] sm:text-xs font-bold text-center leading-tight flex-1 min-w-0">
                <EditableText
                  tag="span"
                  value={noPleaTexts[editPleaIndex] ?? ''}
                  onCommit={(v) => session.setNoPleaText(editPleaIndex, v)}
                  ariaLabel={`"No"-click text ${editPleaIndex + 1} of 10`}
                  placeholder="What to say on this No click…"
                />
              </div>
              <span className="shrink-0 text-[9px] text-white/50">{editPleaIndex + 1}/10</span>
              <button
                type="button"
                id="btn-plea-next"
                onClick={(e) => {
                  e.stopPropagation();
                  setEditPleaIndex((i) => Math.min(noPleaTexts.length - 1, i + 1));
                }}
                disabled={editPleaIndex === noPleaTexts.length - 1}
                className="shrink-0 w-6 h-6 rounded-full bg-white/10 hover:bg-white/20 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center text-white text-xs cursor-pointer"
              >
                ›
              </button>
            </div>
          ) : (
            currentPlea && (
              <div
                key={noCount}
                className="relative z-20 mt-4 px-4 py-1.5 rounded-full bg-[#FF2E7E]/20 border border-[#FF2E7E]/40 text-white text-[11px] sm:text-xs font-bold text-center max-w-[90%] leading-tight animate-float-plea"
              >
                {currentPlea}
              </div>
            )
          ))}
      </div>

      {/* NO Button Section (Shrinks progressively - Bottom on Mobile, Right on Desktop/Tablet) */}
      {showQuestionScreen && (
        <div
          id="btn-no"
          role="button"
          tabIndex={0}
          onClick={session.isEditing ? undefined : handleNoClick}
          onKeyDown={(e) => {
            if (!session.isEditing && (e.key === 'Enter' || e.key === ' ')) {
              e.preventDefault();
              handleNoClick(e as unknown as React.MouseEvent);
            }
          }}
          onMouseEnter={session.isEditing ? undefined : handleNoHover}
          style={{
            flex: `${noFlex} 1 0%`,
            transition: 'all 0.5s cubic-bezier(0.16, 1, 0.3, 1)'
          }}
          className={`h-auto sm:h-full flex flex-col items-center justify-center border-t sm:border-t-0 sm:border-l border-white/10 relative outline-none cursor-pointer overflow-hidden p-2 sm:p-4 active:scale-95 ${
            isShaking ? 'animate-dramatic-shake' : ''
          } ${noCount > 5 ? 'bg-red-950/15' : 'bg-transparent'}`}
        >
          {/* Shattered Glass Screen Cracking FX on refusal */}
          <ScreenCracks stage={noCount} />

          <div className="w-full flex flex-col items-center justify-center text-center px-1 z-20">
            <span
              style={{
                fontSize: `clamp(1rem, ${noFontSizeVmin}vmin, ${Math.max(1.2, 18 - noCount * 1.5)}rem)`,
                lineHeight: 0.9,
                opacity: Math.max(0.25, 0.7 - noCount * 0.04),
                transition: 'all 0.5s cubic-bezier(0.16, 1, 0.3, 1)'
              }}
              className={`font-serif-italic font-light tracking-tighter text-white hover:opacity-100 inline-block ${
                session.isEditing ? '' : 'select-none'
              }`}
            >
              {session.isEditing ? (
                <EditableText
                  tag="span"
                  value={session.content.noLabel}
                  onCommit={session.setNoLabel}
                  ariaLabel="No button label"
                  placeholder="No"
                  className="inline-block"
                />
              ) : (
                session.content.noLabel
              )}
            </span>
          </div>
        </div>
      )}
    </div>

    {session.isEditing && (
      <EditToolbar
        screenIndex={editScreenIndex}
        screenCount={EDIT_SCREENS.length}
        screenLabel={EDIT_SCREENS[editScreenIndex].label}
        onPrev={() => setEditScreenIndex((i) => Math.max(0, i - 1))}
        onNext={() => setEditScreenIndex((i) => Math.min(EDIT_SCREENS.length - 1, i + 1))}
        onSave={handleSaveClick}
        onFinish={handleFinishEditing}
        mode={session.mode}
        musicSlot={
          editScreenIndex === 0 ? (
            <MusicControl musicUrl={session.content.musicUrl} onSaveMusicUrl={session.setMusicUrl} music={music} />
          ) : undefined
        }
      />
    )}
    </div>
  );
}
