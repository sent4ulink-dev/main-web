import React, { useState } from 'react';
import { Invitation, DateVibe, ThemeColor } from '../types';
import { 
  X, 
  Sparkles, 
  Calendar, 
  MapPin, 
  Clock, 
  Plus, 
  Trash2, 
  Shirt, 
  Heart,
  Image as ImageIcon
} from 'lucide-react';

interface CreateInviteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (newInvite: Invitation) => void;
}

const PRESET_IDEAS = [
  {
    title: 'Matcha Latte & Modern Art Stroll',
    vibe: 'chill' as DateVibe,
    themeColor: 'emerald' as ThemeColor,
    description: 'Ceremonial grade matcha, gallery wandering, and discussing our favorite weird art pieces.',
    location: 'Sora Matcha Bar & Contemporary Arts Center',
    dressCode: 'Artsy casual / comfortable sneakers',
    coverImage: 'https://images.unsplash.com/photo-1579783900882-c0d3dad7b119?auto=format&fit=crop&w=1000&q=80',
    itinerary: [
      { time: '2:00 PM', activity: 'Matcha & Pastries', detail: 'Oat milk matcha & yuzu croissants' },
      { time: '3:00 PM', activity: 'Sculpture Garden & Gallery', detail: 'Exhibitions & polaroid photos' },
      { time: '4:30 PM', activity: 'Bookstore Browsing', detail: 'Picking a poetry or photo book' }
    ],
    question: {
      id: 'matcha',
      question: 'Sweetness level?',
      options: ['Unsweetened Earthy', 'Light Vanilla Oat', 'Strawberry Matcha', 'Surprise me']
    }
  },
  {
    title: 'Midnight Ramen & Speakeasy Vinyl',
    vibe: 'romantic' as DateVibe,
    themeColor: 'rose' as ThemeColor,
    description: 'Steamy tonkotsu broth, secret vinyl listening bar, and vintage records late into the evening.',
    location: 'Bar Tokyo & Oishii Ramen Lane',
    dressCode: 'Sleek dark tones',
    coverImage: 'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?auto=format&fit=crop&w=1000&q=80',
    itinerary: [
      { time: '8:30 PM', activity: 'Tonkotsu Ramen & Gyoza', detail: 'Rich broth & crispy chili oil' },
      { time: '9:45 PM', activity: 'Vinyl Listening Lounge', detail: 'Japanese whisky & high-fidelity jazz' }
    ],
    question: {
      id: 'spice',
      question: 'Broth spice tolerance?',
      options: ['Mild & Creamy', 'Medium Kick', 'Fire Dragon 🌶️', 'Vegetarian Miso']
    }
  },
  {
    title: 'Sunset Rooftop & Acoustic Melodies',
    vibe: 'luxurious' as DateVibe,
    themeColor: 'amber' as ThemeColor,
    description: 'City skyline at twilight, chilled sparkling wine, artisan tapas, and golden hour vibes.',
    location: 'The Horizon Terrace, Penthouse 40',
    dressCode: 'Smart chic & cocktail attire',
    coverImage: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=1000&q=80',
    itinerary: [
      { time: '6:30 PM', activity: 'Welcome Champagne & Sunset', detail: 'Catching golden hour over skyline' },
      { time: '7:30 PM', activity: 'Chef Tapas Tasting', detail: 'Truffles, burrata, and scallops' }
    ],
    question: {
      id: 'drink_pref',
      question: 'Evening toast preference?',
      options: ['Sparkling Brut', 'Rosé', 'Paloma Mocktail', 'Gin & Elderflower']
    }
  }
];

export const CreateInviteModal: React.FC<CreateInviteModalProps> = ({
  isOpen,
  onClose,
  onSave,
}) => {
  const [title, setTitle] = useState('');
  const [hostName, setHostName] = useState('');
  const [date, setDate] = useState(() => {
    const d = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
    d.setHours(19, 0, 0, 0);
    return d.toISOString().slice(0, 16);
  });
  const [location, setLocation] = useState('');
  const [locationDetails, setLocationDetails] = useState('');
  const [description, setDescription] = useState('');
  const [dressCode, setDressCode] = useState('Smart Casual');
  const [vibe, setVibe] = useState<DateVibe>('romantic');
  const [themeColor, setThemeColor] = useState<ThemeColor>('rose');
  const [coverImage, setCoverImage] = useState('https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=1000&q=80');
  
  const [itinerary, setItinerary] = useState<Array<{ time: string; activity: string; detail?: string }>>([
    { time: '7:00 PM', activity: 'Meet & Welcome drinks', detail: 'Cozy lounge table' },
    { time: '8:30 PM', activity: 'Dinner & Conversation', detail: 'Good food & music' }
  ]);

  const [questionText, setQuestionText] = useState('What should we toast with?');
  const [optionsText, setOptionsText] = useState('Cocktails, Wine, Mocktails, Surprise Me');

  if (!isOpen) return null;

  const applyPreset = (preset: typeof PRESET_IDEAS[0]) => {
    setTitle(preset.title);
    setVibe(preset.vibe);
    setThemeColor(preset.themeColor);
    setDescription(preset.description);
    setLocation(preset.location);
    setDressCode(preset.dressCode);
    setCoverImage(preset.coverImage);
    setItinerary(preset.itinerary);
    if (preset.question) {
      setQuestionText(preset.question.question);
      setOptionsText(preset.question.options.join(', '));
    }
  };

  const handleAddItineraryRow = () => {
    setItinerary([...itinerary, { time: '9:30 PM', activity: 'Night walk / dessert', detail: '' }]);
  };

  const handleRemoveItineraryRow = (index: number) => {
    setItinerary(itinerary.filter((_, i) => i !== index));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !hostName.trim()) return;

    const startDate = new Date(date);
    const endDate = new Date(startDate.getTime() + 3 * 60 * 60 * 1000);

    const optionsArray = optionsText
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    const newInvite: Invitation = {
      id: `invite-${Date.now()}`,
      title: title.trim(),
      hostName: hostName.trim(),
      guestName: 'You',
      date: startDate.toISOString(),
      endDate: endDate.toISOString(),
      location: location.trim() || 'A cozy spot in town',
      locationDetails: locationDetails.trim(),
      description: description.trim() || 'Looking forward to spending quality time together.',
      dressCode: dressCode.trim(),
      vibe,
      themeColor,
      coverImage: coverImage.trim(),
      itinerary: itinerary.filter((i) => i.activity.trim().length > 0),
      questions: questionText.trim() && optionsArray.length > 0
        ? [
            {
              id: `q-${Date.now()}`,
              question: questionText.trim(),
              options: optionsArray
            }
          ]
        : [],
      createdAt: new Date().toISOString(),
      viewsCount: 1,
      responses: []
    };

    onSave(newInvite);
    onClose();
  };

  return (
    <div id="create-invite-modal" className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xl overflow-y-auto select-none">
      <div className="w-full max-w-xl my-8 bg-[#0a0a0a] border-2 border-white/15 rounded-2xl p-6 sm:p-8 text-white shadow-2xl space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-white/10">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-[#F27D26]" />
            <h3 className="text-2xl font-serif-display font-bold text-white tracking-tight">
              Craft Date Invitation
            </h3>
          </div>
          <button
            id="btn-close-modal"
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center text-white/60 hover:text-white transition-colors border border-white/10"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Preset Quick Starters */}
        <div className="space-y-2">
          <span className="text-[10px] font-bold uppercase tracking-[0.25em] text-white/50">
            Inspiration Presets:
          </span>
          <div className="flex flex-wrap gap-2">
            {PRESET_IDEAS.map((preset) => (
              <button
                key={preset.title}
                type="button"
                onClick={() => applyPreset(preset)}
                className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-xs uppercase tracking-wider text-white/80 hover:text-white transition-all flex items-center gap-1.5"
              >
                <Heart className="w-3 h-3 text-[#F27D26]" />
                <span>{preset.title.split('&')[0]}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Form Fields */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-white/70">Host Name</label>
              <input
                type="text"
                required
                value={hostName}
                onChange={(e) => setHostName(e.target.value)}
                placeholder="e.g. Julian, Maya"
                className="w-full p-2.5 rounded-lg bg-white/[0.04] border border-white/15 focus:border-[#F27D26] text-xs text-white outline-none uppercase tracking-wide"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-white/70">Date Title</label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Sunset Rooftop Tasting"
                className="w-full p-2.5 rounded-lg bg-white/[0.04] border border-white/15 focus:border-[#F27D26] text-xs text-white outline-none uppercase tracking-wide"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-white/70 flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-[#F27D26]" />
                Date & Time
              </label>
              <input
                type="datetime-local"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full p-2.5 rounded-lg bg-white/[0.04] border border-white/15 focus:border-[#F27D26] text-xs text-white outline-none"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-white/70 flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5 text-[#F27D26]" />
                Location
              </label>
              <input
                type="text"
                required
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="e.g. Horizon Rooftop Bar"
                className="w-full p-2.5 rounded-lg bg-white/[0.04] border border-white/15 focus:border-[#F27D26] text-xs text-white outline-none uppercase tracking-wide"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-white/70">Invitation Note</label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What makes this date special?"
              className="w-full p-2.5 rounded-lg bg-white/[0.04] border border-white/15 focus:border-[#F27D26] text-xs text-white outline-none resize-none font-editorial-body"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-white/70 flex items-center gap-1">
                <Shirt className="w-3.5 h-3.5 text-[#F27D26]" />
                Dress Code
              </label>
              <input
                type="text"
                value={dressCode}
                onChange={(e) => setDressCode(e.target.value)}
                placeholder="e.g. Sleek dark tones"
                className="w-full p-2.5 rounded-lg bg-white/[0.04] border border-white/15 text-xs text-white outline-none uppercase tracking-wide"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-white/70">Vibe</label>
              <select
                value={vibe}
                onChange={(e) => setVibe(e.target.value as DateVibe)}
                className="w-full p-2.5 rounded-lg bg-black border border-white/15 text-xs text-white outline-none uppercase tracking-wide"
              >
                <option value="romantic">Romantic</option>
                <option value="chill">Chill & Cozy</option>
                <option value="adventurous">Adventurous</option>
                <option value="playful">Playful & Fun</option>
                <option value="luxurious">Luxurious</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-white/70 flex items-center gap-1">
                <ImageIcon className="w-3.5 h-3.5 text-[#F27D26]" />
                Cover URL
              </label>
              <input
                type="url"
                value={coverImage}
                onChange={(e) => setCoverImage(e.target.value)}
                placeholder="https://..."
                className="w-full p-2.5 rounded-lg bg-white/[0.04] border border-white/15 text-xs text-white outline-none truncate"
              />
            </div>
          </div>

          {/* Planned Itinerary */}
          <div className="space-y-2 pt-2 border-t border-white/10">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-white/70 flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-[#F27D26]" />
                Itinerary Steps
              </span>
              <button
                type="button"
                onClick={handleAddItineraryRow}
                className="text-[11px] text-[#F27D26] hover:underline flex items-center gap-1 font-bold uppercase tracking-wider"
              >
                <Plus className="w-3 h-3" />
                Add Step
              </button>
            </div>

            <div className="space-y-2">
              {itinerary.map((item, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <input
                    type="text"
                    value={item.time}
                    onChange={(e) => {
                      const updated = [...itinerary];
                      updated[idx].time = e.target.value;
                      setItinerary(updated);
                    }}
                    placeholder="7:00 PM"
                    className="w-24 p-2 rounded-lg bg-white/[0.04] border border-white/15 text-xs text-white font-mono"
                  />
                  <input
                    type="text"
                    value={item.activity}
                    onChange={(e) => {
                      const updated = [...itinerary];
                      updated[idx].activity = e.target.value;
                      setItinerary(updated);
                    }}
                    placeholder="Activity name"
                    className="flex-1 p-2 rounded-lg bg-white/[0.04] border border-white/15 text-xs text-white uppercase tracking-wide"
                  />
                  {itinerary.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveItineraryRow(idx)}
                      className="p-2 text-white/40 hover:text-white transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Preference Question */}
          <div className="space-y-2 pt-2 border-t border-white/10">
            <span className="text-xs font-semibold uppercase tracking-wider text-white/70">
              Custom Preference Question (Optional)
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <input
                type="text"
                value={questionText}
                onChange={(e) => setQuestionText(e.target.value)}
                placeholder="Question (e.g. Toast preference?)"
                className="p-2 rounded-lg bg-white/[0.04] border border-white/15 text-xs text-white"
              />
              <input
                type="text"
                value={optionsText}
                onChange={(e) => setOptionsText(e.target.value)}
                placeholder="Options separated by commas"
                className="p-2 rounded-lg bg-white/[0.04] border border-white/15 text-xs text-white"
              />
            </div>
          </div>

          {/* Submit Action */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-white/10">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs uppercase tracking-wider font-semibold transition-colors border border-white/10"
            >
              Cancel
            </button>
            <button
              type="submit"
              id="btn-save-invitation"
              className="px-6 py-2.5 rounded-lg bg-[#F27D26] hover:bg-[#ff8a34] text-black text-xs uppercase tracking-wider font-bold shadow-lg shadow-[#F27D26]/20 transition-all cursor-pointer"
            >
              Generate Date Card & Link
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
