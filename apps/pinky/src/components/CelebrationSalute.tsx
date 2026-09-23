/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';

interface EmojiParticle {
  id: number;
  emoji: string;
  x: number; // percentage
  y: number; // percentage
  size: number; // px
  rotation: number; // deg
  vx: number;
  vy: number;
  delay: number;
  duration: number;
}

const CELEBRATION_EMOJIS = ['💖', '🧸', '🌹', '✨', '💘', '💌', '🌸', '🥰', '🍫', '💕', '💍', '🎉', '💐', '❤️‍🔥'];

export function CelebrationSalute() {
  const [particles, setParticles] = useState<EmojiParticle[]>([]);

  useEffect(() => {
    const count = 56;
    const items: EmojiParticle[] = [];

    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.4;
      const velocity = 150 + Math.random() * 320;
      const vx = Math.cos(angle) * velocity;
      const vy = Math.sin(angle) * velocity - 100;

      items.push({
        id: i,
        emoji: CELEBRATION_EMOJIS[i % CELEBRATION_EMOJIS.length],
        x: 50 + (Math.random() - 0.5) * 8,
        y: 50 + (Math.random() - 0.5) * 8,
        size: 26 + Math.floor(Math.random() * 24),
        rotation: (Math.random() - 0.5) * 90,
        vx,
        vy,
        delay: Math.random() * 0.15,
        duration: 2.2 + Math.random() * 1.3,
      });
    }

    setParticles(items);
  }, []);

  return (
    <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden select-none">
      {particles.map((p) => (
        <div
          key={p.id}
          className="absolute animate-float-salute select-none"
          style={
            {
              left: `${p.x}%`,
              top: `${p.y}%`,
              fontSize: `${p.size}px`,
              '--target-x': `${p.vx}px`,
              '--target-y': `${p.vy - 320}px`,
              '--target-rotate': `${p.rotation + (Math.random() > 0.5 ? 180 : -180)}deg`,
              animationDelay: `${p.delay}s`,
              animationDuration: `${p.duration}s`,
            } as React.CSSProperties
          }
        >
          {p.emoji}
        </div>
      ))}
    </div>
  );
}
