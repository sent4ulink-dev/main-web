import { useCallback, useEffect, useState } from 'react';
import { ActivityOption, RestaurantOption, ShareContent, ShareMode } from '../types';
import { getShareId, isDemoShareId } from '../utils/shareId';
import {
  flushDemoContent,
  getDemoContent,
  getDemoEditUntil,
  loadDemoContent,
  saveDemoContent
} from '../utils/demoShare';
import { finalizeShare, flushShare, loadShare, updateShare } from '../utils/realShare';

function makeId(): string {
  return Math.random().toString(36).slice(2, 10);
}

export function useShareSession() {
  const [shareId] = useState(getShareId);
  // No ?share= at all: there is no public studio any more — every real invitation is
  // minted server-to-server the moment it's paid for (see server/index.js's /ensure),
  // so a bare visit has nothing to show.
  const notFound = shareId === null;
  const [mode] = useState<ShareMode>(() => (shareId !== null && isDemoShareId(shareId) ? 'demo' : 'real'));

  const [content, setContent] = useState<ShareContent>(() =>
    mode === 'demo' ? loadDemoContent() : getDemoContent()
  );
  const [editUntil, setEditUntil] = useState<number | null>(() =>
    mode === 'demo' ? getDemoEditUntil() : null
  );
  const [finalized, setFinalized] = useState(false);
  const [loading, setLoading] = useState(mode === 'real' && !notFound);
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    if (mode !== 'real' || !shareId) return;
    let cancelled = false;
    loadShare(shareId)
      .then((result) => {
        if (cancelled) return;
        setContent(result.content);
        setEditUntil(result.editUntil);
        setFinalized(result.finalized);
        setLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setError("This link isn't working. Double-check the URL, or ask for a new one.");
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [mode, shareId]);

  const canEdit = !finalized && (editUntil ?? 0) > Date.now();

  const persist = useCallback(
    (next: ShareContent) => {
      if (mode === 'demo') {
        saveDemoContent(next);
      } else if (mode === 'real' && shareId && canEdit) {
        updateShare(shareId, next);
      }
    },
    [mode, shareId, canEdit]
  );

  const mutate = useCallback(
    (updater: (prev: ShareContent) => ShareContent) => {
      setContent((prev) => {
        const next = updater(prev);
        persist(next);
        return next;
      });
    },
    [persist]
  );

  const setQuestion = useCallback((v: string) => mutate((prev) => ({ ...prev, question: v })), [mutate]);
  const setYesLabel = useCallback((v: string) => mutate((prev) => ({ ...prev, yesLabel: v })), [mutate]);
  const setNoLabel = useCallback((v: string) => mutate((prev) => ({ ...prev, noLabel: v })), [mutate]);
  const setCelebrationWord = useCallback(
    (v: string) => mutate((prev) => ({ ...prev, celebrationWord: v })),
    [mutate]
  );
  const setMusicUrl = useCallback((v: string) => mutate((prev) => ({ ...prev, musicUrl: v })), [mutate]);

  const setNoPleaText = useCallback(
    (index: number, v: string) =>
      mutate((prev) => {
        const noPleaTexts = [...prev.noPleaTexts];
        noPleaTexts[index] = v;
        return { ...prev, noPleaTexts };
      }),
    [mutate]
  );

  const addActivity = useCallback(
    (emoji: string, text: string) =>
      mutate((prev) => ({
        ...prev,
        activities: [...prev.activities, { id: makeId(), emoji, text } as ActivityOption]
      })),
    [mutate]
  );
  const updateActivity = useCallback(
    (id: string, patch: Partial<Pick<ActivityOption, 'emoji' | 'text'>>) =>
      mutate((prev) => ({
        ...prev,
        activities: prev.activities.map((a) => (a.id === id ? { ...a, ...patch } : a))
      })),
    [mutate]
  );
  const removeActivity = useCallback(
    (id: string) =>
      mutate((prev) => ({ ...prev, activities: prev.activities.filter((a) => a.id !== id) })),
    [mutate]
  );

  const addRestaurant = useCallback(
    (
      name: string,
      mapsLink: string,
      extra?: Partial<Pick<RestaurantOption, 'imageUrl' | 'rating' | 'reviewCount' | 'hours'>>
    ) =>
      mutate((prev) => ({
        ...prev,
        restaurants: [...prev.restaurants, { id: makeId(), name, mapsLink, ...extra } as RestaurantOption]
      })),
    [mutate]
  );
  const updateRestaurant = useCallback(
    (id: string, patch: Partial<Omit<RestaurantOption, 'id'>>) =>
      mutate((prev) => ({
        ...prev,
        restaurants: prev.restaurants.map((r) => (r.id === id ? { ...r, ...patch } : r))
      })),
    [mutate]
  );
  const removeRestaurant = useCallback(
    (id: string) =>
      mutate((prev) => ({ ...prev, restaurants: prev.restaurants.filter((r) => r.id !== id) })),
    [mutate]
  );

  /** Immediate, non-debounced save — the editor toolbar's Save button calls this so a
   * click gives real feedback instead of silently waiting out the ~2s autosave debounce
   * (or the 500ms one for the demo). Every individual field setter above already
   * autosaves on its own; this just guarantees the latest state is flushed right now. */
  const saveNow = useCallback(() => {
    if (mode === 'demo') {
      flushDemoContent(content);
    } else if (mode === 'real' && shareId && canEdit) {
      flushShare(shareId, content);
    }
  }, [mode, shareId, canEdit, content]);

  const finalize = useCallback(async () => {
    if (mode !== 'real' || !shareId) return;
    await finalizeShare(shareId);
    setFinalized(true);
  }, [mode, shareId]);

  return {
    mode,
    shareId,
    notFound,
    loading,
    error,
    content,
    editUntil,
    finalized,
    isEditing,
    setIsEditing,
    canEdit,
    setQuestion,
    setYesLabel,
    setNoLabel,
    setNoPleaText,
    setCelebrationWord,
    setMusicUrl,
    addActivity,
    updateActivity,
    removeActivity,
    addRestaurant,
    updateRestaurant,
    removeRestaurant,
    saveNow,
    finalize
  };
}

export type ShareSession = ReturnType<typeof useShareSession>;
