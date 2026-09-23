/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';

// --- Realistic & Cute Vector Butterfly Component ---
function VectorButterfly({
  x,
  y,
  size,
  flightX,
  flightY,
  flightRot,
  primaryColor,
  accentColor,
  duration,
}: {
  x: number;
  y: number;
  size: number;
  flightX: number;
  flightY: number;
  flightRot: number;
  primaryColor: string;
  accentColor: string;
  duration: number;
}) {
  const gradientId = `bf-gradient-${primaryColor.replace('#', '')}-${accentColor.replace('#', '')}`;

  return (
    <div
      className="absolute animate-butterfly-flight pointer-events-none z-20"
      style={
        {
          left: `${x}%`,
          top: `${y}%`,
          '--flight-x': `${flightX}px`,
          '--flight-y': `${flightY}px`,
          '--flight-rot': `${flightRot}deg`,
          animationDuration: `${duration}s`,
        } as React.CSSProperties
      }
    >
      <div
        className="relative flex items-center justify-center filter drop-shadow-[0_4px_10px_rgba(0,0,0,0.15)]"
        style={{ width: size, height: size * 0.85 }}
      >
        <svg className="absolute w-0 h-0">
          <defs>
            <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor={primaryColor} />
              <stop offset="60%" stopColor={accentColor} />
              <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0.8" />
            </linearGradient>
          </defs>
        </svg>

        {/* Left Wings Set */}
        <div className="w-1/2 h-full animate-wing-left origin-right flex items-center justify-end">
          <svg viewBox="0 0 60 70" className="w-full h-full" fill="none" xmlns="http://www.w3.org/2000/svg">
            {/* Forewing */}
            <path
              d="M 58 35 C 45 10 18 2 5 16 C -4 28 8 46 58 38 Z"
              fill={`url(#${gradientId})`}
              stroke="rgba(255,255,255,0.7)"
              strokeWidth="0.8"
            />
            {/* Wing Veins */}
            <path d="M 58 35 Q 35 22 14 18" stroke="rgba(255,255,255,0.55)" strokeWidth="0.75" />
            <path d="M 58 35 Q 38 30 18 32" stroke="rgba(255,255,255,0.5)" strokeWidth="0.75" />
            {/* Wing spots */}
            <circle cx="18" cy="18" r="2.5" fill="#FFFFFF" opacity="0.9" />
            <circle cx="28" cy="15" r="1.8" fill="#FFFFFF" opacity="0.8" />

            {/* Hindwing */}
            <path
              d="M 58 38 C 42 46 15 54 18 64 C 22 72 45 66 58 42 Z"
              fill={accentColor}
              opacity="0.95"
              stroke="rgba(255,255,255,0.6)"
              strokeWidth="0.75"
            />
            <path d="M 58 38 Q 38 52 26 62" stroke="rgba(255,255,255,0.4)" strokeWidth="0.6" />
            <circle cx="26" cy="60" r="1.8" fill="#FFFFFF" opacity="0.85" />
          </svg>
        </div>

        {/* Realistic Slender Body & Antennae */}
        <div className="relative z-10 flex flex-col items-center mx-[-2px]">
          {/* Antennae */}
          <div className="flex justify-between w-3 mb-[-1px]">
            <div className="w-[1px] h-2 bg-amber-100/90 -rotate-30 rounded-full" />
            <div className="w-[1px] h-2 bg-amber-100/90 rotate-30 rounded-full" />
          </div>
          {/* Head */}
          <div className="w-1.5 h-1.5 rounded-full bg-amber-100/95 shadow-sm" />
          {/* Thorax & Abdomen */}
          <div className="w-1 h-4 rounded-full bg-amber-200/90 shadow-sm" />
        </div>

        {/* Right Wings Set */}
        <div className="w-1/2 h-full animate-wing-right origin-left flex items-center justify-start">
          <svg viewBox="0 0 60 70" className="w-full h-full" fill="none" xmlns="http://www.w3.org/2000/svg">
            {/* Forewing */}
            <path
              d="M 2 35 C 15 10 42 2 55 16 C 64 28 52 46 2 38 Z"
              fill={`url(#${gradientId})`}
              stroke="rgba(255,255,255,0.7)"
              strokeWidth="0.8"
            />
            {/* Wing Veins */}
            <path d="M 2 35 Q 25 22 46 18" stroke="rgba(255,255,255,0.55)" strokeWidth="0.75" />
            <path d="M 2 35 Q 22 30 42 32" stroke="rgba(255,255,255,0.5)" strokeWidth="0.75" />
            {/* Wing spots */}
            <circle cx="42" cy="18" r="2.5" fill="#FFFFFF" opacity="0.9" />
            <circle cx="32" cy="15" r="1.8" fill="#FFFFFF" opacity="0.8" />

            {/* Hindwing */}
            <path
              d="M 2 38 C 18 46 45 54 42 64 C 38 72 15 66 2 42 Z"
              fill={accentColor}
              opacity="0.95"
              stroke="rgba(255,255,255,0.6)"
              strokeWidth="0.75"
            />
            <path d="M 2 38 Q 22 52 34 62" stroke="rgba(255,255,245,0.4)" strokeWidth="0.6" />
            <circle cx="34" cy="60" r="1.8" fill="#FFFFFF" opacity="0.85" />
          </svg>
        </div>
      </div>
    </div>
  );
}

// --- Dynamic Rising Vector Flowers from Bottom ---
export interface FlowerInstance {
  id: string;
  x: number; // percentage along bottom (fixed for its lifetime)
  size: number;
  stemHeight: number;
  petalColor: string;
  coreColor: string;
  delay: number;
  duration: number;
  rotation: number;
  zIndex: number;
}

const VectorFlower: React.FC<{ flower: FlowerInstance }> = ({ flower }) => {
  const { x, size, stemHeight, petalColor, coreColor, delay, duration, rotation, zIndex } = flower;
  return (
    <div
      className="absolute bottom-0 animate-flower-rise pointer-events-none select-none"
      style={{
        left: `${x}%`,
        zIndex: zIndex || 15,
        animationDelay: `${delay}s`,
        animationDuration: `${duration}s`,
      }}
    >
      <div
        className="flex flex-col items-center"
        style={{
          transform: `rotate(${rotation}deg)`,
          transformOrigin: 'bottom center',
        }}
      >
        {/* Flower Blossom Head */}
        <svg
          width={size}
          height={size}
          viewBox="0 0 80 80"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="drop-shadow-[0_4px_16px_rgba(242,125,38,0.45)] transition-transform duration-500 hover:scale-110"
        >
          {/* Layered Petals (8 full vibrant petals) */}
          <circle cx="40" cy="18" r="15" fill={petalColor} opacity="0.95" />
          <circle cx="62" cy="40" r="15" fill={petalColor} opacity="0.95" />
          <circle cx="40" cy="62" r="15" fill={petalColor} opacity="0.95" />
          <circle cx="18" cy="40" r="15" fill={petalColor} opacity="0.95" />
          <circle cx="24" cy="24" r="14" fill={petalColor} opacity="0.9" />
          <circle cx="56" cy="24" r="14" fill={petalColor} opacity="0.9" />
          <circle cx="56" cy="56" r="14" fill={petalColor} opacity="0.9" />
          <circle cx="24" cy="56" r="14" fill={petalColor} opacity="0.9" />

          {/* Inner Petal Glow Accent */}
          <circle cx="40" cy="40" r="18" fill="#FFF1F2" opacity="0.5" />

          {/* Flower Golden Pistil Core */}
          <circle cx="40" cy="40" r="11" fill={coreColor} stroke="#EAB308" strokeWidth="2" />
          <circle cx="37" cy="37" r="3" fill="#FFFFFF" opacity="0.9" />
        </svg>

        {/* Leafy Curved Stem */}
        <svg
          width={size * 0.75}
          height={stemHeight}
          viewBox="0 0 60 140"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="mt-[-8px]"
        >
          {/* Main Stem */}
          <path
            d="M 30 0 Q 24 60 30 140"
            stroke="#15803D"
            strokeWidth="4"
            strokeLinecap="round"
          />
          {/* Left Leaf */}
          <path
            d="M 28 45 Q 6 35 2 20 Q 18 28 28 38 Z"
            fill="#22C55E"
            stroke="#166534"
            strokeWidth="1"
          />
          {/* Right Leaf */}
          <path
            d="M 30 75 Q 52 65 58 50 Q 42 58 30 68 Z"
            fill="#16A34A"
            stroke="#166534"
            strokeWidth="1"
          />
        </svg>
      </div>
    </div>
  );
};

// --- Vector Heart Expanding Shockwave ---
function VectorHeartPulse({ stage }: { stage: number }) {
  if (stage <= 0) return null;

  return (
    <div
      key={`heart-pulse-${stage}`}
      className="absolute top-1/2 left-1/2 pointer-events-none z-10 animate-heart-pulse select-none"
      style={{
        width: `${Math.min(95, 40 + stage * 7)}vmin`,
        height: `${Math.min(95, 40 + stage * 7)}vmin`,
      }}
    >
      <svg
        viewBox="0 0 100 100"
        className="w-full h-full drop-shadow-[0_0_28px_rgba(255,46,126,0.85)]"
        fill="none"
      >
        <path
          d="M 50,30 C 50,15 35,5 20,15 C 5,25 5,45 25,65 L 50,90 L 75,65 C 95,45 95,25 80,15 C 65,5 50,15 50,30 Z"
          stroke="#FF2E7E"
          strokeWidth="3.5"
          fill="rgba(255, 46, 126, 0.15)"
        />
        <path
          d="M 50,30 C 50,15 35,5 20,15 C 5,25 5,45 25,65 L 50,90 L 75,65 C 95,45 95,25 80,15 C 65,5 50,15 50,30 Z"
          stroke="#FF80BF"
          strokeWidth="1.8"
          strokeDasharray="5,3"
        />
      </svg>
    </div>
  );
}

// --- Realistic Radiant Sun with Natural Solar Corona, Lens Flare, and Fluffy Pure-White Clouds ---
function BrightSunnySky({ stage }: { stage: number }) {
  if (stage <= 0) return null;

  const sunOpacity = Math.min(1, 0.65 + stage * 0.05);

  return (
    <div
      className="absolute inset-0 pointer-events-none z-5 overflow-hidden transition-opacity duration-700 select-none"
      style={{ opacity: sunOpacity }}
    >
      {/* 1. Realistic Solar Disc & Corona in Top Right */}
      <div className="absolute top-2 right-2 sm:top-6 sm:right-8 flex items-center justify-center">
        {/* Deep Ambient Solar Heat Halo */}
        <div
          className="absolute rounded-full bg-gradient-to-br from-amber-300/40 via-yellow-500/25 to-transparent blur-3xl animate-sun-corona pointer-events-none"
          style={{
            width: `${Math.min(320, 160 + stage * 18)}px`,
            height: `${Math.min(320, 160 + stage * 18)}px`,
          }}
        />

        {/* Realistic Glowing Sun Photosphere (Limb darkening & bright white core) */}
        <div className="relative flex items-center justify-center">
          {/* Outer Sun Atmosphere */}
          <div className="w-20 h-20 sm:w-28 sm:h-28 rounded-full bg-gradient-to-br from-yellow-100 via-amber-300 to-orange-400 shadow-[0_0_50px_rgba(253,224,71,0.95),0_0_100px_rgba(245,158,11,0.6)]" />
          {/* Inner Brilliant White Core */}
          <div className="absolute w-14 h-14 sm:w-20 sm:h-20 rounded-full bg-white/90 blur-[1px] shadow-[0_0_24px_#FFFFFF]" />
        </div>
      </div>

      {/* 2. Soft, Pure-White Cloud Formations with Depth Shading */}
      {/* Cloud 1 (Upper Center-Left) */}
      <div className="absolute top-10 left-[12%] sm:left-[18%] animate-cloud-drift-1">
        <svg
          width="150"
          height="65"
          viewBox="0 0 150 65"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="drop-shadow-[0_8px_20px_rgba(0,0,0,0.15)]"
        >
          {/* Soft cloud base */}
          <ellipse cx="75" cy="46" rx="60" ry="16" fill="#F8FAFC" />
          {/* Billowing puffs */}
          <circle cx="48" cy="34" r="22" fill="#FFFFFF" />
          <circle cx="78" cy="26" r="24" fill="#FFFFFF" />
          <circle cx="106" cy="34" r="20" fill="#FFFFFF" />
          <circle cx="124" cy="42" r="14" fill="#F8FAFC" />
          <circle cx="26" cy="42" r="14" fill="#F8FAFC" />
          {/* Sunny cloud top highlight */}
          <ellipse cx="76" cy="20" rx="16" ry="6" fill="#FFFFFF" opacity="0.9" />
        </svg>
      </div>

      {/* Cloud 2 (Mid-Sky Left, unlocked early) */}
      {stage >= 2 && (
        <div className="absolute top-28 left-[4%] sm:left-[8%] animate-cloud-drift-2">
          <svg
            width="120"
            height="55"
            viewBox="0 0 120 55"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="drop-shadow-[0_6px_16px_rgba(0,0,0,0.12)]"
          >
            <ellipse cx="60" cy="40" rx="48" ry="13" fill="#F8FAFC" />
            <circle cx="42" cy="28" r="18" fill="#FFFFFF" />
            <circle cx="68" cy="22" r="20" fill="#FFFFFF" />
            <circle cx="92" cy="32" r="15" fill="#FFFFFF" />
            <circle cx="22" cy="36" r="11" fill="#F8FAFC" />
          </svg>
        </div>
      )}

      {/* Cloud 3 (Right underneath Sun) */}
      {stage >= 4 && (
        <div className="absolute top-36 right-[6%] sm:right-[14%] animate-cloud-drift-1">
          <svg
            width="135"
            height="60"
            viewBox="0 0 135 60"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="drop-shadow-[0_8px_18px_rgba(0,0,0,0.14)]"
          >
            <ellipse cx="68" cy="42" rx="54" ry="14" fill="#F8FAFC" />
            <circle cx="44" cy="28" r="20" fill="#FFFFFF" />
            <circle cx="72" cy="22" r="22" fill="#FFFFFF" />
            <circle cx="98" cy="32" r="17" fill="#FFFFFF" />
          </svg>
        </div>
      )}

      {/* Ambient Daylight Flare */}
      <div className="absolute top-0 right-0 w-full h-1/2 bg-gradient-to-b from-amber-300/10 via-yellow-200/5 to-transparent pointer-events-none" />
    </div>
  );
}

// --- Main Coordinated Love Growth Visuals Component ---
interface LoveGrowthVisualsProps {
  growthStage: number; // 0 to 10
}

const FLOWER_PALETTES = [
  { petal: '#E11D48', core: '#FDE047' }, // Ruby Rose
  { petal: '#F43F5E', core: '#FEF08A' }, // Coral Pink
  { petal: '#F97316', core: '#FEF08A' }, // Warm Sunset Orange
  { petal: '#FB7185', core: '#FDE047' }, // Soft Rose
  { petal: '#EC4899', core: '#FACC15' }, // Magenta Blossom
  { petal: '#F472B6', core: '#FEF08A' }, // Sweet Pink
  { petal: '#EA580C', core: '#FDE047' }, // Bright Marigold
  { petal: '#BE123C', core: '#FDE047' }, // Deep Crimson
];

// Pre-defined fixed coordinate slots across the meadow width (0% to 94%)
const PERMANENT_FLOWER_SLOTS = [
  { x: 8, size: 52, stem: 88, rot: -4 },
  { x: 78, size: 56, stem: 94, rot: 5 },
  { x: 22, size: 64, stem: 110, rot: -2 },
  { x: 88, size: 50, stem: 82, rot: 6 },
  { x: 40, size: 68, stem: 118, rot: 3 },
  { x: 62, size: 60, stem: 104, rot: -5 },
  { x: 14, size: 48, stem: 78, rot: 4 },
  { x: 70, size: 66, stem: 114, rot: 2 },
  { x: 30, size: 54, stem: 92, rot: -3 },
  { x: 84, size: 58, stem: 98, rot: -4 },
  { x: 48, size: 72, stem: 124, rot: 1 },
  { x: 4, size: 50, stem: 84, rot: -6 },
  { x: 93, size: 52, stem: 86, rot: 5 },
  { x: 35, size: 62, stem: 108, rot: 4 },
  { x: 55, size: 65, stem: 112, rot: -2 },
  { x: 18, size: 56, stem: 96, rot: 3 },
  { x: 74, size: 60, stem: 102, rot: -3 },
  { x: 26, size: 64, stem: 116, rot: -1 },
  { x: 66, size: 54, stem: 90, rot: 4 },
  { x: 44, size: 70, stem: 120, rot: -4 },
  { x: 81, size: 58, stem: 95, rot: 2 },
  { x: 11, size: 52, stem: 86, rot: -5 },
];

export function LoveGrowthVisuals({ growthStage }: LoveGrowthVisualsProps) {
  const [butterflies, setButterflies] = useState<any[]>([]);
  const [persistentFlowers, setPersistentFlowers] = useState<FlowerInstance[]>([]);

  // Persistent Flower Accumulation: Append newly unlocked flowers without altering previous positions
  useEffect(() => {
    if (growthStage <= 0) {
      setPersistentFlowers([]);
      return;
    }

    // Target count of flowers for this stage
    const targetCount = Math.min(growthStage * 2 + 1, PERMANENT_FLOWER_SLOTS.length);

    setPersistentFlowers((prev) => {
      if (prev.length >= targetCount) return prev;

      const updated = [...prev];
      for (let i = prev.length; i < targetCount; i++) {
        const slot = PERMANENT_FLOWER_SLOTS[i];
        const palette = FLOWER_PALETTES[i % FLOWER_PALETTES.length];
        updated.push({
          id: `flower-slot-${i}`,
          x: slot.x,
          size: slot.size,
          stemHeight: slot.stem,
          petalColor: palette.petal,
          coreColor: palette.core,
          delay: ((i - prev.length) * 0.12),
          duration: 0.9,
          rotation: slot.rot,
          zIndex: 15 + (i % 5),
        });
      }
      return updated;
    });
  }, [growthStage]);

  // Cute, realistic vector butterflies fluttering upwards with 3D wing flaps
  useEffect(() => {
    if (growthStage <= 0) return;

    const bfCount = 3 + Math.min(growthStage, 5);
    const newBfs = [];
    const bfPalettes = [
      { c1: '#F97316', c2: '#FDE047' }, // Monarch Golden Orange
      { c1: '#38BDF8', c2: '#818CF8' }, // Blue Morpho
      { c1: '#EC4899', c2: '#F472B6' }, // Rose Swallowtail
      { c1: '#A855F7', c2: '#E879F9' }, // Purple Emperor
      { c1: '#10B981', c2: '#6EE7B7' }, // Emerald Flutter
    ];

    for (let i = 0; i < bfCount; i++) {
      const palette = bfPalettes[i % bfPalettes.length];
      newBfs.push({
        id: `bf-${Date.now()}-${i}`,
        x: 15 + Math.random() * 70,
        y: 35 + Math.random() * 35,
        size: 38 + Math.floor(Math.random() * 20),
        flightX: (Math.random() - 0.5) * 340,
        flightY: -200 - Math.random() * 260,
        flightRot: (Math.random() - 0.5) * 45,
        primaryColor: palette.c1,
        accentColor: palette.c2,
        duration: 3.2 + Math.random() * 1.2,
      });
    }
    setButterflies(newBfs);

    const timer = setTimeout(() => {
      setButterflies([]);
    }, 4500);

    return () => clearTimeout(timer);
  }, [growthStage]);

  return (
    <div className="absolute inset-0 pointer-events-none z-15 overflow-hidden select-none">
      {/* 1. Realistic Radiant Sun with Solar Corona, Rays, Lens Flare & Fluffy White Clouds */}
      <BrightSunnySky stage={growthStage} />

      {/* 3. Heart-Shaped Shockwave Pulse */}
      <VectorHeartPulse stage={growthStage} />

      {/* 4. Fluttering Realistic 3D Butterflies */}
      {butterflies.map((bf) => (
        <VectorButterfly key={bf.id} {...bf} />
      ))}

      {/* 5. Lush Permanent Botanical Flower Meadow */}
      {persistentFlowers.length > 0 && (
        <div className="absolute bottom-0 left-0 right-0 h-48 sm:h-56 pointer-events-none z-15">
          {persistentFlowers.map((fl) => (
            <VectorFlower key={fl.id} flower={fl} />
          ))}
        </div>
      )}
    </div>
  );
}
