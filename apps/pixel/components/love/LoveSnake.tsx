'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Progress } from '@/components/ui/progress';
import {
  GRID,
  TARGET,
  newSnake,
  opposite,
  stepSnake,
  type Direction,
} from '@/lib/snake-engine';
import { Heart } from './Icons';
import { InlineEdit } from './InlineEdit';
import type { ShareContent } from '@/lib/share-content';
export function LoveSnake({
  onWin,
  onHeart,
  content,
  editing = false,
  onContentChange,
}: {
  onWin: (score: number) => void;
  onHeart: () => void;
  content: ShareContent;
  editing?: boolean;
  onContentChange?: (content: ShareContent) => void;
}) {
  const [game, setGame] = useState(newSnake),
    [mode, setMode] = useState<'ready' | 'playing' | 'paused'>('ready'),
    [message, setMessage] = useState(''),
    [editMessage, setEditMessage] = useState(0);
  const state = useRef(game),
    queue = useRef<Direction[]>([]),
    canvas = useRef<HTMLCanvasElement>(null),
    area = useRef<HTMLDivElement>(null),
    pointer = useRef<{ x: number; y: number } | null>(null);
  const steer = useCallback((dir: Direction) => {
    if (queue.current.length >= 2) return;
    const last = queue.current.at(-1) ?? state.current.direction;
    if (dir !== last && dir !== opposite[last]) queue.current.push(dir);
  }, []);
  const start = () => {
    if (state.current.status === 'collision') {
      const next = newSnake();
      state.current = next;
      setGame(next);
    }
    queue.current = [];
    setMode('playing');
    area.current?.focus();
  };
  useEffect(() => {
    const timer = setTimeout(() => setMessage(''), 850);
    return () => clearTimeout(timer);
  }, [message]);
  useEffect(() => {
    if (mode !== 'playing' || game.status !== 'playing') return;
    const timer = setInterval(() => {
      const old = state.current,
        next = stepSnake(old, queue.current.shift());
      state.current = next;
      setGame(next);
      if (next.score > old.score) {
        setMessage(content.snakeMessages[next.score - 1]);
        onHeart();
      }
      if (next.status === 'won') onWin(next.score);
    }, 170);
    return () => clearInterval(timer);
  }, [mode, game.status, onWin, onHeart, content.snakeMessages]);
  useEffect(() => {
    const keys: Record<string, Direction> = {
      ArrowUp: 'up',
      ArrowDown: 'down',
      ArrowLeft: 'left',
      ArrowRight: 'right',
      w: 'up',
      s: 'down',
      a: 'left',
      d: 'right',
    };
    const key = (e: KeyboardEvent) => {
      const dir = keys[e.key] ?? keys[e.key.toLowerCase()];
      if (dir && mode === 'playing') {
        e.preventDefault();
        steer(dir);
      }
      if (
        e.key === 'Escape' ||
        (e.code === 'Space' && e.target === area.current)
      ) {
        e.preventDefault();
        setMode((m) =>
          m === 'playing' ? 'paused' : m === 'paused' ? 'playing' : m,
        );
      }
    };
    const pause = () => setMode((m) => (m === 'playing' ? 'paused' : m));
    const visibility = () => {
      if (document.hidden) pause();
    };
    window.addEventListener('keydown', key);
    window.addEventListener('blur', pause);
    document.addEventListener('visibilitychange', visibility);
    return () => {
      window.removeEventListener('keydown', key);
      window.removeEventListener('blur', pause);
      document.removeEventListener('visibilitychange', visibility);
    };
  }, [mode, steer]);
  useEffect(() => {
    const ctx = canvas.current!.getContext('2d')!,
      unit = 10;
    ctx.clearRect(0, 0, 180, 180);
    ctx.fillStyle = '#20351b';
    for (let y = 0; y < GRID; y++)
      for (let x = 0; x < GRID; x++) {
        ctx.globalAlpha = 0.12;
        ctx.fillRect(x * unit, y * unit, 1, 1);
      }
    ctx.globalAlpha = 1;
    game.body.forEach((p, i) => {
      ctx.fillStyle = i === 0 ? '#20351b' : '#354d29';
      ctx.fillRect(p.x * unit + 1, p.y * unit + 1, 8, 8);
    });
    const head = game.body[0];
    ctx.fillStyle = '#9bb477';
    ctx.fillRect(head.x * unit + 3, head.y * unit + 3, 1, 1);
    ctx.fillRect(head.x * unit + 6, head.y * unit + 3, 1, 1);
    ctx.fillStyle = '#20351b';
    ['0110110', '1111111', '1111111', '0111110', '0011100', '0001000'].forEach(
      (row, y) =>
        row.split('').forEach((pixel, x) => {
          if (pixel === '1')
            ctx.fillRect(
              game.food.x * unit + x + 2,
              game.food.y * unit + y + 2,
              1,
              1,
            );
        }),
    );
  }, [game]);
  return (
    <section className="game-scene transition-in" aria-labelledby="snake-title">
      <div className="game-heading">
        <div>
          <p className="eyebrow">BONUS LEVEL / 01</p>
          <h1 id="snake-title">
            <InlineEdit
              value={content.gameTitle}
              editing={editing}
              onChange={(gameTitle) =>
                onContentChange?.({ ...content, gameTitle })
              }
            />
          </h1>
        </div>
        <Heart />
      </div>
      <div className="love-meter">
        <span>
          <InlineEdit
            value={content.gameMeterLabel}
            editing={editing}
            onChange={(gameMeterLabel) =>
              onContentChange?.({ ...content, gameMeterLabel })
            }
          />
        </span>
        <Progress
          className="pixel-progress"
          value={game.score}
          max={TARGET}
          aria-label={`${game.score} of 7 hearts collected`}
        />
        <span>
          {game.score}/{TARGET}
        </span>
      </div>
      <div
        className="game-area"
        ref={area}
        // Keyboard focus is required for the interactive canvas game and pause shortcut.
        // oxlint-disable-next-line jsx-a11y/no-noninteractive-tabindex
        tabIndex={0}
        role="application"
        aria-label="Love Snake. Move with the arrow keys or WASD. Space pauses. Edges wrap around."
        onPointerDown={(e) => {
          if (mode !== 'playing' || state.current.status !== 'playing') return;
          pointer.current = { x: e.clientX, y: e.clientY };
          e.currentTarget.setPointerCapture(e.pointerId);
        }}
        onPointerMove={(e) => {
          if (!pointer.current || mode !== 'playing') return;
          const dx = e.clientX - pointer.current.x,
            dy = e.clientY - pointer.current.y;
          if (Math.max(Math.abs(dx), Math.abs(dy)) < 18) return;
          steer(
            Math.abs(dx) > Math.abs(dy)
              ? dx > 0
                ? 'right'
                : 'left'
              : dy > 0
                ? 'down'
                : 'up',
          );
          pointer.current = { x: e.clientX, y: e.clientY };
        }}
        onPointerUp={() => {
          pointer.current = null;
        }}
        onPointerCancel={() => {
          pointer.current = null;
        }}
      >
        <canvas ref={canvas} width={180} height={180} aria-hidden="true" />
        {(mode !== 'playing' || game.status === 'collision') && (
          <div className="game-overlay">
            <Heart />
            <h2>
              {editing ? (
                <InlineEdit
                  value={content.gameReadyTitle}
                  editing
                  onChange={(gameReadyTitle) =>
                    onContentChange?.({ ...content, gameReadyTitle })
                  }
                />
              ) : game.status === 'collision' ? (
                'GOT A LITTLE TANGLED'
              ) : mode === 'paused' ? (
                'TAKE A BREAK'
              ) : (
                '7 HEARTS. ONE DATE.'
              )}
            </h2>
            <p>
              {editing ? (
                <InlineEdit
                  value={content.gameReadyMessage}
                  editing
                  onChange={(gameReadyMessage) =>
                    onContentChange?.({ ...content, gameReadyMessage })
                  }
                />
              ) : game.status === 'collision' ? (
                "Let's try again."
              ) : mode === 'paused' ? (
                'Your hearts are saved.'
              ) : (
                'Collect hearts. Edges wrap around.'
              )}
            </p>
            <button
              className="pixel-button"
              onClick={editing ? undefined : start}
            >
              {game.status === 'collision'
                ? 'TRY AGAIN'
                : mode === 'paused'
                  ? 'CONTINUE'
                  : 'START'}{' '}
              <span aria-hidden="true">▶</span>
            </button>
          </div>
        )}
      </div>
      {editing ? (
        <div className="snake-message-editor">
          <button
            onClick={() => setEditMessage((editMessage + 6) % 7)}
            aria-label="Previous heart message"
          >
            ◀
          </button>
          <p className="game-feedback">
            <small>{editMessage + 1}/7 · ON HEART PICKUP</small>
            <InlineEdit
              value={content.snakeMessages[editMessage]}
              editing
              onChange={(value) => {
                const snakeMessages = [...content.snakeMessages];
                snakeMessages[editMessage] = value;
                onContentChange?.({ ...content, snakeMessages });
              }}
            />
            <small>{editMessage + 1}/7</small>
          </p>
          <button
            onClick={() => setEditMessage((editMessage + 1) % 7)}
            aria-label="Next heart message"
          >
            ▶
          </button>
        </div>
      ) : (
        <p className="game-feedback" aria-live="polite">
          {message || 'Every heart brings me closer to you.'}
        </p>
      )}
      {!editing && (
        <div className="game-controls">
          <span className="control-hint">
            ARROWS / WASD
            <br />
            OR SWIPE TO STEER
          </span>
          <div className="dpad" aria-label="Direction controls">
            {(['up', 'left', 'down', 'right'] as Direction[]).map((dir, i) => (
              <button
                key={dir}
                className={dir}
                aria-label={
                  { up: 'Up', left: 'Left', down: 'Down', right: 'Right' }[
                    dir
                  ]
                }
                onClick={() => steer(dir)}
                disabled={mode !== 'playing'}
              >
                {['▲', '◀', '▼', '▶'][i]}
              </button>
            ))}
          </div>
          <button
            className="text-button"
            onClick={() =>
              setMode((m) =>
                m === 'playing' ? 'paused' : m === 'paused' ? 'playing' : m,
              )
            }
            disabled={mode === 'ready' || game.status !== 'playing'}
          >
            {mode === 'paused' ? 'Play' : 'Pause'}
          </button>
        </div>
      )}
      <p className="game-goal">
        <InlineEdit
          value={content.gameGoal}
          editing={editing}
          onChange={(gameGoal) => onContentChange?.({ ...content, gameGoal })}
        />
      </p>
    </section>
  );
}
