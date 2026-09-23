/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Calendar as CalendarIcon, Clock, ChevronLeft, ChevronRight, Check, Heart, ArrowLeft, Sparkles } from 'lucide-react';

interface DateTimeSectionProps {
  initialDate: string;
  initialTime: string;
  onSave: (date: string, time: string) => void;
  onCancel: () => void;
}

const TIME_SLOTS = [
  { time: '1:30 PM', label: 'Afternoon Spark', icon: '☀️' },
  { time: '5:00 PM', label: 'Golden Hour Walk', icon: '🌅' },
  { time: '7:00 PM', label: 'Classic Dinner Time', icon: '🕯️' },
  { time: '8:30 PM', label: 'Moonlit Evening', icon: '🌙' },
];

/** Formats Year, Month (0-indexed), Day into local 'YYYY-MM-DD' without UTC shift */
function formatLocalYMD(year: number, month: number, day: number): string {
  const m = String(month + 1).padStart(2, '0');
  const d = String(day).padStart(2, '0');
  return `${year}-${m}-${d}`;
}

/** Formats 'YYYY-MM-DD' into human-readable local date string */
function formatDisplayDate(ymd: string): string {
  if (!ymd) return '';
  const parts = ymd.split('-').map(Number);
  if (parts.length !== 3) return ymd;
  const [y, m, d] = parts;
  const dateObj = new Date(y, m - 1, d);
  return dateObj.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
}

export function DateTimeSection({
  initialDate,
  initialTime,
  onSave,
  onCancel
}: DateTimeSectionProps) {
  const today = new Date();
  const todayMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();

  // Initial date computation
  const defaultDateStr = initialDate || (() => {
    const nextDate = new Date();
    const day = nextDate.getDay();
    const diff = (5 - day + 7) % 7 || 7; // Next Friday
    nextDate.setDate(nextDate.getDate() + diff);
    return formatLocalYMD(nextDate.getFullYear(), nextDate.getMonth(), nextDate.getDate());
  })();

  const [selectedDate, setSelectedDate] = useState<string>(defaultDateStr);
  const [selectedTime, setSelectedTime] = useState<string>(initialTime || '7:00 PM');
  const [customTime, setCustomTime] = useState<string>('');
  const [isCustomTime, setIsCustomTime] = useState<boolean>(
    Boolean(initialTime && !TIME_SLOTS.some((s) => s.time === initialTime))
  );
  const [isClosing, setIsClosing] = useState<boolean>(false);

  // Month navigation state
  const initialDateParts = selectedDate.split('-').map(Number);
  const [currentMonth, setCurrentMonth] = useState<Date>(
    initialDateParts.length === 3
      ? new Date(initialDateParts[0], initialDateParts[1] - 1, 1)
      : new Date(today.getFullYear(), today.getMonth(), 1)
  );

  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();
  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const firstDayIndex = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const handlePrevMonth = () => {
    setCurrentMonth(new Date(year, month - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentMonth(new Date(year, month + 1, 1));
  };

  const handleDateClick = (dayNum: number) => {
    const checkDate = new Date(year, month, dayNum).getTime();
    if (checkDate < todayMidnight) return; // Prevent selecting past dates
    setSelectedDate(formatLocalYMD(year, month, dayNum));
  };

  const handleTriggerCancel = () => {
    setIsClosing(true);
    setTimeout(() => {
      onCancel();
    }, 380);
  };

  const handleTriggerSave = () => {
    const finalTime = isCustomTime && customTime.trim() ? customTime.trim() : selectedTime;
    setIsClosing(true);
    setTimeout(() => {
      onSave(selectedDate, finalTime);
    }, 380);
  };

  const readableDate = formatDisplayDate(selectedDate);
  const todayYMD = formatLocalYMD(today.getFullYear(), today.getMonth(), today.getDate());

  return (
    <div
      className={`w-full max-w-2xl bg-neutral-950/95 border border-[#FF2E7E]/40 rounded-3xl p-5 sm:p-7 shadow-[0_0_80px_rgba(255,46,126,0.4)] backdrop-blur-2xl text-white flex flex-col max-h-[90vh] ${
        isClosing ? 'animate-heart-shrink-back' : 'animate-heart-zoom-page'
      }`}
    >
      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b border-white/10 shrink-0">
        <button
          type="button"
          onClick={handleTriggerCancel}
          className="p-2 rounded-full hover:bg-white/10 text-white/70 hover:text-white transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="text-center">
          <div className="flex items-center justify-center gap-2">
            <Heart className="w-4 h-4 fill-[#FF2E7E] text-[#FF2E7E]" />
            <h2 className="text-lg sm:text-xl font-bold uppercase tracking-wider">Date & Time</h2>
          </div>
          <p className="text-xs text-white/60 mt-0.5">When are we going out?</p>
        </div>
        <div className="w-9" />
      </div>

      <div className="overflow-y-auto py-4 space-y-5 pr-1">
        {/* Selected Summary Pill */}
        <div className="flex items-center justify-between p-3.5 rounded-2xl bg-[#FF2E7E]/15 border border-[#FF2E7E]/40 text-xs">
          <div className="flex items-center gap-2">
            <CalendarIcon className="w-4 h-4 text-[#FF80BF]" />
            <span className="font-semibold text-white">{readableDate}</span>
          </div>
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-[#FF80BF]" />
            <span className="font-semibold text-white">
              {isCustomTime && customTime ? customTime : selectedTime}
            </span>
          </div>
        </div>

        {/* Calendar Grid Section */}
        <div className="p-4 rounded-2xl bg-white/5 border border-white/10">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold text-white tracking-wide">
              {monthNames[month]} {year}
            </h3>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={handlePrevMonth}
                className="p-1.5 rounded-lg hover:bg-white/10 text-white/80 hover:text-white cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={handleNextMonth}
                className="p-1.5 rounded-lg hover:bg-white/10 text-white/80 hover:text-white cursor-pointer"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Weekday headers */}
          <div className="grid grid-cols-7 gap-1 text-center mb-1">
            {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((d, i) => (
              <div key={i} className="text-[11px] font-bold text-white/40 py-1">
                {d}
              </div>
            ))}
          </div>

          {/* Calendar Days */}
          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: firstDayIndex }).map((_, i) => (
              <div key={`blank-${i}`} className="h-8 sm:h-9" />
            ))}

            {Array.from({ length: daysInMonth }).map((_, i) => {
              const dayNum = i + 1;
              const dateCheck = new Date(year, month, dayNum).getTime();
              const isPast = dateCheck < todayMidnight;
              const ymdStr = formatLocalYMD(year, month, dayNum);
              const isSelected = selectedDate === ymdStr;
              const isToday = todayYMD === ymdStr;

              return (
                <button
                  key={dayNum}
                  type="button"
                  disabled={isPast}
                  onClick={() => handleDateClick(dayNum)}
                  className={`h-8 sm:h-9 rounded-xl text-xs font-semibold flex items-center justify-center transition-all relative ${
                    isPast
                      ? 'opacity-25 text-white/30 cursor-not-allowed pointer-events-none line-through'
                      : isSelected
                      ? 'bg-[#FF2E7E] text-white shadow-lg shadow-[#FF2E7E]/50 font-bold scale-105 cursor-pointer'
                      : isToday
                      ? 'bg-white/20 text-white border border-white/40 cursor-pointer hover:bg-white/30'
                      : 'text-white/80 hover:bg-white/10 hover:text-white cursor-pointer'
                  }`}
                >
                  {dayNum}
                  {isSelected && (
                    <span className="absolute -top-1 -right-1 text-[9px]">💖</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Time Slots Section */}
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-white/80 mb-2.5 flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-[#FF80BF]" />
            <span>Select Time of Day</span>
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {TIME_SLOTS.map((slot) => {
              const isChosen = !isCustomTime && selectedTime === slot.time;
              return (
                <button
                  key={slot.time}
                  type="button"
                  onClick={() => {
                    setSelectedTime(slot.time);
                    setIsCustomTime(false);
                  }}
                  className={`p-3 rounded-2xl border text-center transition-all cursor-pointer flex flex-col items-center justify-center ${
                    isChosen
                      ? 'bg-[#FF2E7E]/30 border-[#FF2E7E] text-white shadow-[0_0_15px_rgba(255,46,126,0.4)]'
                      : 'bg-white/5 border-white/10 hover:bg-white/10 text-white/80'
                  }`}
                >
                  <span className="text-base mb-1">{slot.icon}</span>
                  <span className="font-bold text-xs sm:text-sm">{slot.time}</span>
                  <span className="text-[10px] text-white/60 mt-0.5">{slot.label}</span>
                </button>
              );
            })}
          </div>

          {/* Custom Time */}
          <div className="mt-3">
            <div
              onClick={() => setIsCustomTime(true)}
              className={`p-3 rounded-2xl border transition-all cursor-pointer flex items-center gap-3 ${
                isCustomTime
                  ? 'bg-[#FF2E7E]/20 border-[#FF2E7E]'
                  : 'bg-white/5 border-white/10 hover:bg-white/10'
              }`}
            >
              <Sparkles className="w-4 h-4 text-[#FF80BF] shrink-0" />
              <input
                type="time"
                value={customTime}
                onChange={(e) => {
                  setCustomTime(e.target.value);
                  setIsCustomTime(true);
                }}
                onFocus={() => setIsCustomTime(true)}
                className="bg-black/60 border border-white/20 px-3 py-1.5 rounded-xl text-white text-xs focus:outline-none focus:border-[#FF2E7E]"
              />
              <span className="text-[11px] text-white/60">Custom exact time</span>
            </div>
          </div>
        </div>
      </div>

      {/* Footer / Save Button */}
      <div className="pt-4 border-t border-white/10 flex items-center justify-end gap-3 shrink-0">
        <button
          type="button"
          onClick={handleTriggerCancel}
          className="px-5 py-2.5 rounded-full text-xs font-semibold text-white/70 hover:text-white transition-colors cursor-pointer"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleTriggerSave}
          className="px-7 py-2.5 rounded-full bg-[#FF2E7E] hover:bg-[#ff156e] active:scale-95 text-white font-bold text-xs uppercase tracking-widest transition-all duration-200 shadow-lg shadow-[#FF2E7E]/40 flex items-center gap-2 cursor-pointer"
        >
          <Check className="w-4 h-4" />
          <span>Save</span>
        </button>
      </div>
    </div>
  );
}
