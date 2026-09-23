/* oxlint-disable typescript/no-floating-promises */
import test from 'node:test';
import assert from 'node:assert/strict';
import { loveReducer, initialState, noMessages } from '../lib/love-machine.ts';
import { newSnake, stepSnake, foodFor, GRID } from '../lib/snake-engine.ts';
import {
  calendarEvent,
  dateConfig,
  emptyPlan,
  activities,
  planConfig,
  dateMessage,
  isFuturePlan,
  futureTimes,
} from '../lib/date-config.ts';
import { sharePlanText, storyFileName } from '../lib/share-card.ts';
import {
  defaultShareContent,
  sanitizeShareContent,
} from '../lib/share-content.ts';

test('editable activities keep their own sanitized place choices', () => {
  const content = sanitizeShareContent({
    ...defaultShareContent,
    activities: [
      {
        id: 'coffee',
        NZ: 'ignored',
        label: ' Coffee ',
        places: [' The downtown café ', ''],
      },
      { id: 'walk', label: 'Walk', places: ['The park'] },
    ],
  });
  assert.deepEqual(content.activities, [
    { id: 'coffee', label: 'Coffee', places: ['The downtown café'] },
    { id: 'walk', label: 'Walk', places: ['The park'] },
  ]);
});
test('invitation completes through the bonus game and cat ending', () => {
  let s = initialState;
  for (const type of [
    'BOOT_DONE',
    'ACCEPT',
    'NEXT',
    'NEXT',
    'NEXT',
    'PLAY',
    'WON',
    'NEXT',
    'NEXT',
  ])
    s = loveReducer(s, { type, score: 7 });
  assert.equal(s.scene, 'ACTIVITY_PICKER');
  s = loveReducer(s, { type: 'SELECT_ACTIVITY', activity: activities[3] });
  s = loveReducer(s, { type: 'SELECT_DATE', day: '2099-09-11', time: '19:30' });
  s = loveReducer(s, { type: 'SELECT_PLACE', place: 'The riverside park' });
  assert.equal(s.scene, 'MESSAGE_NOTIFICATION');
  s = loveReducer(s, { type: 'OPEN_MESSAGE' });
  assert.equal(s.scene, 'MESSAGE');
  assert.match(dateMessage(s.plan), /19:30/);
  assert.match(dateMessage(s.plan), /The riverside park/);
  s = loveReducer(s, { type: 'VIEW_PLAN' });
  assert.equal(s.scene, 'DATE_DETAILS');
});
test('duplicate clicks and out of order game events cannot jump scenes', () => {
  let s = loveReducer(initialState, { type: 'BOOT_DONE' });
  s = loveReducer(s, { type: 'ACCEPT' });
  assert.equal(loveReducer(s, { type: 'ACCEPT' }), s);
  assert.equal(loveReducer(s, { type: 'SKIP' }), s);
  assert.equal(loveReducer(s, { type: 'WON' }), s);
});
test('No cycles playful replies indefinitely; only Yes advances the invitation', () => {
  let s = { ...initialState, scene: 'INVITATION' };
  for (let i = 0; i < 100; i++) {
    s = loveReducer(s, { type: 'DECLINE' });
    assert.equal(s.scene, 'INVITATION');
    assert.equal(s.noAttempts, (i % noMessages.length) + 1);
    assert.ok(noMessages[s.noAttempts - 1]);
  }
  assert.equal(loveReducer(s, { type: 'ACCEPT' }).scene, 'YES_PROCESSING');
  assert.deepEqual(
    loveReducer({ ...s, scene: 'DATE_DETAILS' }, { type: 'RETURN' }),
    {
      scene: 'INVITATION',
      noAttempts: 0,
      plan: emptyPlan,
    },
  );
});
test('Snake cannot be skipped and fewer than seven hearts cannot unlock pickers', () => {
  for (const scene of ['GAME_PROMPT', 'LOVE_SNAKE']) {
    const s = { ...initialState, scene };
    for (const action of [
      { type: 'SKIP' },
      { type: 'NEXT' },
      { type: 'SELECT_ACTIVITY', activity: activities[0] },
      { type: 'OPEN_MESSAGE' },
      { type: 'VIEW_PLAN' },
      { type: 'WON', score: 6 },
    ])
      assert.equal(loveReducer(s, action), s);
  }
  assert.equal(
    loveReducer(
      { ...initialState, scene: 'LOVE_SNAKE' },
      { type: 'WON', score: 7 },
    ).scene,
    'GAME_COMPLETE',
  );
});
test('picker validation blocks empty places, past dates and invalid dates', () => {
  let s = { ...initialState, scene: 'ACTIVITY_PICKER' };
  assert.equal(
    loveReducer(s, { type: 'SELECT_ACTIVITY', activity: 'invalid' }),
    s,
  );
  s = loveReducer(s, { type: 'SELECT_ACTIVITY', activity: activities[0] });
  for (const day of ['2020-01-01', '2099-02-30', 'bad'])
    assert.equal(
      loveReducer(s, { type: 'SELECT_DATE', day, time: '18:00' }),
      s,
    );
  assert.equal(isFuturePlan('2099-02-28', '25:00'), false);
  s = loveReducer(s, { type: 'SELECT_DATE', day: '2099-09-11', time: '19:30' });
  assert.equal(loveReducer(s, { type: 'SELECT_PLACE', place: '   ' }), s);
  assert.equal(
    loveReducer(s, { type: 'SELECT_PLACE', place: 'x'.repeat(71) }),
    s,
  );
});
test('going back preserves picks and changing activities clears the old venue', () => {
  let s = {
    ...initialState,
    scene: 'PLACE_PICKER',
    plan: {
      activity: activities[0],
      day: '2099-09-11',
      time: '19:30',
      place: 'A cozy cafe',
    },
  };
  s = loveReducer(s, { type: 'BACK' });
  assert.equal(s.scene, 'DATE_PICKER');
  assert.equal(s.plan.time, '19:30');
  s = loveReducer(s, { type: 'BACK' });
  assert.equal(s.scene, 'ACTIVITY_PICKER');
  s = loveReducer(s, { type: 'SELECT_ACTIVITY', activity: activities[3] });
  assert.equal(s.plan.place, '');
});
test('the calendar download and Nokia message contain the same picked plan', () => {
  const plan = {
    activity: activities[3],
    day: '2099-09-11',
    time: '19:30',
    place: 'Our park, by the lake',
  };
  const config = planConfig(plan),
    message = dateMessage(plan),
    event = calendarEvent(config);
  assert.ok(message.includes(config.date));
  assert.ok(message.includes(config.time));
  assert.ok(message.includes(plan.place));
  assert.ok(
    event
      .replace(/\r\n /g, '')
      .includes(`SUMMARY:Our date: ${activities[3]}`),
  );
  assert.match(event, /LOCATION:Our park\\, by the lake/);
  assert.equal(new Date(config.startsAt).getHours(), 19);
  assert.equal(
    new Date(config.endsAt) - new Date(config.startsAt),
    120 * 60000,
  );
});
test('snake uses discrete steps, wraps edges, and rejects reversal', () => {
  let s = newSnake();
  assert.equal(stepSnake(s, 'left').body[0].x, 6);
  s = {
    ...s,
    body: [
      { x: GRID - 1, y: 0 },
      { x: GRID - 2, y: 0 },
    ],
  };
  assert.deepEqual(stepSnake(s).body[0], { x: 0, y: 0 });
});
test('hearts grow the snake and the seventh heart freezes the game', () => {
  let s = newSnake();
  for (let i = 0; i < 7; i++) {
    s = { ...s, food: { x: s.body[0].x + 1, y: 9 } };
    s = stepSnake(s, 'right', () => 0.5);
  }
  assert.equal(s.score, 7);
  assert.equal(s.body.length, 10);
  assert.equal(s.status, 'won');
  assert.equal(stepSnake(s), s);
});
test('self collision is recoverable and vacating the tail is legal', () => {
  const s = {
    ...newSnake(),
    body: [
      { x: 3, y: 3 },
      { x: 3, y: 4 },
      { x: 2, y: 4 },
      { x: 2, y: 3 },
    ],
    direction: 'up',
  };
  assert.equal(stepSnake(s, 'left').status, 'playing');
  const tangled = { ...s, body: [...s.body, { x: 1, y: 3 }] };
  assert.equal(stepSnake(tangled, 'left').status, 'collision');
  assert.equal(newSnake().status, 'playing');
});
test('food always occupies an unoccupied square', () => {
  const s = newSnake();
  for (const r of [0, 0.25, 0.5, 0.99, 1])
    assert.ok(
      !s.body.some((p) => {
        const food = foodFor(s.body, () => r);
        return p.x === food.x && p.y === food.y;
      }),
    );
});
test('unconfigured date never fabricates a calendar commitment', () => {
  assert.equal(calendarEvent(), null);
  assert.equal(
    calendarEvent({ ...dateConfig, startsAt: 'bad', endsAt: 'bad' }),
    null,
  );
});
test('calendar event escapes text, uses UTC, and folds UTF8 lines', () => {
  const event = calendarEvent({
    ...dateConfig,
    startsAt: '2026-10-10T18:00:00+08:00',
    endsAt: '2026-10-10T20:00:00+08:00',
    location: 'Cafe, lake; side',
    message: '♥'.repeat(60) + '\nSee you',
  });
  assert.match(event, /DTSTART:20261010T100000Z/);
  assert.match(event, /LOCATION:Cafe\\, lake\\; side/);
  assert.ok(event.split('\r\n').every((line) => Buffer.byteLength(line) <= 75));
  assert.equal(
    calendarEvent({
      ...dateConfig,
      startsAt: '2026-10-10',
      endsAt: '2026-10-09',
    }),
    null,
  );
});

test('time menu excludes elapsed slots and handles midnight and month rollover', () => {
  const now = new Date(2026, 8, 30, 18, 30, 0);
  assert.equal(futureTimes('2026-09-30', now)[0], '18:45');
  assert.equal(futureTimes('2026-09-29', now).length, 0);
  assert.equal(futureTimes('2026-10-01', now).length, 96);
  assert.equal(
    futureTimes('2026-09-30', new Date(2026, 8, 30, 23, 59)).length,
    0,
  );
  assert.equal(futureTimes('2026-10-01', now)[0], '00:00');
});

test('story sharing uses the exact confirmed plan', () => {
  const plan = {
    activity: 'Walk and watch the sunset',
    day: '2099-09-11',
    time: '19:30',
    place: 'The riverside park',
  };
  const text = sharePlanText(plan);
  assert.match(text, /Walk and watch the sunset/);
  assert.match(text, /2099\.09\.11, 19:30/);
  assert.match(text, /The riverside park/);
  assert.equal(storyFileName(plan), 'our-date-2099-09-11-final.png');
});
