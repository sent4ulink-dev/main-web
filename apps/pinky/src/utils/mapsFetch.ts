// Pulls the same rating/reviews/hours/photo you'd see searching a place on Google,
// via our server's /api/maps/* proxy (keeps the Places API key server-side only).
const API_BASE = `${import.meta.env.VITE_API_BASE_URL ?? ''}/api/maps`;

export interface FetchedPlaceDetails {
  name?: string;
  rating?: string;
  reviewCount?: string;
  hours?: string;
  imageUrl?: string;
}

export async function fetchPlaceDetails(mapsLink: string): Promise<FetchedPlaceDetails> {
  const res = await fetch(`${API_BASE}/resolve?url=${encodeURIComponent(mapsLink)}`);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const messages: Record<string, string> = {
      not_configured: "Maps fetch isn't set up yet (missing API key)",
      unrecognized_link: "Couldn't read that link — try copying it again from Google Maps",
      place_not_found: "Couldn't find that place on Google",
      missing_url: 'Paste a Maps link first'
    };
    throw new Error(messages[body.error] || 'Failed to fetch from Google Maps');
  }
  const data = await res.json();
  return {
    name: data.name,
    rating: data.rating,
    reviewCount: data.reviewCount,
    hours: data.hours,
    imageUrl: data.photoUrl ? `${import.meta.env.VITE_API_BASE_URL ?? ''}${data.photoUrl}` : undefined
  };
}
