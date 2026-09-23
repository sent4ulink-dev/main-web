export type Point = { x: number; y: number };
export type Direction = 'up' | 'down' | 'left' | 'right';
export type SnakeState = {
  body: Point[];
  direction: Direction;
  food: Point;
  score: number;
  status: 'playing' | 'collision' | 'won';
};
export const GRID = 18,
  TARGET = 7;
export const vectors: Record<Direction, Point> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};
export const opposite: Record<Direction, Direction> = {
  up: 'down',
  down: 'up',
  left: 'right',
  right: 'left',
};
export function foodFor(body: Point[], random = Math.random): Point {
  const free: Point[] = [];
  for (let y = 0; y < GRID; y++)
    for (let x = 0; x < GRID; x++)
      if (!body.some((p) => p.x === x && p.y === y)) free.push({ x, y });
  return (
    free[Math.min(free.length - 1, Math.floor(random() * free.length))] ?? {
      x: 0,
      y: 0,
    }
  );
}
export function newSnake(): SnakeState {
  return {
    body: [
      { x: 5, y: 9 },
      { x: 4, y: 9 },
      { x: 3, y: 9 },
    ],
    direction: 'right',
    food: { x: 10, y: 9 },
    score: 0,
    status: 'playing',
  };
}
export function stepSnake(
  state: SnakeState,
  requested: Direction = state.direction,
  random = Math.random,
): SnakeState {
  if (state.status !== 'playing') return state;
  const direction =
      requested === opposite[state.direction] ? state.direction : requested,
    v = vectors[direction];
  const head = {
    x: (state.body[0].x + v.x + GRID) % GRID,
    y: (state.body[0].y + v.y + GRID) % GRID,
  };
  const eating = head.x === state.food.x && head.y === state.food.y;
  const body = eating ? state.body : state.body.slice(0, -1);
  if (body.some((p) => p.x === head.x && p.y === head.y))
    return { ...state, direction, status: 'collision' };
  const next = [head, ...body],
    score = state.score + (eating ? 1 : 0);
  return {
    body: next,
    direction,
    score,
    food: eating ? foodFor(next, random) : state.food,
    status: score >= TARGET ? 'won' : 'playing',
  };
}
