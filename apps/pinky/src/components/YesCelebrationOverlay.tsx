/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { HeartPlannerHub } from './planner/HeartPlannerHub';
import { ActivitySection } from './planner/ActivitySection';
import { RestaurantSection } from './planner/RestaurantSection';
import { EditableText } from './edit/EditableText';
import { ActivityOption, RestaurantOption } from '../types';

interface YesCelebrationOverlayProps {
  celebrationWord: string;
  activities: ActivityOption[];
  restaurants: RestaurantOption[];
  /** Owner edit mode only — set by the editor toolbar's Prev/Next, one of the three
   * screens that live behind this fullscreen marquee. When set, the normal visitor
   * hub/merge flow (HeartPlannerHub) is bypassed entirely: that state machine is for
   * the visitor building their own live plan, which is a different thing from the
   * owner editing the underlying options. */
  editingStep?: 'celebration' | 'activity' | 'restaurant';
  onEditCelebrationWord?: (v: string) => void;
  onAddActivity?: (emoji: string, text: string) => void;
  onUpdateActivity?: (id: string, patch: Partial<Pick<ActivityOption, 'emoji' | 'text'>>) => void;
  onRemoveActivity?: (id: string) => void;
  onAddRestaurant?: (
    name: string,
    mapsLink: string,
    extra?: Partial<Pick<RestaurantOption, 'imageUrl' | 'rating' | 'reviewCount' | 'hours'>>
  ) => void;
  onUpdateRestaurant?: (id: string, patch: Partial<Omit<RestaurantOption, 'id'>>) => void;
  onRemoveRestaurant?: (id: string) => void;
}

export function YesCelebrationOverlay({
  celebrationWord,
  activities,
  restaurants,
  editingStep,
  onEditCelebrationWord,
  onAddActivity,
  onUpdateActivity,
  onRemoveActivity,
  onAddRestaurant,
  onUpdateRestaurant,
  onRemoveRestaurant
}: YesCelebrationOverlayProps) {
  // 12 distinct typographical rows, all repeating the same editable word (no exclamation marks appended)
  const repeatedText = useMemo(
    () => Array(10).fill(celebrationWord || 'YES').join(' '),
    [celebrationWord]
  );
  const rows = useMemo(
    () => [
      { id: 0, outlined: true, speed: 'animate-marquee-left-fast', opacity: 'opacity-40' },
      { id: 1, outlined: false, speed: 'animate-marquee-right', opacity: 'opacity-80' },
      { id: 2, outlined: true, speed: 'animate-marquee-left', opacity: 'opacity-50' },
      { id: 3, outlined: false, speed: 'animate-marquee-right-fast', opacity: 'opacity-90' },
      { id: 4, outlined: true, speed: 'animate-marquee-left-slow', opacity: 'opacity-60' },
      { id: 5, outlined: false, speed: 'animate-marquee-right-slow', opacity: 'opacity-95' },
      { id: 6, outlined: true, speed: 'animate-marquee-left-fast', opacity: 'opacity-50' },
      { id: 7, outlined: false, speed: 'animate-marquee-right', opacity: 'opacity-85' },
      { id: 8, outlined: true, speed: 'animate-marquee-left', opacity: 'opacity-40' },
      { id: 9, outlined: false, speed: 'animate-marquee-right-fast', opacity: 'opacity-75' },
      { id: 10, outlined: true, speed: 'animate-marquee-left-slow', opacity: 'opacity-50' },
      { id: 11, outlined: false, speed: 'animate-marquee-left', opacity: 'opacity-85' }
    ],
    []
  );

  const [activeRowIndex, setActiveRowIndex] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number | null>(null);

  // High performance proximity calculation with zero DOM layout thrashing (O(1) calculation)
  const handlePointerMoveY = useCallback((clientY: number) => {
    if (rafRef.current !== null) return;
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;
      const height = window.innerHeight || 1;
      const rowHeight = height / rows.length;
      const calculatedIdx = Math.floor(clientY / rowHeight);
      const clampedIdx = Math.max(0, Math.min(rows.length - 1, calculatedIdx));
      setActiveRowIndex(clampedIdx);
    });
  }, [rows.length]);

  const handleMouseMove = (e: React.MouseEvent) => {
    handlePointerMoveY(e.clientY);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches && e.touches.length > 0) {
      handlePointerMoveY(e.touches[0].clientY);
    }
  };

  const handlePointerLeave = () => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    setActiveRowIndex(null);
  };

  useEffect(() => {
    let timeoutId: NodeJS.Timeout;
    const handleGlobalTouchEnd = () => {
      // fade out active line smoothly after touch lifts
      timeoutId = setTimeout(() => setActiveRowIndex(null), 800);
    };
    window.addEventListener('touchend', handleGlobalTouchEnd, { passive: true });
    return () => {
      window.removeEventListener('touchend', handleGlobalTouchEnd);
      clearTimeout(timeoutId);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  return (
    <div
      ref={containerRef}
      onMouseMove={handleMouseMove}
      onTouchMove={handleTouchMove}
      onMouseLeave={handlePointerLeave}
      className="fixed inset-0 z-50 overflow-hidden select-none bg-[#FF2E7E] flex items-center justify-center pointer-events-auto animate-fade-in touch-none"
    >
      {/* Fullscreen Kinetic Interactive Typographic Marquee Lines - Hardware Accelerated for iOS WebKit */}
      <div className="absolute inset-0 flex flex-col justify-between py-1 sm:py-2 pointer-events-auto overflow-hidden animate-scene3-intro will-change-transform">
        {rows.map((row, idx) => {
          const isRowActive = activeRowIndex === idx;

          return (
            <div
              key={row.id}
              onMouseEnter={() => setActiveRowIndex(idx)}
              onMouseLeave={() => {
                if (activeRowIndex === idx) setActiveRowIndex(null);
              }}
              className={`w-[250%] flex whitespace-nowrap leading-none tracking-tighter cursor-crosshair interactive-yes-line ${
                row.speed
              } ${row.opacity} ${isRowActive ? 'is-active-line' : ''}`}
              style={{
                fontFamily: 'system-ui, -apple-system, sans-serif',
                fontWeight: 900,
                fontSize: 'clamp(2.4rem, 6.2vh, 4.6rem)',
                textTransform: 'uppercase',
                transformOrigin: 'center center',
              }}
            >
              {/* Seamless loop strings with heartbeat glow on interaction */}
              <span
                className={`px-4 yes-text-span transition-all duration-200 ${
                  row.outlined
                    ? 'text-transparent stroke-text-white'
                    : 'text-white'
                }`}
              >
                {repeatedText} &nbsp; {repeatedText} &nbsp; {repeatedText}
              </span>
              <span
                className={`px-4 yes-text-span transition-all duration-200 ${
                  row.outlined
                    ? 'text-transparent stroke-text-white'
                    : 'text-white'
                }`}
              >
                {repeatedText} &nbsp; {repeatedText} &nbsp; {repeatedText}
              </span>
            </div>
          );
        })}
      </div>

      {/* 3 Interactive Heart Shaped Buttons & Planner Flow (Sitting on top with high z-index) —
          or, in owner edit mode, whichever of the three screens is being edited, still
          sitting on the exact same marquee background so it looks like the live site. */}
      <div className="relative z-40 w-full flex items-center justify-center p-2 sm:p-4 pointer-events-auto">
        {editingStep === 'celebration' && (
          <div className="text-center px-6">
            <p className="text-white/70 text-xs font-bold uppercase tracking-widest mb-3">
              Falling screen text
            </p>
            <EditableText
              tag="span"
              value={celebrationWord}
              onCommit={(v) => onEditCelebrationWord?.(v)}
              ariaLabel="Celebration word"
              placeholder="YES"
              className="inline-block px-5 py-2 rounded-2xl bg-black/50 text-white font-black uppercase tracking-tighter"
              style={{ fontSize: 'clamp(2rem, 8vh, 3.5rem)', fontFamily: 'system-ui, -apple-system, sans-serif' }}
            />
            <p className="text-white/50 text-[11px] mt-3 max-w-xs mx-auto">
              This word repeats across the marquee behind it — edit it once here.
            </p>
          </div>
        )}
        {editingStep === 'activity' && (
          <ActivitySection
            activities={activities}
            initialActivity=""
            onSave={() => {}}
            onCancel={() => {}}
            editing
            onAddActivity={onAddActivity}
            onUpdateActivity={onUpdateActivity}
            onRemoveActivity={onRemoveActivity}
          />
        )}
        {editingStep === 'restaurant' && (
          <RestaurantSection
            restaurants={restaurants}
            initialRestaurant=""
            onSave={() => {}}
            onCancel={() => {}}
            editing
            onAddRestaurant={onAddRestaurant}
            onUpdateRestaurant={onUpdateRestaurant}
            onRemoveRestaurant={onRemoveRestaurant}
          />
        )}
        {!editingStep && (
          <HeartPlannerHub
            activities={activities}
            restaurants={restaurants}
            celebrationWord={celebrationWord}
          />
        )}
      </div>
    </div>
  );
}
