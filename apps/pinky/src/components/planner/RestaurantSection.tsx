/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  Check,
  Heart,
  ArrowLeft,
  Sparkles,
  MapPin,
  ExternalLink,
  Compass,
  Star,
  Clock,
  X,
  Plus,
  Wand2,
  Loader2,
  Image as ImageIcon
} from 'lucide-react';
import { RestaurantOption } from '../../types';
import { EditableText } from '../edit/EditableText';
import { fetchPlaceDetails } from '../../utils/mapsFetch';

interface RestaurantSectionProps {
  restaurants: RestaurantOption[];
  initialRestaurant: string;
  onSave: (restaurant: string, mapsLink?: string, imageUrl?: string) => void;
  onCancel: () => void;
  /** Owner edit mode: same card list, but name/rating/reviews/hours are directly
   * editable in place, the Maps link + photo URL (which have no visible text of their
   * own normally) get a small inline field each, cards can be removed, and the "custom
   * restaurant" box below becomes an "add restaurant" box. */
  editing?: boolean;
  onAddRestaurant?: (
    name: string,
    mapsLink: string,
    extra?: Partial<Pick<RestaurantOption, 'imageUrl' | 'rating' | 'reviewCount' | 'hours'>>
  ) => void;
  onUpdateRestaurant?: (id: string, patch: Partial<Omit<RestaurantOption, 'id'>>) => void;
  onRemoveRestaurant?: (id: string) => void;
}

export function RestaurantSection({
  restaurants,
  initialRestaurant,
  onSave,
  onCancel,
  editing = false,
  onAddRestaurant,
  onUpdateRestaurant,
  onRemoveRestaurant
}: RestaurantSectionProps) {
  const [selectedName, setSelectedName] = useState<string>(
    initialRestaurant || restaurants[0]?.name || ''
  );
  const [customName, setCustomName] = useState<string>('');
  const [isCustom, setIsCustom] = useState<boolean>(
    Boolean(initialRestaurant && !restaurants.some((r) => r.name === initialRestaurant))
  );
  const [isClosing, setIsClosing] = useState<boolean>(false);

  // Owner edit mode only — mirrors RestaurantOptionsEditor's "fetch from Maps" (rating,
  // review count, hours, photo) so that convenience isn't lost by inlining editing here.
  const [fetchingId, setFetchingId] = useState<string | null>(null);
  const [fetchError, setFetchError] = useState<{ id: string; message: string } | null>(null);
  const [newName, setNewName] = useState('');
  const [newMapsLink, setNewMapsLink] = useState('');
  const [newExtra, setNewExtra] = useState<Partial<RestaurantOption>>({});

  function looksLikeUrl(value: string): boolean {
    if (!value.trim()) return false;
    try {
      new URL(value.trim());
      return true;
    } catch {
      return false;
    }
  }

  const runFetch = async (
    id: string,
    mapsLink: string,
    apply: (details: Awaited<ReturnType<typeof fetchPlaceDetails>>) => void
  ) => {
    if (!looksLikeUrl(mapsLink)) {
      setFetchError({ id, message: 'Paste a Maps link first' });
      return;
    }
    setFetchError(null);
    setFetchingId(id);
    try {
      const details = await fetchPlaceDetails(mapsLink);
      apply(details);
    } catch (err) {
      setFetchError({ id, message: err instanceof Error ? err.message : 'Fetch failed' });
    } finally {
      setFetchingId(null);
    }
  };

  const handleConfirmAddRestaurant = () => {
    if (!newName.trim() || !looksLikeUrl(newMapsLink)) return;
    onAddRestaurant?.(newName.trim(), newMapsLink.trim(), newExtra);
    setNewName('');
    setNewMapsLink('');
    setNewExtra({});
  };

  const handleSelect = (name: string) => {
    setSelectedName(name);
    setIsCustom(false);
  };

  const handleTriggerCancel = () => {
    setIsClosing(true);
    setTimeout(() => {
      onCancel();
    }, 380);
  };

  const handleTriggerSave = () => {
    const finalRestaurant = isCustom && customName.trim() ? customName.trim() : selectedName;
    const found = restaurants.find((r) => r.name === finalRestaurant);
    const mapsLink =
      found?.mapsLink ||
      (isCustom && customName.trim()
        ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(customName.trim())}`
        : undefined);
    setIsClosing(true);
    setTimeout(() => {
      onSave(finalRestaurant, mapsLink, found?.imageUrl);
    }, 380);
  };

  const handleOpenGoogleMaps = (e: React.MouseEvent, url: string) => {
    e.stopPropagation();
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  return (
    <div
      className={`w-full max-w-2xl bg-neutral-950/95 border border-[#FF2E7E]/40 rounded-3xl p-4 sm:p-6 shadow-[0_0_80px_rgba(255,46,126,0.4)] backdrop-blur-2xl text-white flex flex-col max-h-[92vh] ${
        isClosing ? 'animate-heart-shrink-back' : 'animate-heart-zoom-page'
      }`}
    >
      {/* Header */}
      <div className="flex items-center justify-between pb-3.5 border-b border-white/10 shrink-0">
        {editing ? (
          <div className="w-9" />
        ) : (
          <button
            type="button"
            onClick={handleTriggerCancel}
            className="p-2 rounded-full hover:bg-white/10 text-white/70 hover:text-white transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
        )}
        <div className="text-center">
          <div className="flex items-center justify-center gap-2">
            <Heart className="w-4 h-4 fill-[#FF2E7E] text-[#FF2E7E]" />
            <h2 className="text-base sm:text-xl font-bold uppercase tracking-wider">
              {editing ? 'Restaurant Options' : 'Restaurant Destination'}
            </h2>
          </div>
          <p className="text-xs text-white/60 mt-0.5">
            {editing ? 'Tap any field to edit it' : 'Pick a spot, or check it on Google Maps first'}
          </p>
        </div>
        <div className="w-9" />
      </div>

      {/* Restaurant List */}
      <div className="overflow-y-auto py-3 space-y-4 pr-1">
        {restaurants.map((rest) => {
          const isChosen = !isCustom && selectedName === rest.name;
          return (
            <div
              key={rest.id}
              onClick={editing ? undefined : () => handleSelect(rest.name)}
              className={`w-full rounded-2xl border transition-all duration-200 ${
                editing ? '' : 'cursor-pointer'
              } relative group overflow-hidden flex flex-col sm:flex-row ${
                isChosen
                  ? 'bg-[#FF2E7E]/20 border-[#FF2E7E] shadow-[0_0_30px_rgba(255,46,126,0.4)] scale-[1.01]'
                  : 'bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20'
              }`}
            >
              {editing && (
                <button
                  type="button"
                  id={`btn-remove-restaurant-${rest.id}`}
                  onClick={() => onRemoveRestaurant?.(rest.id)}
                  disabled={restaurants.length <= 1}
                  title={restaurants.length <= 1 ? 'At least one restaurant is required' : 'Remove'}
                  className="absolute top-1.5 right-1.5 z-10 w-6 h-6 rounded-full bg-black/60 hover:bg-red-500/80 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center text-white/70 hover:text-white transition-colors cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}

              {/* Place photo */}
              {(rest.imageUrl || editing) && (
                <div className="relative w-full sm:w-40 sm:min-w-[160px] sm:self-start aspect-square shrink-0 overflow-hidden bg-black/40">
                  {rest.imageUrl && (
                    <img
                      src={rest.imageUrl}
                      alt={rest.name}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                  )}
                  {!editing && (
                    <div className="absolute inset-0 bg-gradient-to-t sm:bg-gradient-to-r from-black/70 via-transparent to-transparent" />
                  )}
                  {isChosen && !editing && (
                    <div className="absolute bottom-2 left-2 w-6 h-6 rounded-full bg-[#FF2E7E] flex items-center justify-center text-black shadow-lg">
                      <Check className="w-4 h-4 stroke-[3]" />
                    </div>
                  )}
                  {/* Photo URL — no visible text of its own to attach editing to
                      normally, so this small field only exists while editing. */}
                  {editing && (
                    <div className="absolute inset-x-0 bottom-0 bg-black/75 p-1.5 flex items-center gap-1">
                      <ImageIcon className="w-3 h-3 text-white/40 shrink-0" />
                      <input
                        type="text"
                        value={rest.imageUrl || ''}
                        onChange={(e) => onUpdateRestaurant?.(rest.id, { imageUrl: e.target.value })}
                        placeholder="Photo URL"
                        className="flex-1 min-w-0 bg-transparent text-white text-[10px] placeholder:text-white/40 focus:outline-none"
                      />
                    </div>
                  )}
                </div>
              )}

              {/* Content */}
              <div className="p-3.5 sm:p-4 flex-1 flex flex-col justify-between gap-2 min-w-0">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <MapPin className="w-4 h-4 text-[#FF2E7E] shrink-0" />
                    {editing ? (
                      <EditableText
                        tag="h3"
                        className="font-bold text-sm sm:text-base text-white flex-1 min-w-0"
                        value={rest.name}
                        onCommit={(v) => onUpdateRestaurant?.(rest.id, { name: v })}
                        ariaLabel="Restaurant name"
                        placeholder="Restaurant name"
                      />
                    ) : (
                      <h3 className="font-bold text-sm sm:text-base text-white group-hover:text-[#FF80BF] transition-colors truncate">
                        {rest.name}
                      </h3>
                    )}
                    {isChosen && !rest.imageUrl && !editing && (
                      <Check className="w-4 h-4 text-[#FF2E7E] shrink-0 stroke-[3]" />
                    )}
                  </div>

                  {(rest.rating || editing) && (
                    <div className="flex items-center gap-1.5 bg-amber-400/15 border border-amber-400/30 px-2 py-0.5 rounded-md text-[11px] font-bold text-amber-300 w-fit mb-1">
                      <Star className="w-3 h-3 fill-amber-400 text-amber-400 shrink-0" />
                      {editing ? (
                        <>
                          <EditableText
                            tag="span"
                            className="min-w-[1.5em] inline-block"
                            value={rest.rating || ''}
                            onCommit={(v) => onUpdateRestaurant?.(rest.id, { rating: v || undefined })}
                            ariaLabel="Rating"
                            placeholder="4.9"
                          />
                          <EditableText
                            tag="span"
                            className="text-white/60 font-normal text-[10px] min-w-[3em] inline-block"
                            value={rest.reviewCount || ''}
                            onCommit={(v) => onUpdateRestaurant?.(rest.id, { reviewCount: v || undefined })}
                            ariaLabel="Review count"
                            placeholder="(1,840+ reviews)"
                          />
                        </>
                      ) : (
                        <>
                          <span>{rest.rating}</span>
                          {rest.reviewCount && (
                            <span className="text-white/60 font-normal text-[10px]">({rest.reviewCount})</span>
                          )}
                        </>
                      )}
                    </div>
                  )}

                  {(rest.hours || editing) && (
                    <div className="flex items-center gap-1.5 text-emerald-400 text-[11px] font-medium mt-1">
                      <Clock className="w-3 h-3 shrink-0" />
                      {editing ? (
                        <>
                          <span className="shrink-0">Open:</span>
                          <EditableText
                            tag="span"
                            className="min-w-[4em] inline-block"
                            value={rest.hours || ''}
                            onCommit={(v) => onUpdateRestaurant?.(rest.id, { hours: v || undefined })}
                            ariaLabel="Open hours"
                            placeholder="5:00 PM – 11:30 PM (Daily)"
                          />
                        </>
                      ) : (
                        <span>Open: {rest.hours}</span>
                      )}
                    </div>
                  )}
                </div>

                {editing ? (
                  <div className="flex items-center gap-1.5">
                    <Compass className="w-3.5 h-3.5 text-[#FF2E7E] shrink-0" />
                    <input
                      type="text"
                      value={rest.mapsLink}
                      onChange={(e) => onUpdateRestaurant?.(rest.id, { mapsLink: e.target.value })}
                      placeholder="Google Maps link"
                      className="flex-1 min-w-0 px-2 py-1 rounded-lg bg-black/40 border border-white/15 text-white text-[11px] placeholder:text-white/40 focus:outline-none focus:border-[#FF2E7E]"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        runFetch(rest.id, rest.mapsLink, (details) =>
                          onUpdateRestaurant?.(rest.id, {
                            ...(details.rating && { rating: details.rating }),
                            ...(details.reviewCount && { reviewCount: details.reviewCount }),
                            ...(details.hours && { hours: details.hours }),
                            ...(details.imageUrl && { imageUrl: details.imageUrl })
                          })
                        )
                      }
                      disabled={fetchingId === rest.id}
                      title="Fetch rating, photo & hours from Google"
                      className="shrink-0 p-1.5 rounded-lg text-[#FF80BF] hover:text-white hover:bg-white/10 disabled:opacity-50 transition-colors cursor-pointer"
                    >
                      {fetchingId === rest.id ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Wand2 className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                ) : (
                  rest.mapsLink && (
                    <button
                      type="button"
                      onClick={(e) => handleOpenGoogleMaps(e, rest.mapsLink)}
                      className="self-start px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 active:scale-95 text-[#FF80BF] hover:text-white text-[11px] font-semibold flex items-center gap-1 transition-all cursor-pointer shrink-0 border border-white/15 shadow-sm"
                      title="Open location in Google Maps"
                    >
                      <Compass className="w-3 h-3 text-[#FF2E7E]" />
                      <span>View on Google Maps</span>
                      <ExternalLink className="w-2.5 h-2.5 opacity-70" />
                    </button>
                  )
                )}
                {editing && fetchError?.id === rest.id && (
                  <p className="text-[10px] text-red-400">{fetchError.message}</p>
                )}
              </div>
            </div>
          );
        })}

        {/* Custom Restaurant Option (visitor picking a one-off place) — replaced with an
            "add restaurant" form, same visual slot, while the owner is editing. */}
        <div className="pt-1">
          {editing ? (
            <div className="p-3.5 rounded-2xl border border-dashed border-white/20 space-y-1.5">
              <div className="flex items-center gap-2 mb-1">
                <Plus className="w-4 h-4 text-[#FF80BF]" />
                <span className="text-xs font-bold uppercase tracking-wider text-white">Add Restaurant</span>
              </div>
              <input
                type="text"
                id="input-new-restaurant-name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="New restaurant name..."
                className="w-full px-3 py-1.5 rounded-lg bg-black/40 border border-white/15 text-white text-xs placeholder:text-white/40 focus:outline-none focus:border-[#FF2E7E]"
              />
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  id="input-new-restaurant-maps"
                  value={newMapsLink}
                  onChange={(e) => setNewMapsLink(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleConfirmAddRestaurant()}
                  placeholder="Google Maps link"
                  className="flex-1 min-w-0 px-3 py-1.5 rounded-lg bg-black/40 border border-white/15 text-white text-[11px] placeholder:text-white/40 focus:outline-none focus:border-[#FF2E7E]"
                />
                <button
                  type="button"
                  onClick={() =>
                    runFetch('new', newMapsLink, (details) => {
                      setNewExtra((prev) => ({
                        ...prev,
                        ...(details.rating && { rating: details.rating }),
                        ...(details.reviewCount && { reviewCount: details.reviewCount }),
                        ...(details.hours && { hours: details.hours }),
                        ...(details.imageUrl && { imageUrl: details.imageUrl })
                      }));
                      setNewName((prev) => prev.trim() || details.name || prev);
                    })
                  }
                  disabled={fetchingId === 'new'}
                  title="Fetch rating, photo & hours from Google"
                  className="shrink-0 p-1.5 rounded-lg text-[#FF80BF] hover:text-white hover:bg-white/10 disabled:opacity-50 transition-colors cursor-pointer"
                >
                  {fetchingId === 'new' ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Wand2 className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>
              {fetchError?.id === 'new' && <p className="text-[10px] text-red-400">{fetchError.message}</p>}
              <div className="flex justify-end">
                <button
                  type="button"
                  id="btn-add-restaurant"
                  onClick={handleConfirmAddRestaurant}
                  disabled={!newName.trim() || !looksLikeUrl(newMapsLink)}
                  className="px-3 py-1.5 rounded-lg bg-[#FF2E7E] hover:bg-[#ff156e] disabled:opacity-40 text-white text-[11px] font-bold uppercase cursor-pointer"
                >
                  Add
                </button>
              </div>
            </div>
          ) : (
            <div
              onClick={() => setIsCustom(true)}
              className={`p-3.5 rounded-2xl border transition-all cursor-pointer ${
                isCustom
                  ? 'bg-[#FF2E7E]/20 border-[#FF2E7E]'
                  : 'bg-white/5 border-white/10 hover:bg-white/10'
              }`}
            >
              <div className="flex items-center justify-between gap-2 mb-2">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-[#FF80BF]" />
                  <span className="text-xs font-bold uppercase tracking-wider text-white">
                    Have a Special Restaurant Favorite?
                  </span>
                </div>
                {customName.trim() && (
                  <button
                    type="button"
                    onClick={(e) =>
                      handleOpenGoogleMaps(
                        e,
                        `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(customName)}`
                      )
                    }
                    className="px-2 py-0.5 rounded-md bg-white/10 hover:bg-white/20 text-[#FF80BF] text-[10px] font-semibold flex items-center gap-1 cursor-pointer"
                  >
                    <span>Search Maps</span>
                    <ExternalLink className="w-2.5 h-2.5" />
                  </button>
                )}
              </div>
              <input
                type="text"
                placeholder="e.g. That candlelit rooftop spot downtown..."
                value={customName}
                onChange={(e) => {
                  setCustomName(e.target.value);
                  setIsCustom(true);
                }}
                onFocus={() => setIsCustom(true)}
                className="w-full px-3.5 py-2 rounded-xl bg-black/60 border border-white/20 text-white text-xs placeholder:text-white/40 focus:outline-none focus:border-[#FF2E7E]"
              />
            </div>
          )}
        </div>
      </div>

      {/* Footer / Save Button — hidden while editing; the editor toolbar handles
          navigation and persistence instead. */}
      {!editing && (
        <div className="pt-3 border-t border-white/10 flex items-center justify-end gap-3 shrink-0">
          <button
            type="button"
            onClick={handleTriggerCancel}
            className="px-5 py-2 rounded-full text-xs font-semibold text-white/70 hover:text-white transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleTriggerSave}
            className="px-7 py-2 rounded-full bg-[#FF2E7E] hover:bg-[#ff156e] active:scale-95 text-white font-bold text-xs uppercase tracking-widest transition-all duration-200 shadow-lg shadow-[#FF2E7E]/40 flex items-center gap-2 cursor-pointer"
          >
            <Check className="w-4 h-4" />
            <span>Save</span>
          </button>
        </div>
      )}
    </div>
  );
}
