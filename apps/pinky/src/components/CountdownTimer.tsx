import React, { useEffect, useState } from 'react';

interface CountdownTimerProps {
  targetDate: string;
  className?: string;
}

export const CountdownTimer: React.FC<CountdownTimerProps> = ({ targetDate, className = '' }) => {
  const [timeLeft, setTimeLeft] = useState<{
    days: number;
    hours: number;
    minutes: number;
    seconds: number;
    isPast: boolean;
  }>({ days: 0, hours: 0, minutes: 0, seconds: 0, isPast: false });

  useEffect(() => {
    const calculateTime = () => {
      const difference = +new Date(targetDate) - +new Date();
      if (difference <= 0) {
        setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0, isPast: true });
        return;
      }

      setTimeLeft({
        days: Math.floor(difference / (1000 * 60 * 60 * 24)),
        hours: Math.floor((difference / (1000 * 60 * 60)) % 24),
        minutes: Math.floor((difference / 1000 / 60) % 60),
        seconds: Math.floor((difference / 1000) % 60),
        isPast: false
      });
    };

    calculateTime();
    const timer = setInterval(calculateTime, 1000);
    return () => clearInterval(timer);
  }, [targetDate]);

  if (timeLeft.isPast) {
    return (
      <div id="countdown-timer-past" className={`text-xs uppercase tracking-[0.2em] text-[#F27D26] font-bold ${className}`}>
        Today's the date!
      </div>
    );
  }

  return (
    <div id="countdown-timer-active" className={`flex items-center gap-2 ${className}`}>
      <div className="flex flex-col items-center">
        <span className="text-sm font-bold tracking-tight font-display text-white">
          {timeLeft.days.toString().padStart(2, '0')}
        </span>
        <span className="text-[9px] uppercase tracking-wider text-white/40">days</span>
      </div>
      <span className="text-white/30 font-light pb-2">:</span>
      <div className="flex flex-col items-center">
        <span className="text-sm font-bold tracking-tight font-display text-white">
          {timeLeft.hours.toString().padStart(2, '0')}
        </span>
        <span className="text-[9px] uppercase tracking-wider text-white/40">hrs</span>
      </div>
      <span className="text-white/30 font-light pb-2">:</span>
      <div className="flex flex-col items-center">
        <span className="text-sm font-bold tracking-tight font-display text-white">
          {timeLeft.minutes.toString().padStart(2, '0')}
        </span>
        <span className="text-[9px] uppercase tracking-wider text-white/40">min</span>
      </div>
      <span className="text-white/30 font-light pb-2">:</span>
      <div className="flex flex-col items-center">
        <span className="text-sm font-bold tracking-tight font-display text-[#F27D26] tabular-nums">
          {timeLeft.seconds.toString().padStart(2, '0')}
        </span>
        <span className="text-[9px] uppercase tracking-wider text-white/40">sec</span>
      </div>
    </div>
  );
};
