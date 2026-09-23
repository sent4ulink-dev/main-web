import React, { useState } from 'react';
import { motion, useMotionValue, useTransform, useAnimation, PanInfo } from 'motion/react';
import { Invitation } from '../types';
import { CardFlipDetails } from './CardFlipDetails';
import { CountdownTimer } from './CountdownTimer';
import { 
  Heart, 
  X, 
  MapPin, 
  Calendar as CalendarIcon, 
  Sparkles, 
  Info,
  Clock
} from 'lucide-react';

interface GestureCardProps {
  invitation: Invitation;
  onSwipe: (status: 'yes' | 'no', preferences: Record<string, string>) => void;
  onViewAnalytics: () => void;
}

export const GestureCard: React.FC<GestureCardProps> = ({
  invitation,
  onSwipe,
}) => {
  const [isFlipped, setIsFlipped] = useState(false);
  const [selectedPreferences, setSelectedPreferences] = useState<Record<string, string>>({});
  
  const x = useMotionValue(0);
  const controls = useAnimation();

  // Rotation based on drag displacement
  const rotate = useTransform(x, [-250, 0, 250], [-18, 0, 18]);
  
  // Opacity for Yes / No badges and glow halos
  const yesOpacity = useTransform(x, [20, 120], [0, 1]);
  const noOpacity = useTransform(x, [-20, -120], [0, 1]);
  
  // Scale of response stamps
  const yesScale = useTransform(x, [20, 120], [0.8, 1.15]);
  const noScale = useTransform(x, [-20, -120], [0.8, 1.15]);

  // Dynamic glow border color based on swipe direction
  const glowColor = useTransform(
    x,
    [-150, 0, 150],
    ['rgba(255, 255, 255, 0.4)', 'rgba(255, 255, 255, 0.1)', 'rgba(242, 125, 38, 0.8)']
  );

  const handleDragEnd = async (_: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    const threshold = 110;
    const velocityThreshold = 400;

    if (info.offset.x > threshold || info.velocity.x > velocityThreshold) {
      // Swiped YES (Right)
      await controls.start({
        x: 450,
        rotate: 25,
        opacity: 0,
        transition: { duration: 0.35, ease: 'easeOut' }
      });
      onSwipe('yes', selectedPreferences);
    } else if (info.offset.x < -threshold || info.velocity.x < -velocityThreshold) {
      // Swiped NO (Left)
      await controls.start({
        x: -450,
        rotate: -25,
        opacity: 0,
        transition: { duration: 0.35, ease: 'easeOut' }
      });
      onSwipe('no', selectedPreferences);
    } else {
      // Spring back to center
      controls.start({
        x: 0,
        rotate: 0,
        transition: { type: 'spring', stiffness: 350, damping: 25 }
      });
    }
  };

  const triggerButtonSwipe = async (status: 'yes' | 'no') => {
    const targetX = status === 'yes' ? 450 : -450;
    const targetRotate = status === 'yes' ? 25 : -25;
    
    await controls.start({
      x: targetX,
      rotate: targetRotate,
      opacity: 0,
      transition: { duration: 0.35, ease: 'easeOut' }
    });
    onSwipe(status, selectedPreferences);
  };

  const handlePreferenceSelect = (questionId: string, option: string) => {
    setSelectedPreferences((prev) => ({
      ...prev,
      [questionId]: option
    }));
  };

  const formattedDate = new Date(invitation.date).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric'
  });

  const formattedTime = new Date(invitation.date).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit'
  });

  return (
    <div id="gesture-card-wrapper" className="relative w-full max-w-[370px] sm:max-w-[400px] h-[590px] sm:h-[630px] mx-auto perspective-1000 select-none">
      {/* 3D Card Flip Container */}
      <motion.div
        animate={{ rotateY: isFlipped ? 180 : 0 }}
        transition={{ duration: 0.6, type: 'spring', stiffness: 260, damping: 25 }}
        className="w-full h-full preserve-3d relative"
      >
        {/* FRONT OF THE CARD (Gesture / Swipeable surface) */}
        <motion.div
          id="gesture-card-front"
          drag={!isFlipped ? 'x' : false}
          dragConstraints={{ left: 0, right: 0 }}
          dragElastic={0.8}
          onDragEnd={handleDragEnd}
          animate={controls}
          style={{ x, rotate, borderColor: glowColor }}
          className="absolute inset-0 backface-hidden w-full h-full rounded-2xl overflow-hidden bg-[#0a0a0a] border-2 border-white/15 shadow-2xl cursor-grab active:cursor-grabbing flex flex-col justify-between"
        >
          {/* Background Imagery with Subtle Vignette & Gradient */}
          <div className="absolute inset-0 pointer-events-none">
            <img
              src={invitation.coverImage || 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=1000&q=80'}
              alt={invitation.title}
              className="w-full h-3/5 object-cover opacity-80"
              referrerPolicy="no-referrer"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a0a] via-[#0a0a0a]/85 to-transparent" />
          </div>

          {/* Swipe Stamp Indicators (Dynamic physical feedback) */}
          <div className="absolute inset-x-4 top-6 flex justify-between pointer-events-none z-30">
            {/* NO Stamp */}
            <motion.div
              style={{ opacity: noOpacity, scale: noScale }}
              className="px-4 py-2 rounded-lg bg-black/95 border-2 border-white/80 text-white font-bold uppercase tracking-widest text-xs shadow-2xl rotate-[-12deg] backdrop-blur-md flex items-center gap-2"
            >
              <X className="w-4 h-4 text-white" />
              <span>Pass</span>
            </motion.div>

            {/* YES Stamp */}
            <motion.div
              style={{ opacity: yesOpacity, scale: yesScale }}
              className="px-5 py-2 rounded-lg bg-[#F27D26] border-2 border-white text-black font-extrabold uppercase tracking-widest text-xs shadow-2xl rotate-[12deg] backdrop-blur-md flex items-center gap-2"
            >
              <Heart className="w-4 h-4 fill-black text-black" />
              <span>Attending</span>
            </motion.div>
          </div>

          {/* Card Top Nav */}
          <div className="relative z-20 p-5 flex items-center justify-between">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-black/80 backdrop-blur-md border border-white/15 text-xs text-white uppercase tracking-wider">
              <Sparkles className="w-3.5 h-3.5 text-[#F27D26]" />
              <span className="font-semibold text-[11px]">By {invitation.hostName}</span>
            </div>

            {/* Card Flip Button */}
            <button
              id="btn-flip-details"
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setIsFlipped(true);
              }}
              className="h-8 px-3 rounded-lg bg-black/80 hover:bg-black backdrop-blur-md border border-white/15 flex items-center gap-1.5 text-white/80 hover:text-white transition-all shadow-md active:scale-95 text-[11px] uppercase tracking-wider font-semibold"
              title="View Itinerary & Details"
            >
              <Info className="w-3.5 h-3.5 text-[#F27D26]" />
              <span>Details</span>
            </button>
          </div>

          {/* Card Body & Details */}
          <div className="relative z-20 p-6 space-y-4">
            {/* Countdown Badge */}
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-[0.25em] text-[#F27D26] bg-[#F27D26]/10 border border-[#F27D26]/30 px-3 py-1 rounded-md">
                {invitation.vibe} Experience
              </span>
              <CountdownTimer targetDate={invitation.date} />
            </div>

            {/* Title & Description */}
            <div className="space-y-2">
              <h1 className="text-3xl sm:text-4xl font-serif-display font-bold text-white tracking-tight leading-tight">
                {invitation.title}
              </h1>
              <p className="text-xs text-white/70 line-clamp-2 leading-relaxed font-editorial-body">
                {invitation.description}
              </p>
            </div>

            {/* Date, Time, Location Strip */}
            <div className="p-3.5 rounded-xl bg-white/[0.04] border border-white/10 backdrop-blur-md space-y-2">
              <div className="flex items-center justify-between text-xs text-white">
                <div className="flex items-center gap-2">
                  <CalendarIcon className="w-3.5 h-3.5 text-[#F27D26] shrink-0" />
                  <span className="font-semibold uppercase tracking-wider text-[11px]">{formattedDate}</span>
                </div>
                <div className="flex items-center gap-1.5 text-white/60 font-mono text-[11px]">
                  <Clock className="w-3 h-3 text-[#F27D26]" />
                  <span>{formattedTime}</span>
                </div>
              </div>

              <div className="flex items-center gap-2 text-xs text-white/80 pt-1.5 border-t border-white/10">
                <MapPin className="w-3.5 h-3.5 text-[#F27D26] shrink-0" />
                <span className="truncate text-[11px] uppercase tracking-wide">{invitation.location}</span>
              </div>
            </div>

            {/* Tactile Response Controls */}
            <div className="pt-2 flex items-center justify-center gap-6">
              {/* Decline Button */}
              <button
                id="btn-gesture-decline"
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  triggerButtonSwipe('no');
                }}
                className="w-13 h-13 rounded-xl bg-white/5 border border-white/15 text-white/60 hover:text-white hover:border-white/40 hover:scale-105 active:scale-95 transition-all flex items-center justify-center shadow-lg cursor-pointer"
                title="Decline / Pass"
              >
                <X className="w-5 h-5" />
              </button>

              {/* Itinerary Flip Pill */}
              <button
                id="btn-flip-pill"
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsFlipped(true);
                }}
                className="px-4 py-2.5 rounded-xl bg-white/5 border border-white/15 text-white/80 hover:text-white text-[11px] font-semibold uppercase tracking-wider flex items-center gap-2 transition-all hover:border-white/30"
              >
                <Info className="w-3.5 h-3.5 text-[#F27D26]" />
                <span>Flip Card</span>
              </button>

              {/* Accept Heart Button */}
              <button
                id="btn-gesture-accept"
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  triggerButtonSwipe('yes');
                }}
                className="w-13 h-13 rounded-xl bg-[#F27D26] border border-white/30 text-black hover:scale-105 active:scale-95 transition-all flex items-center justify-center shadow-lg shadow-[#F27D26]/30 cursor-pointer font-bold"
                title="Accept / Say Yes!"
              >
                <Heart className="w-5 h-5 fill-black text-black" />
              </button>
            </div>
          </div>
        </motion.div>

        {/* BACK OF THE CARD (Detailed Itinerary, Secrets, Attire, Map) */}
        <div 
          id="gesture-card-back" 
          className="absolute inset-0 backface-hidden rotate-y-180 w-full h-full"
        >
          <CardFlipDetails
            invitation={invitation}
            selectedPreferences={selectedPreferences}
            onSelectPreference={handlePreferenceSelect}
            onFlipBack={() => setIsFlipped(false)}
          />
        </div>
      </motion.div>
    </div>
  );
};
