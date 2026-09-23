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
    soundtrackTitle: text(120).default("Бидний маргааш ♡"),
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
  bootTitle: "Хайрын систем ачаалж байна…",
  desktopNote:
    "Миний хүсэн хүлээж буй зүйлс:\n\n• Амттай хоол\n• Дуусашгүй яриа\n• Хамтдаа бүтээх дурсамж\n• Чи ♡",
  soundtrackTitle: "Бидний маргааш ♡",
  youtubeUrl: "",
  invitationTitle: "Чамд зориулсан урилга",
  eyebrow: "Зөвхөн чамд • 1 шинэ зурвас",
  invitation: "Надтай болзоонд\nявах уу?",
  invitationBody:
    "Ажлаа түр хадгалаад, надтай хамт нэг өдрийг\nсайхан дурсамж болгоё. ♡",
  yesLabel: "Тийм ээ! ♡",
  noLabel: "Үгүй",
  noResponses: [
    "Итгэлтэй байна уу? 🥺",
    "Нээрээ гэж үү?",
    "Хмм… нэг л сонин байна даа.",
    "Систем энэ хариуг боловсруулж чадсангүй.",
    "Нөгөө товчийг дараад үзээрэй.",
    "Зүрхний програм хариу өгөхгүй байна.",
  ],
  connecting: "Хоёр зүрхийг холбож байна…",
  celebrationTitle: "Холболт амжилттай!",
  celebration: "Тэгнэ гэж мэдэж байсан юм аа!\nХамтдаа нэг гоё өдөр төлөвлөе.",
  gameTitle: "Heart Sweeper ♡",
  gameInstructions:
    "Таван нуугдсан зүрхийг олоорой. Тоонууд нь ойрхон байгаа зүрхний тоо. Алдаа гарсан ч үргэлжлүүлж болно!",
  heartMessages: [
    "Нэг зүрх — чинийх! ♡",
    "Бас нэг бяцхан догдлол!",
    "Чам руу нэг алхам ойртлоо.",
  ],
  wrongMessages: [
    "Энд зүрх алга. Дахиад оролдоорой! ♡",
    "Бяцхан алдаа! Өөр нүдийг нээгээрэй.",
  ],
  gameComplete:
    "Таван зүрхийг бүгдийг оллоо!\nХарин миний зүрх аль хэдийн чинийх болсон. ♡",
  activityTitle: "Бидний жижигхэн төлөвлөгөө",
  activityPrompt: "Хоёулаа юу хийвэл гоё вэ?",
  activities: [
    {
      id: "coffee",
      name: "Кофе ууж, удаан ярилцах",
      places: ["Тухтай жижиг кофе шоп", "Хотын төвийн кофе шоп"],
    },
    {
      id: "dinner",
      name: "Хамтдаа оройн хоол идэх",
      places: ["Дуртай ресторан", "Гэртээ хамт хоол хийх"],
    },
    {
      id: "movie",
      name: "Кино үзэх",
      places: ["Кино театр", "Гэрийн кино үдэш"],
    },
    {
      id: "walk",
      name: "Нар жаргахыг харан алхах",
      places: ["Үндэсний цэцэрлэгт хүрээлэн", "Голын эрэг"],
    },
    {
      id: "dessert",
      name: "Амттан идэх",
      places: ["Жижигхэн нарийн боовны газар", "Зайрмагны газар"],
    },
  ],
  dateTitle: "Болзооны хуанли",
  datePrompt: "Чиний завтай өдөр хэзээ вэ?",
  placeTitle: "Уулзах газар",
  placePrompt: "Хаана уулзах вэ?",
  notification: "{sender}-ээс шинэ зурвас ирлээ.",
  sender: "Чамайг бодож байгаа хүн",
  greeting: "Сайн уу, чи минь :)",
  messageTitle: "Чамд ирсэн зурвас — Mail",
  messageTemplate:
    "Бидний болзоо батлагдлаа!\n\n{activity}\n{date}, {time}\n{place}\n\nБүх нуугдсан зүрхийг олсон ч би чамайг л сонгоно.\n\n{customClosing}",
  customClosing: "Уулзах мөчөө тэсэн ядан хүлээж байна. ♡",
  finalTitle: "Бидний болзоо.txt — Notepad",
  finalHeading: "Бидний дараагийн\nсайхан дурсамж.",
  finalEmoticon: "love",
  finalClosing: "Энэ өдрийг чамтай хуваалцахдаа баяртай байна. ♡",
  eventTitle: "Бидний болзоо ♡",
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
    id: z.string().regex(/^[A-Za-z0-9_-]{8}$/),
    content: contentSchema,
    createdAt: z.number().finite(),
    editUntil: z.number().finite(),
    finalized: z.boolean(),
  })
  .strict();
