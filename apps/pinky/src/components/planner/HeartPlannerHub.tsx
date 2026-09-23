/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Film, Calendar, Utensils, Check, Sparkles } from 'lucide-react';
import { ActivitySection } from './ActivitySection';
import { DateTimeSection } from './DateTimeSection';
import { RestaurantSection } from './RestaurantSection';
import { MergedPlanModal } from './MergedPlanModal';
import { ActivityOption, DatePlan, PlannerStep, RestaurantOption } from '../../types';

interface HeartPlannerHubProps {
  activities: ActivityOption[];
  restaurants: RestaurantOption[];
  /** The falling-screen word — passed through to the merged plan so the shared image
   * can use the same repeating-marquee background the celebration screen has. */
  celebrationWord: string;
}

export function HeartPlannerHub({ activities, restaurants, celebrationWord }: HeartPlannerHubProps) {
  const [currentStep, setCurrentStep] = useState<PlannerStep>('hub');
  const [isMerging, setIsMerging] = useState<boolean>(false);
  const [hasUnited, setHasUnited] = useState<boolean>(false);

  // Responsive Orientation State: Vertical (Portrait) vs Horizontal (Landscape)
  const [isPortrait, setIsPortrait] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return window.innerHeight > window.innerWidth;
  });

  useEffect(() => {
    const checkOrientation = () => {
      setIsPortrait(window.innerHeight > window.innerWidth);
    };

    window.addEventListener('resize', checkOrientation);
    window.addEventListener('orientationchange', checkOrientation);
    return () => {
      window.removeEventListener('resize', checkOrientation);
      window.removeEventListener('orientationchange', checkOrientation);
    };
  }, []);

  // Saved Date Selections (ephemeral per visit — the other person picks these live)
  const [plan, setPlan] = useState<DatePlan>({
    activity: '',
    date: '',
    time: '',
    restaurant: '',
    partnerEmail: '56moments.store@gmail.com'
  });

  const isActivitySaved = Boolean(plan.activity);
  const isDateTimeSaved = Boolean(plan.date && plan.time);
  const isRestaurantSaved = Boolean(plan.restaurant);

  // Check if all 3 parts are saved
  const checkAllCompleted = (newPlan: DatePlan) => {
    if (newPlan.activity && newPlan.date && newPlan.time && newPlan.restaurant) {
      // Step back to hub first to show the 3 hearts merging together like liquid bubbles
      setCurrentStep('hub');
      setIsMerging(true);
      setTimeout(() => {
        setIsMerging(false);
        setHasUnited(true);
      }, 1350);
    } else {
      setCurrentStep('hub');
    }
  };

  const handleSaveActivity = (activity: string) => {
    const updated = { ...plan, activity };
    setPlan(updated);
    checkAllCompleted(updated);
  };

  const handleSaveDateTime = (date: string, time: string) => {
    const updated = { ...plan, date, time };
    setPlan(updated);
    checkAllCompleted(updated);
  };

  const handleSaveRestaurant = (restaurant: string, mapsLink?: string, imageUrl?: string) => {
    const updated = { ...plan, restaurant, mapsLink, restaurantImageUrl: imageUrl };
    setPlan(updated);
    checkAllCompleted(updated);
  };

  const handleOpenUnitedPlan = () => {
    setCurrentStep('merged-plan');
  };

  return (
    <div className="relative z-40 w-full max-h-[100dvh] overflow-hidden flex flex-col items-center justify-center p-2 sm:p-4 no-scrollbar">
      {/* 1. HUB VIEW: 3 Floating 3D Hearts (Horizontal or Vertical based on screen) OR 1 Big United Heart */}
      {currentStep === 'hub' && (
        <div className="flex flex-col items-center justify-center w-full min-h-[320px]">
          {/* CASE A: ALL 3 HEARTS UNITED INTO 1 BIG 3D HEART */}
          {hasUnited ? (
            <div className="flex flex-col items-center justify-center animate-big-heart-united">
              <button
                type="button"
                id="btn-big-united-heart"
                onClick={handleOpenUnitedPlan}
                className="group relative w-60 h-60 sm:w-76 sm:h-76 md:w-88 md:h-88 lg:w-[26rem] lg:h-[26rem] flex items-center justify-center focus:outline-none cursor-pointer transition-all duration-300 hover:scale-105 active:scale-95 animate-big-heart-pulse"
              >
                {/* Ambient Dynamic Halo */}
                <div className="absolute inset-4 bg-gradient-to-tr from-[#FF2E7E]/40 via-[#FF80BF]/50 to-white/30 rounded-full blur-3xl animate-aura-glow pointer-events-none" />

                {/* 3D Big Heart Shape with Intense Shading & Specular Highlights */}
                <svg
                  viewBox="0 0 100 100"
                  className="w-full h-full drop-shadow-[0_25px_60px_rgba(255,46,126,0.95)] relative z-10"
                >
                  <defs>
                    {/* 3D Liquid Gloss Base Gradient */}
                    <radialGradient id="bigHeart3DGrad" cx="35%" cy="30%" r="70%">
                      <stop offset="0%" stopColor="#FFC2DD" />
                      <stop offset="25%" stopColor="#FF5B99" />
                      <stop offset="55%" stopColor="#FF146A" />
                      <stop offset="80%" stopColor="#B30043" />
                      <stop offset="100%" stopColor="#5E0020" />
                    </radialGradient>

                    {/* Top Specular Curved Highlight */}
                    <linearGradient id="bigGlossHighlight" x1="0%" y1="0%" x2="0%" y2="100%">
                      <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.95" />
                      <stop offset="45%" stopColor="#FFFFFF" stopOpacity="0.35" />
                      <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
                    </linearGradient>

                    {/* Bottom Caustic Bounce Light */}
                    <linearGradient id="bigCausticBounce" x1="0%" y1="100%" x2="0%" y2="0%">
                      <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.75" />
                      <stop offset="40%" stopColor="#FF80BF" stopOpacity="0.4" />
                      <stop offset="100%" stopColor="#FF2E7E" stopOpacity="0" />
                    </linearGradient>

                    {/* Edge Rim Light */}
                    <linearGradient id="bigRimLight" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.9" />
                      <stop offset="50%" stopColor="#FF80BF" stopOpacity="0.6" />
                      <stop offset="100%" stopColor="#FF2E7E" stopOpacity="0.3" />
                    </linearGradient>
                  </defs>

                  {/* 3D Outer Ambient Glow */}
                  <path
                    d="M 50,28 C 50,13 33,3 18,13 C 3,23 3,45 23,67 L 50,93 L 77,67 C 97,45 97,23 82,13 C 67,3 50,13 50,28 Z"
                    fill="url(#bigHeart3DGrad)"
                    stroke="url(#bigRimLight)"
                    strokeWidth="2.5"
                  />

                  {/* Bottom Caustic Reflection */}
                  <path
                    d="M 27,62 L 50,88 L 73,62 C 65,75 35,75 27,62 Z"
                    fill="url(#bigCausticBounce)"
                  />

                  {/* 3D Upper-Left Bulbous Highlight Dome */}
                  <path
                    d="M 23,17 C 32,10 44,17 46,26 C 40,30 25,32 17,25 C 13,21 16,16 23,17 Z"
                    fill="url(#bigGlossHighlight)"
                  />
                  {/* 3D Upper-Right Bulbous Highlight Dome */}
                  <path
                    d="M 77,17 C 68,10 56,17 54,26 C 60,30 75,32 83,25 C 87,21 84,16 77,17 Z"
                    fill="url(#bigGlossHighlight)"
                  />

                  {/* Shimmering Star Sparkles */}
                  <polygon
                    points="32,22 34,26 38,28 34,30 32,34 30,30 26,28 30,26"
                    fill="#FFFFFF"
                    className="animate-sparkle-twinkle"
                  />
                  <polygon
                    points="70,24 71.5,27 75,28.5 71.5,30 70,33 68.5,30 65,28.5 68.5,27"
                    fill="#FFFFFF"
                    className="animate-sparkle-twinkle-alt"
                  />
                </svg>

                {/* Text inside the Big Heart: SEE THE PLAN - Perfectly Centered in Heart Core */}
                <div className="absolute inset-x-0 top-2 bottom-8 sm:top-4 sm:bottom-12 flex flex-col items-center justify-center text-white pointer-events-none px-6 sm:px-10 text-center z-20">
                  <Sparkles className="w-8 h-8 sm:w-10 sm:h-10 md:w-12 md:h-12 text-white drop-shadow-[0_0_12px_rgba(255,255,255,0.95)] mb-1 sm:mb-1.5 animate-bounce" />
                  <span className="text-sm sm:text-lg md:text-xl lg:text-2xl font-black uppercase tracking-wider text-white drop-shadow-[0_3px_10px_rgba(0,0,0,0.7)] font-sans leading-tight">
                    See The Plan
                  </span>
                  <span className="text-[10px] sm:text-xs md:text-sm text-white/95 font-semibold tracking-wide mt-0.5 sm:mt-1 drop-shadow-md whitespace-nowrap">
                    Tap to Open Full Details ✨
                  </span>
                </div>
              </button>
            </div>
          ) : (
            /* CASE B: 3 INDIVIDUAL 3D HEARTS (CLEAN - NO BOTTOM TEXT BADGES) */
            <div
              className={`relative flex items-center justify-center py-4 transition-all duration-300 ${
                isPortrait
                  ? 'flex-col gap-6 sm:gap-8'
                  : 'flex-row gap-6 sm:gap-10 md:gap-14 lg:gap-20'
              }`}
            >
              {/* ==================== 3D HEART 1: ACTIVITY ==================== */}
              <div
                className={`relative flex flex-col items-center group ${
                  isMerging
                    ? isPortrait
                      ? 'animate-merge-top'
                      : 'animate-merge-left'
                    : 'animate-heart-float-1'
                }`}
              >
                {/* Ambient Glow Aura */}
                <div className="absolute inset-2 bg-gradient-to-tr from-[#FF2E7E]/30 via-[#FFA6CB]/40 to-white/20 rounded-full blur-2xl animate-aura-glow pointer-events-none group-hover:scale-125 transition-transform duration-500" />

                <button
                  type="button"
                  id="btn-heart-activity"
                  onClick={() => setCurrentStep('activity')}
                  className="relative w-32 h-32 sm:w-44 sm:h-44 md:w-56 md:h-56 lg:w-64 lg:h-64 flex items-center justify-center focus:outline-none cursor-pointer transition-all duration-300 group-hover:scale-110 active:scale-95 z-10"
                >
                  <svg
                    viewBox="0 0 100 100"
                    className="w-full h-full drop-shadow-[0_18px_40px_rgba(255,46,126,0.8)] group-hover:drop-shadow-[0_24px_60px_rgba(255,46,126,1)] transition-all duration-300"
                  >
                    <defs>
                      <radialGradient id="heart3D_1_lux" cx="35%" cy="30%" r="70%">
                        <stop offset="0%" stopColor="#FFD1E3" />
                        <stop offset="25%" stopColor="#FF66A1" />
                        <stop offset="55%" stopColor="#FF1A75" />
                        <stop offset="85%" stopColor="#BD0049" />
                        <stop offset="100%" stopColor="#660026" />
                      </radialGradient>
                      <linearGradient id="gloss1_lux" x1="0%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.95" />
                        <stop offset="45%" stopColor="#FFFFFF" stopOpacity="0.3" />
                        <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
                      </linearGradient>
                      <linearGradient id="caustic1_lux" x1="0%" y1="100%" x2="0%" y2="0%">
                        <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.7" />
                        <stop offset="40%" stopColor="#FF80BF" stopOpacity="0.35" />
                        <stop offset="100%" stopColor="#FF2E7E" stopOpacity="0" />
                      </linearGradient>
                      <linearGradient id="rim1_lux" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.9" />
                        <stop offset="60%" stopColor="#FFA6CB" stopOpacity="0.5" />
                        <stop offset="100%" stopColor="#FF2E7E" stopOpacity="0.3" />
                      </linearGradient>
                    </defs>

                    {/* 3D Volumetric Heart Base */}
                    <path
                      d="M 50,28 C 50,13 33,3 18,13 C 3,23 3,45 23,67 L 50,93 L 77,67 C 97,45 97,23 82,13 C 67,3 50,13 50,28 Z"
                      fill="url(#heart3D_1_lux)"
                      stroke="url(#rim1_lux)"
                      strokeWidth="2.2"
                    />

                    {/* Bottom Caustic Reflection Arc */}
                    <path
                      d="M 28,63 L 50,88 L 72,63 C 63,75 37,75 28,63 Z"
                      fill="url(#caustic1_lux)"
                    />

                    {/* 3D Gloss Highlight Domes */}
                    <path
                      d="M 23,17 C 32,10 44,17 46,26 C 40,30 25,32 17,25 C 13,21 16,16 23,17 Z"
                      fill="url(#gloss1_lux)"
                    />
                    <path
                      d="M 77,17 C 68,10 56,17 54,26 C 60,30 75,32 83,25 C 87,21 84,16 77,17 Z"
                      fill="url(#gloss1_lux)"
                    />

                    {/* Embedded Twinkling Sparkle Star */}
                    <polygon
                      points="31,23 32.5,26 35.5,27.5 32.5,29 31,32 29.5,29 26.5,27.5 29.5,26"
                      fill="#FFFFFF"
                      className="animate-sparkle-twinkle"
                    />
                  </svg>

                  {/* Inner Icon with Embossed Luxury Look */}
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-white pointer-events-none pb-2 sm:pb-5 md:pb-8">
                    <Film className="w-8 h-8 sm:w-12 sm:h-12 md:w-16 md:h-16 lg:w-20 lg:h-20 drop-shadow-[0_4px_12px_rgba(0,0,0,0.6)] group-hover:scale-110 transition-transform duration-300" />
                  </div>

                  {/* Saved Checkmark Badge */}
                  {isActivitySaved && (
                    <div className="absolute top-0 right-0 sm:-top-1 sm:-right-1 w-7 h-7 sm:w-9 sm:h-9 md:w-11 md:h-11 rounded-full bg-white text-[#FF2E7E] flex items-center justify-center shadow-2xl border-2 sm:border-3 border-[#FF2E7E] animate-scale-in">
                      <Check className="w-4 h-4 sm:w-5 sm:h-5 md:w-6 md:h-6 stroke-[3]" />
                    </div>
                  )}
                </button>
              </div>

              {/* ==================== 3D HEART 2: DATE & TIME ==================== */}
              <div
                className={`relative flex flex-col items-center group ${
                  isMerging ? 'animate-merge-center' : 'animate-heart-float-2'
                }`}
              >
                {/* Ambient Glow Aura */}
                <div className="absolute inset-2 bg-gradient-to-tr from-[#FF156E]/35 via-[#FFB3D4]/50 to-white/25 rounded-full blur-2xl animate-aura-glow pointer-events-none group-hover:scale-125 transition-transform duration-500" />

                <button
                  type="button"
                  id="btn-heart-datetime"
                  onClick={() => setCurrentStep('datetime')}
                  className="relative w-32 h-32 sm:w-44 sm:h-44 md:w-56 md:h-56 lg:w-64 lg:h-64 flex items-center justify-center focus:outline-none cursor-pointer transition-all duration-300 group-hover:scale-110 active:scale-95 z-10"
                >
                  <svg
                    viewBox="0 0 100 100"
                    className="w-full h-full drop-shadow-[0_18px_40px_rgba(255,46,126,0.8)] group-hover:drop-shadow-[0_24px_60px_rgba(255,46,126,1)] transition-all duration-300"
                  >
                    <defs>
                      <radialGradient id="heart3D_2_lux" cx="35%" cy="30%" r="70%">
                        <stop offset="0%" stopColor="#FFE0ED" />
                        <stop offset="25%" stopColor="#FF4D94" />
                        <stop offset="55%" stopColor="#FF005E" />
                        <stop offset="85%" stopColor="#9E0038" />
                        <stop offset="100%" stopColor="#52001C" />
                      </radialGradient>
                      <linearGradient id="gloss2_lux" x1="0%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.98" />
                        <stop offset="45%" stopColor="#FFFFFF" stopOpacity="0.35" />
                        <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
                      </linearGradient>
                      <linearGradient id="caustic2_lux" x1="0%" y1="100%" x2="0%" y2="0%">
                        <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.8" />
                        <stop offset="40%" stopColor="#FFA6CB" stopOpacity="0.4" />
                        <stop offset="100%" stopColor="#FF156E" stopOpacity="0" />
                      </linearGradient>
                      <linearGradient id="rim2_lux" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.95" />
                        <stop offset="60%" stopColor="#FF80BF" stopOpacity="0.6" />
                        <stop offset="100%" stopColor="#FF156E" stopOpacity="0.35" />
                      </linearGradient>
                    </defs>

                    {/* 3D Volumetric Heart Base */}
                    <path
                      d="M 50,28 C 50,13 33,3 18,13 C 3,23 3,45 23,67 L 50,93 L 77,67 C 97,45 97,23 82,13 C 67,3 50,13 50,28 Z"
                      fill="url(#heart3D_2_lux)"
                      stroke="url(#rim2_lux)"
                      strokeWidth="2.2"
                    />

                    {/* Bottom Caustic Reflection Arc */}
                    <path
                      d="M 28,63 L 50,88 L 72,63 C 63,75 37,75 28,63 Z"
                      fill="url(#caustic2_lux)"
                    />

                    {/* 3D Gloss Highlight Domes */}
                    <path
                      d="M 23,17 C 32,10 44,17 46,26 C 40,30 25,32 17,25 C 13,21 16,16 23,17 Z"
                      fill="url(#gloss2_lux)"
                    />
                    <path
                      d="M 77,17 C 68,10 56,17 54,26 C 60,30 75,32 83,25 C 87,21 84,16 77,17 Z"
                      fill="url(#gloss2_lux)"
                    />

                    {/* Embedded Twinkling Sparkle Stars */}
                    <polygon
                      points="31,22 33,25.5 36.5,27 33,28.5 31,32 29,28.5 25.5,27 29,25.5"
                      fill="#FFFFFF"
                      className="animate-sparkle-twinkle"
                    />
                    <polygon
                      points="72,23 73.5,26 77,27.5 73.5,29 72,32 70.5,29 67,27.5 70.5,26"
                      fill="#FFFFFF"
                      className="animate-sparkle-twinkle-alt"
                    />
                  </svg>

                  {/* Inner Icon with Embossed Luxury Look */}
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-white pointer-events-none pb-2 sm:pb-5 md:pb-8">
                    <Calendar className="w-8 h-8 sm:w-12 sm:h-12 md:w-16 md:h-16 lg:w-20 lg:h-20 drop-shadow-[0_4px_12px_rgba(0,0,0,0.6)] group-hover:scale-110 transition-transform duration-300" />
                  </div>

                  {/* Saved Checkmark Badge */}
                  {isDateTimeSaved && (
                    <div className="absolute top-0 right-0 sm:-top-1 sm:-right-1 w-7 h-7 sm:w-9 sm:h-9 md:w-11 md:h-11 rounded-full bg-white text-[#FF156E] flex items-center justify-center shadow-2xl border-2 sm:border-3 border-[#FF156E] animate-scale-in">
                      <Check className="w-4 h-4 sm:w-5 sm:h-5 md:w-6 md:h-6 stroke-[3]" />
                    </div>
                  )}
                </button>
              </div>

              {/* ==================== 3D HEART 3: RESTAURANT ==================== */}
              <div
                className={`relative flex flex-col items-center group ${
                  isMerging
                    ? isPortrait
                      ? 'animate-merge-bottom'
                      : 'animate-merge-right'
                    : 'animate-heart-float-3'
                }`}
              >
                {/* Ambient Glow Aura */}
                <div className="absolute inset-2 bg-gradient-to-tr from-[#FF2E7E]/30 via-[#FFA6CB]/40 to-white/20 rounded-full blur-2xl animate-aura-glow pointer-events-none group-hover:scale-125 transition-transform duration-500" />

                <button
                  type="button"
                  id="btn-heart-restaurant"
                  onClick={() => setCurrentStep('restaurant')}
                  className="relative w-32 h-32 sm:w-44 sm:h-44 md:w-56 md:h-56 lg:w-64 lg:h-64 flex items-center justify-center focus:outline-none cursor-pointer transition-all duration-300 group-hover:scale-110 active:scale-95 z-10"
                >
                  <svg
                    viewBox="0 0 100 100"
                    className="w-full h-full drop-shadow-[0_18px_40px_rgba(255,46,126,0.8)] group-hover:drop-shadow-[0_24px_60px_rgba(255,46,126,1)] transition-all duration-300"
                  >
                    <defs>
                      <radialGradient id="heart3D_3_lux" cx="35%" cy="30%" r="70%">
                        <stop offset="0%" stopColor="#FFD1E3" />
                        <stop offset="25%" stopColor="#FF66A1" />
                        <stop offset="55%" stopColor="#FF1A75" />
                        <stop offset="85%" stopColor="#BD0049" />
                        <stop offset="100%" stopColor="#660026" />
                      </radialGradient>
                      <linearGradient id="gloss3_lux" x1="0%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.95" />
                        <stop offset="45%" stopColor="#FFFFFF" stopOpacity="0.3" />
                        <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
                      </linearGradient>
                      <linearGradient id="caustic3_lux" x1="0%" y1="100%" x2="0%" y2="0%">
                        <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.7" />
                        <stop offset="40%" stopColor="#FF80BF" stopOpacity="0.35" />
                        <stop offset="100%" stopColor="#FF2E7E" stopOpacity="0" />
                      </linearGradient>
                      <linearGradient id="rim3_lux" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.9" />
                        <stop offset="60%" stopColor="#FFA6CB" stopOpacity="0.5" />
                        <stop offset="100%" stopColor="#FF2E7E" stopOpacity="0.3" />
                      </linearGradient>
                    </defs>

                    {/* 3D Volumetric Heart Base */}
                    <path
                      d="M 50,28 C 50,13 33,3 18,13 C 3,23 3,45 23,67 L 50,93 L 77,67 C 97,45 97,23 82,13 C 67,3 50,13 50,28 Z"
                      fill="url(#heart3D_3_lux)"
                      stroke="url(#rim3_lux)"
                      strokeWidth="2.2"
                    />

                    {/* Bottom Caustic Reflection Arc */}
                    <path
                      d="M 28,63 L 50,88 L 72,63 C 63,75 37,75 28,63 Z"
                      fill="url(#caustic3_lux)"
                    />

                    {/* 3D Gloss Highlight Domes */}
                    <path
                      d="M 23,17 C 32,10 44,17 46,26 C 40,30 25,32 17,25 C 13,21 16,16 23,17 Z"
                      fill="url(#gloss3_lux)"
                    />
                    <path
                      d="M 77,17 C 68,10 56,17 54,26 C 60,30 75,32 83,25 C 87,21 84,16 77,17 Z"
                      fill="url(#gloss3_lux)"
                    />

                    {/* Embedded Twinkling Sparkle Star */}
                    <polygon
                      points="31,23 32.5,26 35.5,27.5 32.5,29 31,32 29.5,29 26.5,27.5 29.5,26"
                      fill="#FFFFFF"
                      className="animate-sparkle-twinkle"
                    />
                  </svg>

                  {/* Inner Icon with Embossed Luxury Look */}
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-white pointer-events-none pb-2 sm:pb-5 md:pb-8">
                    <Utensils className="w-8 h-8 sm:w-12 sm:h-12 md:w-16 md:h-16 lg:w-20 lg:h-20 drop-shadow-[0_4px_12px_rgba(0,0,0,0.6)] group-hover:scale-110 transition-transform duration-300" />
                  </div>

                  {/* Saved Checkmark Badge */}
                  {isRestaurantSaved && (
                    <div className="absolute top-0 right-0 sm:-top-1 sm:-right-1 w-7 h-7 sm:w-9 sm:h-9 md:w-11 md:h-11 rounded-full bg-white text-[#FF2E7E] flex items-center justify-center shadow-2xl border-2 sm:border-3 border-[#FF2E7E] animate-scale-in">
                      <Check className="w-4 h-4 sm:w-5 sm:h-5 md:w-6 md:h-6 stroke-[3]" />
                    </div>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 2. SECTION 1: ACTIVITY ZOOM VIEW */}
      {currentStep === 'activity' && (
        <ActivitySection
          activities={activities}
          initialActivity={plan.activity}
          onSave={handleSaveActivity}
          onCancel={() => setCurrentStep('hub')}
        />
      )}

      {/* 3. SECTION 2: DATE & TIME ZOOM VIEW */}
      {currentStep === 'datetime' && (
        <DateTimeSection
          initialDate={plan.date}
          initialTime={plan.time}
          onSave={handleSaveDateTime}
          onCancel={() => setCurrentStep('hub')}
        />
      )}

      {/* 4. SECTION 3: RESTAURANT ZOOM VIEW */}
      {currentStep === 'restaurant' && (
        <RestaurantSection
          restaurants={restaurants}
          initialRestaurant={plan.restaurant}
          onSave={handleSaveRestaurant}
          onCancel={() => setCurrentStep('hub')}
        />
      )}

      {/* 5. MERGED BIG HEART VIEW: FULL PLAN & SHARE ACTIONS */}
      {currentStep === 'merged-plan' && (
        <MergedPlanModal plan={plan} celebrationWord={celebrationWord} />
      )}
    </div>
  );
}
