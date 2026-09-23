import { z } from "zod";
import { youtubeId } from "./youtube.js";
import { emoticonIds } from "./emoticons.js";
const text = (max: number) =>
  z
    .string()
    .transform((v) =>
      Array.from(v)
        .filter((ch) => {
          const n = ch.charCodeAt(0);
          return (n >= 32 && n !== 127) || n === 9 || n === 10 || n === 13;
        })
        .join("")
        .trim(),
    )
    .pipe(z.string().min(1).max(max));
export const activitySchema = z
  .object({
    id: z.string().regex(/^[a-zA-Z0-9_-]{1,40}$/),
    name: text(100),
    places: z.array(text(160)).min(1).max(12),
  })
  .strict();
export const contentSchema = z
  .object({
    bootTitle: text(120),
    desktopNote: text(300),
    soundtrackTitle: text(120).default("Our tomorrow ♡"),
    youtubeUrl: z
      .string()
      .trim()
      .max(500)
      .refine((v) => !v || youtubeId(v), "Enter a valid YouTube video link.")
      .default(""),
    invitationTitle: text(120),
    eyebrow: text(120),
    invitation: text(300),
    invitationBody: text(600),
    yesLabel: text(80),
    noLabel: text(80),
    noResponses: z.array(text(240)).min(1).max(16),
    connecting: text(160),
    celebrationTitle: text(120),
    celebration: text(600),
    gameTitle: text(120),
    gameInstructions: text(600),
    heartMessages: z.array(text(240)).min(1).max(16),
    wrongMessages: z.array(text(240)).min(1).max(16),
    gameComplete: text(600),
    activityTitle: text(120),
    activityPrompt: text(300),
    activities: z.array(activitySchema).min(1).max(12),
    dateTitle: text(120),
    datePrompt: text(300),
    placeTitle: text(120),
    placePrompt: text(300),
    notification: text(240),
    sender: text(80),
    greeting: text(240),
    messageTitle: text(120),
    messageTemplate: text(2000),
    customClosing: text(600),
    finalTitle: text(120),
    finalHeading: text(240),
    finalEmoticon: z.enum(emoticonIds).default("love"),
    finalClosing: text(600),
    eventTitle: text(120),
  })
  .strict()
  .superRefine((v, ctx) => {
    if (new Set(v.activities.map((a) => a.id)).size !== v.activities.length)
      ctx.addIssue({ code: "custom", message: "Activity IDs must be unique" });
    if (new TextEncoder().encode(JSON.stringify(v)).length > 32000)
      ctx.addIssue({ code: "custom", message: "Content exceeds 32 KB" });
  });
export type Content = z.infer<typeof contentSchema>;
export const defaults: Content = {
  bootTitle: "Loading the love system…",
  desktopNote:
    "What I'm hoping for:\n\n• Good food\n• Conversation that never runs out\n• Memories we make together\n• You ♡",
  soundtrackTitle: "Our tomorrow ♡",
  youtubeUrl: "",
  invitationTitle: "An invitation for you",
  eyebrow: "Just for you • 1 new message",
  invitation: "Will you\ngo on a date with me?",
  invitationBody:
    "Save your work for a bit, and let's turn one day\ninto a good memory together. ♡",
  yesLabel: "Yes! ♡",
  noLabel: "No",
  noResponses: [
    "Are you sure? 🥺",
    "Really?",
    "Hmm... that's a little odd.",
    "The system couldn't process that response.",
    "Try clicking the other button.",
    "The heart program isn't responding.",
  ],
  connecting: "Connecting two hearts…",
  celebrationTitle: "Connection successful!",
  celebration: "I knew you would!\nLet's plan a wonderful day together.",
  gameTitle: "Heart Sweeper ♡",
  gameInstructions:
    "Find the five hidden hearts. The numbers show how many hearts are nearby. A mistake won't stop you — keep going!",
  heartMessages: [
    "One heart — it's yours! ♡",
    "One more little thrill!",
    "One step closer to you.",
  ],
  wrongMessages: [
    "No heart here. Try again! ♡",
    "A little slip! Try another square.",
  ],
  gameComplete:
    "You found all five hearts!\nThough mine was already yours. ♡",
  activityTitle: "Our little plan",
  activityPrompt: "What should we do together?",
  activities: [
    {
      id: "coffee",
      name: "Get coffee and talk for hours",
      places: ["A cozy little coffee shop", "A downtown coffee shop"],
    },
    {
      id: "dinner",
      name: "Have dinner together",
      places: ["Our favorite restaurant", "Cook a meal together at home"],
    },
    {
      id: "movie",
      name: "Watch a movie",
      places: ["The movie theater", "A movie night at home"],
    },
    {
      id: "walk",
      name: "Walk and watch the sunset",
      places: ["The national park", "By the riverside"],
    },
    {
      id: "dessert",
      name: "Get dessert",
      places: ["A little bakery", "The ice cream place"],
    },
  ],
  dateTitle: "Date calendar",
  datePrompt: "When are you free?",
  placeTitle: "Meeting place",
  placePrompt: "Where should we meet?",
  notification: "New message from {sender}.",
  sender: "Someone thinking of you",
  greeting: "Hi, you :)",
  messageTitle: "A message for you — Mail",
  messageTemplate:
    "Our date is set!\n\n{activity}\n{date}, {time}\n{place}\n\nEven with every hidden heart found, I'd still choose you.\n\n{customClosing}",
  customClosing: "Can't wait for the moment we meet. ♡",
  finalTitle: "Our date.txt — Notepad",
  finalHeading: "Our next\ngood memory.",
  finalEmoticon: "love",
  finalClosing: "So happy to share this day with you. ♡",
  eventTitle: "Our date ♡",
};
export function freshContent(): Content {
  return structuredClone(defaults);
}
export type Share = {
  id: string;
  content: Content;
  createdAt: number;
  editUntil: number;
  finalized: boolean;
};
export const shareSchema = z
  .object({
    id: z.string().regex(/^[A-Za-z0-9_-]{6,40}$/),
    content: contentSchema,
    createdAt: z.number().finite(),
    editUntil: z.number().finite(),
    finalized: z.boolean(),
  })
  .strict();
