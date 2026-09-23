export const emoticonIds = [
  "smile",
  "wink",
  "love",
  "kiss",
  "cool",
  "blush",
] as const;
export type EmoticonId = (typeof emoticonIds)[number];
export const emoticons: Record<EmoticonId, { label: string; code: string }> = {
  smile: { label: "Smile", code: ":)" },
  wink: { label: "Wink", code: ";)" },
  love: { label: "In love", code: "(L)" },
  kiss: { label: "Kiss", code: ":*" },
  cool: { label: "Cool", code: "(H)" },
  blush: { label: "Blush", code: ":$" },
};

// Original vector artwork, inspired by early desktop messenger emoticons.
export function emoticonUrl(kind: EmoticonId) {
  const eyes =
    kind === "love"
      ? '<path fill="#e94365" stroke="#a32642" stroke-width="1" d="M16 22c-6-7-13 3 1 12 14-9 7-19 1-12Zm28 0c-6-7-13 3 1 12 14-9 7-19 1-12Z"/>'
      : kind === "cool"
        ? '<path fill="#203d61" stroke="#132c4b" stroke-width="2" d="M10 23h18v9c-5 7-13 5-16 0Zm26 0h18l-2 9c-3 5-11 7-16 0Z"/><path stroke="#203d61" stroke-width="3" d="M28 26h8"/><path stroke="#aacaf1" stroke-width="2" d="m15 25 7 5m19-5 7 5"/>'
        : '<ellipse cx="22" cy="27" rx="3" ry="5" fill="#64370e"/>' +
          (kind === "wink" || kind === "kiss"
            ? '<path d="M38 28q5-6 9 0" fill="none" stroke="#64370e" stroke-width="3" stroke-linecap="round"/>'
            : '<ellipse cx="43" cy="27" rx="3" ry="5" fill="#64370e"/>');
  const mouth =
    kind === "kiss"
      ? '<path d="m31 38 7 4-7 4 7 3" stroke="#8d3b20" stroke-width="3" fill="none" stroke-linecap="round"/><path fill="#ec5279" d="M51 41c-7-7-13 3 0 11 13-8 7-18 0-11Z"/>'
      : kind === "blush"
        ? '<path d="M25 43q7 6 14-1" fill="none" stroke="#804015" stroke-width="2.5" stroke-linecap="round"/>'
        : '<path d="M19 38q14 6 27 0c-3 19-23 19-27 0Z" fill="#853c16" stroke="#77350f" stroke-width="1.5"/><path d="M22 40q11 4 21 0l-3 5H25Z" fill="#fffaf0"/><path d="M27 50q6-5 12 0" fill="#ef8878"/>';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64"><defs><radialGradient id="face" cx="35%" cy="25%" r="75%"><stop stop-color="#fffccc"/><stop offset=".4" stop-color="#ffe962"/><stop offset=".8" stop-color="#ffc52a"/><stop offset="1" stop-color="#ed9b11"/></radialGradient><linearGradient id="shine" x2="0" y2="1"><stop stop-color="white" stop-opacity=".8"/><stop offset="1" stop-color="white" stop-opacity="0"/></linearGradient></defs><ellipse cx="33" cy="59" rx="24" ry="3" fill="#46608e" opacity=".2"/><circle cx="32" cy="31" r="28" fill="url(#face)" stroke="#c78117" stroke-width="1.5"/><ellipse cx="30" cy="15" rx="18" ry="10" fill="url(#shine)"/><ellipse cx="14" cy="37" rx="6" ry="4" fill="#ed8478" opacity="${kind === "blush" ? ".85" : ".4"}"/><ellipse cx="50" cy="37" rx="6" ry="4" fill="#ed8478" opacity="${kind === "blush" ? ".85" : ".4"}"/>${eyes}${mouth}</svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}
