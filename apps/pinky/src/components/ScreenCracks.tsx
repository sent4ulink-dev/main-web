/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';

interface ScreenCracksProps {
  stage: number; // 0 to 10
}

export function ScreenCracks({ stage }: ScreenCracksProps) {
  if (stage <= 0) return null;

  // Opacity scales with intensity
  const opacity = Math.min(1, 0.45 + stage * 0.06);

  return (
    <div className="absolute inset-0 pointer-events-none z-15 overflow-hidden select-none">
      <svg
        className="w-full h-full"
        viewBox="0 0 1000 1000"
        preserveAspectRatio="none"
        style={{ opacity, transition: 'opacity 0.4s ease' }}
      >
        <defs>
          {/* Glass specular sheen filter */}
          <filter id="glass-fissure-glow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="0" stdDeviation="1.5" floodColor="#ffffff" floodOpacity="0.9" />
            <feDropShadow dx="1" dy="1" stdDeviation="3" floodColor="#00d2ff" floodOpacity="0.3" />
          </filter>

          {/* Dark fracture shadow for depth */}
          <filter id="crack-shadow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="1" dy="2" stdDeviation="2" floodColor="#000000" floodOpacity="0.9" />
          </filter>

          {/* Glass shard gradients */}
          <linearGradient id="shard-specular-1" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.35" />
            <stop offset="40%" stopColor="#ffffff" stopOpacity="0.08" />
            <stop offset="100%" stopColor="#000000" stopOpacity="0.4" />
          </linearGradient>

          <linearGradient id="shard-specular-2" x1="100%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.4" />
            <stop offset="60%" stopColor="#66ccff" stopOpacity="0.1" />
            <stop offset="100%" stopColor="#000000" stopOpacity="0.5" />
          </linearGradient>

          <radialGradient id="impact-core-gradient" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="1" />
            <stop offset="25%" stopColor="#e0f7fa" stopOpacity="0.8" />
            <stop offset="70%" stopColor="#ffffff" stopOpacity="0.15" />
            <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* --- STAGE 1+: PRIMARY IMPACT POINT & FRACTURE LINES --- */}
        {stage >= 1 && (
          <g filter="url(#glass-fissure-glow)">
            {/* Impact Core Shaded Web */}
            <path
              d="M 500,500 L 460,420 L 410,380 L 320,310 L 210,240 L 90,180 L 0,150"
              stroke="#ffffff"
              strokeWidth="2.4"
              fill="none"
              strokeLinecap="round"
            />
            <path
              d="M 500,500 L 580,430 L 690,360 L 810,290 L 940,240 L 1000,210"
              stroke="#ffffff"
              strokeWidth="2.2"
              fill="none"
              strokeLinecap="round"
            />
            <path
              d="M 500,500 L 450,590 L 370,710 L 280,820 L 170,920 L 80,1000"
              stroke="#ffffff"
              strokeWidth="2.4"
              fill="none"
              strokeLinecap="round"
            />
            <path
              d="M 500,500 L 590,580 L 710,690 L 820,780 L 930,890 L 1000,940"
              stroke="#ffffff"
              strokeWidth="2.2"
              fill="none"
              strokeLinecap="round"
            />
          </g>
        )}

        {/* --- STAGE 2+: SECONDARY JAGGED CRACKS & RADIAL SPLINTERS --- */}
        {stage >= 2 && (
          <g stroke="#ffffff" strokeLinecap="round" opacity="0.95">
            <path d="M 460,420 L 520,340 L 560,220 L 580,110 L 590,0" strokeWidth="1.8" fill="none" />
            <path d="M 410,380 L 330,420 L 220,440 L 110,430 L 0,420" strokeWidth="1.7" fill="none" />
            <path d="M 580,430 L 650,470 L 780,480 L 890,460 L 1000,450" strokeWidth="1.8" fill="none" />
            <path d="M 450,590 L 490,680 L 510,790 L 500,910 L 510,1000" strokeWidth="1.7" fill="none" />
            <path d="M 370,710 L 430,760 L 470,850 L 460,980" strokeWidth="1.5" fill="none" />
            <path d="M 590,580 L 660,560 L 790,580 L 900,610 L 1000,630" strokeWidth="1.6" fill="none" />
          </g>
        )}

        {/* --- STAGE 3+: CONCENTRIC STRESS RINGS & SPIDERWEB FRACTURES --- */}
        {stage >= 3 && (
          <g stroke="rgba(255, 255, 255, 0.85)" strokeWidth="1.4" fill="none" strokeLinecap="round">
            {/* Inner Ring */}
            <path d="M 460,450 Q 500,420 540,450 Q 560,500 540,550 Q 500,570 460,550 Q 440,500 460,450 Z" strokeDasharray="6,3" />
            {/* Mid Ring */}
            <path d="M 390,390 Q 500,330 610,390 Q 670,500 610,610 Q 500,670 390,610 Q 330,500 390,390 Z" strokeDasharray="8,4" />
            {/* Splinter micro-lines */}
            <path d="M 460,450 L 410,480 L 360,490" />
            <path d="M 540,450 L 600,470 L 660,460" />
            <path d="M 540,550 L 580,610 L 620,680" />
            <path d="M 460,550 L 420,610 L 370,670" />
          </g>
        )}

        {/* --- STAGE 5+: DENSE SPIDER CRACK WEB & GLASS FRACTURE SHARDS --- */}
        {stage >= 5 && (
          <g>
            {/* Large Outer Stress Ring */}
            <path
              d="M 280,280 Q 500,180 720,280 Q 820,500 720,720 Q 500,820 280,720 Q 180,500 280,280 Z"
              stroke="rgba(255, 255, 255, 0.8)"
              strokeWidth="1.6"
              fill="none"
              strokeDasharray="10,5"
            />
            {/* Secondary web branches */}
            <g stroke="rgba(255, 255, 255, 0.75)" strokeWidth="1.2" fill="none">
              <path d="M 320,310 L 260,240 L 190,160 L 130,80" />
              <path d="M 690,360 L 760,280 L 830,190 L 910,120" />
              <path d="M 710,690 L 800,770 L 880,860 L 960,940" />
              <path d="M 280,820 L 210,890 L 140,950" />
            </g>

            {/* Faceted Translucent Glass Shard Polygons */}
            <polygon points="490,480 530,460 520,510 470,520" fill="url(#shard-specular-1)" stroke="#ffffff" strokeWidth="1.2" />
            <polygon points="450,450 490,410 520,440 480,470" fill="url(#shard-specular-2)" stroke="#ffffff" strokeWidth="1.2" />
            <polygon points="530,470 580,450 570,520 520,520" fill="url(#shard-specular-1)" stroke="#ffffff" strokeWidth="1.2" />
            <polygon points="460,530 520,530 500,580 440,560" fill="url(#shard-specular-2)" stroke="#ffffff" strokeWidth="1.2" />
          </g>
        )}

        {/* --- STAGE 7+: CATASTROPHIC GLASS SHATTERING WITH REFRACTIVE EDGES --- */}
        {stage >= 7 && (
          <g>
            {/* Additional heavy fractures */}
            <g stroke="#ffffff" strokeWidth="1.8" fill="none" strokeLinecap="round" filter="url(#glass-fissure-glow)">
              <path d="M 500,500 L 430,340 L 320,180 L 250,50" />
              <path d="M 500,500 L 610,340 L 750,190 L 870,70" />
              <path d="M 500,500 L 340,600 L 180,720 L 50,830" />
              <path d="M 500,500 L 670,620 L 830,730 L 960,820" />
            </g>

            {/* Jagged Displaced Shards with specular highlights */}
            <polygon points="410,380 460,340 470,410 420,430" fill="url(#shard-specular-1)" stroke="#ffffff" strokeWidth="1.5" />
            <polygon points="580,430 640,390 650,460 590,480" fill="url(#shard-specular-2)" stroke="#ffffff" strokeWidth="1.5" />
            <polygon points="370,580 430,600 400,670 340,630" fill="url(#shard-specular-1)" stroke="#ffffff" strokeWidth="1.5" />
            <polygon points="570,580 630,560 660,630 600,650" fill="url(#shard-specular-2)" stroke="#ffffff" strokeWidth="1.5" />
            <polygon points="320,460 380,450 370,520 310,510" fill="url(#shard-specular-2)" stroke="#ffffff" strokeWidth="1.5" />
            <polygon points="620,470 680,460 690,530 630,520" fill="url(#shard-specular-1)" stroke="#ffffff" strokeWidth="1.5" />

            {/* Micro splinter particles */}
            <circle cx="480" cy="460" r="2.5" fill="#ffffff" filter="url(#glass-fissure-glow)" />
            <circle cx="530" cy="440" r="2" fill="#ffffff" />
            <circle cx="540" cy="520" r="3" fill="#ffffff" filter="url(#glass-fissure-glow)" />
            <circle cx="450" cy="540" r="2" fill="#ffffff" />
            <circle cx="410" cy="490" r="2.5" fill="#ffffff" />
            <circle cx="590" cy="490" r="2.5" fill="#ffffff" />
            <circle cx="490" cy="570" r="3" fill="#ffffff" filter="url(#glass-fissure-glow)" />
          </g>
        )}

        {/* --- CENTRAL IMPACT BULLET/POINT CRATER --- */}
        <circle cx="500" cy="500" r={Math.min(38, 12 + stage * 2.8)} fill="url(#impact-core-gradient)" />
        <circle cx="500" cy="500" r={Math.min(18, 4 + stage * 1.5)} fill="#ffffff" filter="url(#glass-fissure-glow)" />
        <circle cx="500" cy="500" r={Math.min(8, 2 + stage * 0.7)} fill="#000000" opacity="0.6" />
      </svg>
    </div>
  );
}
