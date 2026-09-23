export interface DatePlan {
  activity: string;
  date: string;
  time: string;
  restaurant: string;
  mapsLink?: string;
  /** Photo of the chosen restaurant, when it has one (from the owner's options list or
   * a Google Places fetch) — shown in the merged plan's location row. */
  restaurantImageUrl?: string;
  partnerEmail?: string;
  customNote?: string;
}

export type PlannerStep = 'hub' | 'activity' | 'datetime' | 'restaurant' | 'merged-plan';

export type DateVibe = 'romantic' | 'chill' | 'adventurous' | 'playful' | 'cozy' | 'luxurious';

export type ThemeColor = 'rose' | 'amber' | 'emerald' | 'violet' | 'indigo' | 'slate';

export interface ItineraryItem {
  time: string;
  activity: string;
  detail?: string;
  icon?: string;
}

export interface PreferenceQuestion {
  id: string;
  question: string;
  options: string[];
}

export interface RSVPResponse {
  id: string;
  invitationId: string;
  responderName: string;
  status: 'yes' | 'no' | 'reschedule';
  timestamp: string;
  note?: string;
  rescheduleSuggestion?: string;
  selectedPreferences?: Record<string, string>;
  syncedToCalendar?: boolean;
}

export interface Invitation {
  id: string;
  title: string;
  hostName: string;
  guestName?: string;
  date: string; // ISO string e.g. 2026-08-29T19:30:00
  endDate?: string; // ISO string
  location: string;
  locationDetails?: string;
  description: string;
  dressCode?: string;
  vibe: DateVibe;
  themeColor: ThemeColor;
  coverImage?: string;
  playlistUrl?: string;
  itinerary: ItineraryItem[];
  questions?: PreferenceQuestion[];
  createdAt: string;
  responses: RSVPResponse[];
  viewsCount?: number;
}

export interface ActivityOption {
  id: string;
  emoji: string;
  text: string;
}

export interface RestaurantOption {
  id: string;
  name: string;
  mapsLink: string;
  imageUrl?: string;
  rating?: string;
  reviewCount?: string;
  hours?: string;
}

export interface ShareContent {
  /** The prompt shown at the top of the card, above the Yes/No split — e.g. "Will you go on a date with me?" */
  question: string;
  yesLabel: string;
  noLabel: string;
  /** Fixed 10 slots — one per "No" click stage, matching the escalation animation. */
  noPleaTexts: string[];
  /** The word/phrase repeated across the fullscreen marquee rows after tapping Yes. */
  celebrationWord: string;
  activities: ActivityOption[];
  restaurants: RestaurantOption[];
  musicUrl: string;
}

export type ShareMode = 'demo' | 'real';

export interface AnalyticsSummary {
  totalViews: number;
  totalResponses: number;
  yesCount: number;
  noCount: number;
  rescheduleCount: number;
  acceptanceRate: number;
  latestResponseAt?: string;
  preferenceBreakdown: Record<string, Record<string, number>>;
  responseTimeline: Array<{
    date: string;
    yes: number;
    no: number;
    reschedule: number;
  }>;
}
