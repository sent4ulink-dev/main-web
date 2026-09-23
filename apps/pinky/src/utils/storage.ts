import { Invitation, RSVPResponse, AnalyticsSummary } from '../types';

const STORAGE_KEY = 'date_invitations_v1';
const ACTIVE_INVITE_KEY = 'active_invite_id';

export const INITIAL_INVITATIONS: Invitation[] = [
  {
    id: 'candlelight-jazz',
    title: 'Candlelight Jazz & Speakeasy Bites',
    hostName: 'Leo',
    guestName: 'You',
    date: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000 + 19 * 60 * 60 * 1000).toISOString(), // 4 days from now, 7:00 PM
    endDate: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000 + 22 * 60 * 60 * 1000).toISOString(),
    location: 'The Velvet Room, 742 Evergreen Terrace',
    locationDetails: 'Secret doorway behind the antique bookshelf. Password is "Stardust".',
    description: 'A cozy corner table, live upright bass acoustic jazz, vintage cocktails, and good conversation away from the city noise.',
    dressCode: 'Cozy chic & warm tones',
    vibe: 'romantic',
    themeColor: 'amber',
    coverImage: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=1200&q=80',
    itinerary: [
      { time: '7:30 PM', activity: 'Meet & Welcome Cocktails', detail: 'Signature smoked old fashioneds & mocktails' },
      { time: '8:15 PM', activity: 'Live Jazz Trio Set', detail: 'Miles Davis & Ella Fitzgerald classics' },
      { time: '9:30 PM', activity: 'Tapas & Late Night Dessert', detail: 'Truffle flatbread & chocolate molten lava' },
      { time: '10:15 PM', activity: 'Moonlit Stroll by the Water', detail: 'Optional city promenade' }
    ],
    questions: [
      {
        id: 'drink',
        question: 'What is your beverage mood?',
        options: ['Classic Old Fashioned', 'Crisp White Wine', 'Craft Herbal Mocktail', 'Surprise Me']
      },
      {
        id: 'sweet',
        question: 'Dessert craving?',
        options: ['Dark Chocolate Molten', 'Berry Tart', 'Affogato', 'Liquid dessert / cocktail']
      }
    ],
    createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    viewsCount: 14,
    responses: [
      {
        id: 'resp-1',
        invitationId: 'candlelight-jazz',
        responderName: 'Sarah K.',
        status: 'yes',
        timestamp: new Date(Date.now() - 36 * 60 * 60 * 1000).toISOString(),
        note: 'Count me in! I’ve been wanting to check out Velvet Room forever.',
        selectedPreferences: { drink: 'Surprise Me', sweet: 'Affogato' },
        syncedToCalendar: true
      },
      {
        id: 'resp-2',
        invitationId: 'candlelight-jazz',
        responderName: 'Alex M.',
        status: 'reschedule',
        timestamp: new Date(Date.now() - 18 * 60 * 60 * 1000).toISOString(),
        note: 'I have a work dinner Thursday, but free Friday or Sunday evening!',
        rescheduleSuggestion: 'Friday after 8 PM?'
      }
    ]
  },
  {
    id: 'sunset-picnic',
    title: 'Golden Hour Hillside Picnic & Polaroid',
    hostName: 'Maya',
    guestName: 'You',
    date: new Date(Date.now() + 6 * 24 * 60 * 60 * 1000 + 17 * 60 * 60 * 1000).toISOString(),
    endDate: new Date(Date.now() + 6 * 24 * 60 * 60 * 1000 + 20 * 60 * 60 * 1000).toISOString(),
    location: 'Twin Pines Lookout Point',
    locationDetails: 'Bring a light jacket. I will have the wool blankets and picnic basket ready.',
    description: 'Fresh sourdough, artisanal cheeses, sparkling cider, polaroid camera, and watching the sunset over the valley.',
    dressCode: 'Casual & warm layers',
    vibe: 'cozy',
    themeColor: 'rose',
    coverImage: 'https://images.unsplash.com/photo-1526401485004-46910ecc8e51?auto=format&fit=crop&w=1200&q=80',
    itinerary: [
      { time: '5:30 PM', activity: 'Meet at Hilltop Vista', detail: 'Unpack the blanket & fresh fruit' },
      { time: '6:30 PM', activity: 'Golden Hour Photos & Sunset', detail: 'Polaroid shots and panoramic views' },
      { time: '7:45 PM', activity: 'Stargazing & Hot Cocoa', detail: 'Thermos of spiced chai & dark cocoa' }
    ],
    questions: [
      {
        id: 'cheese',
        question: 'Cheese preference?',
        options: ['Creamy Brie & Honey', 'Aged Gouda', 'Vegan Herb Cheese', 'All of the above']
      }
    ],
    createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
    viewsCount: 8,
    responses: [
      {
        id: 'resp-3',
        invitationId: 'sunset-picnic',
        responderName: 'Chloe D.',
        status: 'yes',
        timestamp: new Date(Date.now() - 8 * 60 * 60 * 1000).toISOString(),
        note: 'This sounds magical! I will bring homemade cookies 🍪',
        selectedPreferences: { cheese: 'Creamy Brie & Honey' },
        syncedToCalendar: true
      }
    ]
  }
];

export function getStoredInvitations(): Invitation[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(INITIAL_INVITATIONS));
      return INITIAL_INVITATIONS;
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : INITIAL_INVITATIONS;
  } catch (e) {
    console.error('Failed to load stored invitations', e);
    return INITIAL_INVITATIONS;
  }
}

export function saveStoredInvitations(invitations: Invitation[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(invitations));
  } catch (e) {
    console.error('Failed to save invitations', e);
  }
}

export function getActiveInviteId(): string {
  try {
    return localStorage.getItem(ACTIVE_INVITE_KEY) || INITIAL_INVITATIONS[0].id;
  } catch {
    return INITIAL_INVITATIONS[0].id;
  }
}

export function setActiveInviteId(id: string): void {
  try {
    localStorage.setItem(ACTIVE_INVITE_KEY, id);
  } catch {}
}

export function addRSVPToInvitation(
  invitationId: string,
  response: Omit<RSVPResponse, 'id' | 'timestamp'>
): { updatedInvite: Invitation; newResponse: RSVPResponse } {
  const invitations = getStoredInvitations();
  const index = invitations.findIndex((i) => i.id === invitationId);
  
  const newResponse: RSVPResponse = {
    ...response,
    id: `resp-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    timestamp: new Date().toISOString()
  };

  if (index !== -1) {
    // Remove previous response from same name if re-swiping
    const filteredResponses = (invitations[index].responses || []).filter(
      (r) => r.responderName.toLowerCase() !== response.responderName.toLowerCase()
    );
    invitations[index].responses = [newResponse, ...filteredResponses];
    saveStoredInvitations(invitations);
    return { updatedInvite: invitations[index], newResponse };
  } else {
    // If invite wasn't found in storage, return fallback
    const fallbackInvite = INITIAL_INVITATIONS[0];
    fallbackInvite.responses = [newResponse, ...(fallbackInvite.responses || [])];
    return { updatedInvite: fallbackInvite, newResponse };
  }
}

export function incrementInviteViews(invitationId: string): void {
  const invitations = getStoredInvitations();
  const index = invitations.findIndex((i) => i.id === invitationId);
  if (index !== -1) {
    invitations[index].viewsCount = (invitations[index].viewsCount || 0) + 1;
    saveStoredInvitations(invitations);
  }
}

export function calculateAnalytics(invitation: Invitation): AnalyticsSummary {
  const responses = invitation.responses || [];
  const totalViews = invitation.viewsCount || Math.max(responses.length + 5, 1);
  const totalResponses = responses.length;
  
  let yesCount = 0;
  let noCount = 0;
  let rescheduleCount = 0;

  const preferenceBreakdown: Record<string, Record<string, number>> = {};
  if (invitation.questions) {
    invitation.questions.forEach((q) => {
      preferenceBreakdown[q.question] = {};
      q.options.forEach((opt) => {
        preferenceBreakdown[q.question][opt] = 0;
      });
    });
  }

  responses.forEach((r) => {
    if (r.status === 'yes') yesCount++;
    else if (r.status === 'no') noCount++;
    else if (r.status === 'reschedule') rescheduleCount++;

    if (r.selectedPreferences) {
      Object.entries(r.selectedPreferences).forEach(([qId, answer]) => {
        const questionObj = invitation.questions?.find((q) => q.id === qId);
        const qTitle = questionObj ? questionObj.question : qId;
        if (!preferenceBreakdown[qTitle]) {
          preferenceBreakdown[qTitle] = {};
        }
        preferenceBreakdown[qTitle][answer] = (preferenceBreakdown[qTitle][answer] || 0) + 1;
      });
    }
  });

  const acceptanceRate = totalResponses > 0 ? Math.round((yesCount / totalResponses) * 100) : 0;

  // Group responses by day for timeline chart
  const timelineMap: Record<string, { yes: number; no: number; reschedule: number }> = {};
  responses.forEach((r) => {
    const day = new Date(r.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    if (!timelineMap[day]) {
      timelineMap[day] = { yes: 0, no: 0, reschedule: 0 };
    }
    if (r.status === 'yes') timelineMap[day].yes++;
    if (r.status === 'no') timelineMap[day].no++;
    if (r.status === 'reschedule') timelineMap[day].reschedule++;
  });

  const responseTimeline = Object.entries(timelineMap).map(([date, counts]) => ({
    date,
    ...counts
  }));

  return {
    totalViews,
    totalResponses,
    yesCount,
    noCount,
    rescheduleCount,
    acceptanceRate,
    latestResponseAt: responses[0]?.timestamp,
    preferenceBreakdown,
    responseTimeline
  };
}

export function encodeInviteToShareUrl(invite: Invitation): string {
  try {
    const jsonStr = JSON.stringify(invite);
    const encoded = encodeURIComponent(btoa(unescape(encodeURIComponent(jsonStr))));
    return `${window.location.origin}${window.location.pathname}#invite=${encoded}`;
  } catch {
    return window.location.href;
  }
}

export function decodeInviteFromHash(): Invitation | null {
  try {
    const hash = window.location.hash;
    if (hash.includes('#invite=')) {
      const b64 = decodeURIComponent(hash.split('#invite=')[1]);
      const jsonStr = decodeURIComponent(escape(atob(b64)));
      return JSON.parse(jsonStr) as Invitation;
    }
  } catch (e) {
    console.warn('Could not decode invite from URL', e);
  }
  return null;
}
