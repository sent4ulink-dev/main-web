export type Board = {
  hearts: number[];
  wrong: number[];
  revealed: number[];
  started: boolean;
};
export const emptyBoard = (): Board => ({
  hearts: [],
  wrong: [],
  revealed: [],
  started: false,
});
export function reveal(
  board: Board,
  index: number,
  random = Math.random,
): Board {
  if (index < 0 || index >= 36 || board.revealed.includes(index)) return board;
  let b = board;
  if (!b.started) {
    const choices = Array.from({ length: 36 }, (_, i) => i).filter(
      (i) => i !== index,
    );
    for (let i = choices.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [choices[i], choices[j]] = [choices[j], choices[i]];
    }
    b = {
      ...b,
      started: true,
      hearts: [index, ...choices.slice(0, 4)],
      wrong: choices.slice(4, 10),
    };
  }
  return { ...b, revealed: [...b.revealed, index] };
}
export const found = (b: Board) =>
  b.hearts.filter((i) => b.revealed.includes(i)).length;
export function nearby(b: Board, i: number) {
  return b.hearts.filter(
    (h) =>
      Math.abs(Math.floor(h / 6) - Math.floor(i / 6)) <= 1 &&
      Math.abs((h % 6) - (i % 6)) <= 1 &&
      h !== i,
  ).length;
}
