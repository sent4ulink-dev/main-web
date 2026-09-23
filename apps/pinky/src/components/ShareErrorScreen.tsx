import React from 'react';
import { HeartCrack } from 'lucide-react';

interface ShareErrorScreenProps {
  message: string;
}

export const ShareErrorScreen: React.FC<ShareErrorScreenProps> = ({ message }) => (
  <div className="h-[100dvh] w-full bg-black text-white flex flex-col items-center justify-center p-6 text-center gap-4">
    <HeartCrack className="w-12 h-12 text-[#FF2E7E]" />
    <h1 className="text-lg font-bold uppercase tracking-wider">This link isn't working</h1>
    <p className="text-sm text-white/60 max-w-xs">{message}</p>
  </div>
);
