'use client';
import { useEffect, useRef, useState } from 'react';
import { Calendar } from '@/components/ui/calendar';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  NativeSelect,
  NativeSelectOption,
} from '@/components/ui/native-select';
import { enGB } from 'date-fns/locale';
import {
  localDay,
  isFuturePlan,
  futureTimes,
  type DatePlan,
} from '@/lib/date-config';
import type { LoveAction, Scene } from '@/lib/love-machine';
import type { ShareContent } from '@/lib/share-content';
function NokiaMenu({
  items,
  value,
  onChange,
  onConfirm,
  label,
}: {
  items: string[];
  value: string;
  onChange: (value: string) => void;
  onConfirm: () => void;
  label: string;
}) {
  return (
    <RadioGroup
      className="nokia-menu"
      value={value}
      onValueChange={(v) => onChange(String(v))}
      aria-label={label}
    >
      {items.map((item, i) => (
        <label
          key={item}
          className={`nokia-menu-row ${value === item ? 'chosen' : ''}`}
        >
          <RadioGroupItem
            value={item}
            onClick={() => {
              if (value === item) onConfirm();
            }}
          />
          <span className="menu-index" aria-hidden="true">
            {String(i + 1).padStart(2, '0')}
          </span>
          <span>{item}</span>
          <span className="selection-arrow" aria-hidden="true">
            ◀
          </span>
        </label>
      ))}
    </RadioGroup>
  );
}
export function DatePickers({
  scene,
  plan,
  dispatch,
  onSelect,
  content,
  editing = false,
  onContentChange,
}: {
  scene: Scene;
  plan: DatePlan;
  dispatch: (action: LoveAction) => void;
  onSelect: () => void;
  content: ShareContent;
  editing?: boolean;
  onContentChange?: (content: ShareContent) => void;
}) {
  const activities = content.activities;
  const labels = activities.map((item) => item.label);
  const [activity, setActivity] = useState(plan.activity || labels[0]);
  const [activeId, setActiveId] = useState(
    activities.find((item) => item.label === plan.activity)?.id ??
      activities[0]?.id,
  );
  const [day, setDay] = useState(() => {
    if (plan.day) return new Date(`${plan.day}T12:00:00`);
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(12, 0, 0, 0);
    return tomorrow;
  });
  const [month, setMonth] = useState(
    () => new Date(day.getFullYear(), day.getMonth(), 1),
  );
  const [now, setNow] = useState(() => new Date());
  const [time, setTime] = useState(plan.time),
    [error, setError] = useState('');
  const slots = futureTimes(localDay(day), now);
  const chosenTime = slots.includes(time) ? time : (slots[0] ?? '');
  const activeEntry =
    activities.find((item) =>
      editing
        ? item.id === activeId
        : item.label === (plan.activity || activity),
    ) ?? activities[0];
  const places = activeEntry?.places ?? ['New place'];
  const customLabel = 'Enter another place...';
  const [place, setPlace] = useState(
    places.includes(plan.place)
      ? plan.place
      : plan.place
        ? customLabel
        : places[0],
  );
  const [custom, setCustom] = useState(
    places.includes(plan.place) ? '' : plan.place,
  );
  const title = useRef<HTMLHeadingElement>(null),
    venue = useRef<HTMLInputElement>(null);
  useEffect(() => {
    title.current?.focus({ preventScroll: true });
    const timer = setInterval(() => setNow(new Date()), 15000);
    const refresh = () => setNow(new Date());
    window.addEventListener('focus', refresh);
    return () => {
      clearInterval(timer);
      window.removeEventListener('focus', refresh);
    };
  }, []);
  const number =
    scene === 'ACTIVITY_PICKER' ? 1 : scene === 'DATE_PICKER' ? 2 : 3;
  const updateActivities = (next: ShareContent['activities']) =>
    onContentChange?.({ ...content, activities: next });
  const select = () => {
    if (number === 1)
      dispatch({
        type: 'SELECT_ACTIVITY',
        activity,
        allowedActivities: labels,
      });
    if (number === 2) {
      if (!isFuturePlan(localDay(day), chosenTime)) {
        setError('Pick a day and time in the future.');
        setNow(new Date());
        return;
      }
      dispatch({ type: 'SELECT_DATE', day: localDay(day), time: chosenTime });
    }
    if (number === 3) {
      const value = (place === customLabel ? custom : place).trim();
      if (!value) {
        setError("Enter the name of where you'll meet.");
        venue.current?.focus();
        return;
      }
      if (!isFuturePlan(plan.day, plan.time)) {
        setError('That time has passed. Go back and pick a new one.');
        return;
      }
      dispatch({ type: 'SELECT_PLACE', place: value });
    }
    onSelect();
  };
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const currentMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  return (
    <>
      <section
        className={`picker-scene picker-${number} transition-in`}
        aria-labelledby="picker-title"
      >
        <div className="picker-header">
          <span>OUR LITTLE PLAN</span>
          <span>{number}/3</span>
        </div>
        <h1 id="picker-title" tabIndex={-1} ref={title}>
          {number === 1
            ? 'WHAT SHALL WE DO?'
            : number === 2
              ? 'WHEN SHALL WE MEET?'
              : 'WHERE SHALL WE MEET?'}
        </h1>
        <p className="picker-subtitle">
          {number === 1
            ? "You pick. I'll bring the excitement."
            : number === 2
              ? 'One day on the calendar. Just for us.'
              : plan.activity}
        </p>
        {number === 1 && !editing && (
          <NokiaMenu
            items={labels}
            value={activity}
            onChange={setActivity}
            onConfirm={select}
            label="Choose what to do together"
          />
        )}
        {number === 1 && editing && (
          <div className="inline-list-editor" aria-label="Edit the activities">
            {activities.map((item, index) => (
              <div className="inline-list-row" key={item.id}>
                <span>{String(index + 1).padStart(2, '0')}</span>
                <input
                  aria-label={`Activity ${index + 1}`}
                  value={item.label}
                  maxLength={70}
                  onChange={(event) =>
                    updateActivities(
                      activities.map((entry) =>
                        entry.id === item.id
                          ? { ...entry, label: event.target.value }
                          : entry,
                      ),
                    )
                  }
                />
                <button
                  aria-label={`Remove ${item.label}`}
                  disabled={activities.length === 1}
                  onClick={() =>
                    updateActivities(
                      activities.filter((entry) => entry.id !== item.id),
                    )
                  }
                >
                  −
                </button>
              </div>
            ))}
            <button
              className="inline-add-button"
              disabled={activities.length >= 10}
              onClick={() =>
                updateActivities([
                  ...activities,
                  {
                    id: `activity-${Date.now()}`,
                    label: 'New activity',
                    places: ['New place'],
                  },
                ])
              }
            >
              ＋ ADD AN ACTIVITY
            </button>
          </div>
        )}
        {number === 2 && (
          <div className="date-picker-content">
            <div className="calendar-section">
              <nav className="month-navigation" aria-label="Change month">
                <button
                  aria-label="Previous month"
                  disabled={month <= currentMonth}
                  onClick={() =>
                    setMonth(
                      new Date(month.getFullYear(), month.getMonth() - 1, 1),
                    )
                  }
                >
                  ◀
                </button>
                <span aria-live="polite">
                  {month.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                </span>
                <button
                  aria-label="Next month"
                  onClick={() =>
                    setMonth(
                      new Date(month.getFullYear(), month.getMonth() + 1, 1),
                    )
                  }
                >
                  ▶
                </button>
              </nav>
              <Calendar
                className="lcd-calendar"
                locale={enGB}
                mode="single"
                required
                selected={day}
                month={month}
                onMonthChange={setMonth}
                hideNavigation
                onSelect={(selected) => {
                  setDay(selected);
                  setError('');
                }}
                onDayClick={(clicked, modifiers) => {
                  if (
                    !modifiers.disabled &&
                    localDay(clicked) === localDay(day)
                  )
                    select();
                }}
                disabled={{ before: today }}
                startMonth={currentMonth}
                weekStartsOn={1}
                formatters={{
                  formatWeekdayName: (d) =>
                    ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'][d.getDay()],
                }}
                labels={{
                  labelGrid: (d) =>
                    d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
                  labelDayButton: (d, modifiers) =>
                    `${d.toLocaleDateString('en-US', { month: 'long' })} ${d.getDate()}${modifiers.selected ? ', selected' : ''}${modifiers.today ? ', today' : ''}`,
                }}
              />
            </div>
            <div className="time-row">
              <label htmlFor="date-time">WHAT TIME?</label>
              <NativeSelect
                id="date-time"
                value={chosenTime}
                onChange={(e) => {
                  setTime(e.target.value);
                  setError('');
                }}
                disabled={!slots.length}
              >
                {!slots.length && (
                  <NativeSelectOption value="">
                    Today's times are over
                  </NativeSelectOption>
                )}
                {slots.map((slot) => (
                  <NativeSelectOption key={slot} value={slot}>
                    {slot}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
              <span className="time-hint">YOUR LOCAL TIME</span>
            </div>
          </div>
        )}
        {number === 3 && !editing && (
          <>
            <NokiaMenu
              items={[...places, customLabel]}
              value={place}
              onChange={(v) => {
                setPlace(v);
                setError('');
              }}
              onConfirm={select}
              label="Choose where to meet"
            />
            {place === customLabel && (
              <div className="custom-place">
                <label htmlFor="venue">NAME OR ADDRESS</label>
                <input
                  ref={venue}
                  id="venue"
                  type="text"
                  maxLength={70}
                  value={custom}
                  placeholder="That place you love..."
                  onChange={(e) => {
                    setCustom(e.target.value);
                    setError('');
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') select();
                  }}
                  autoComplete="off"
                />
                <span>{custom.length}/70</span>
              </div>
            )}
          </>
        )}
        {number === 3 && editing && activeEntry && (
          <div
            className="inline-list-editor place-list-editor"
            aria-label="Edit the places"
          >
            <p className="edit-only-warning">
              ⚠ Each activity has its own places. Edit each activity's places
              separately.
            </p>
            <strong>{activeEntry.label}</strong>
            {activeEntry.places.map((item, index) => (
              <div
                className="inline-list-row"
                key={`${activeEntry.id}-${index}`}
              >
                <span>{String(index + 1).padStart(2, '0')}</span>
                <input
                  value={item}
                  maxLength={70}
                  aria-label={`Place ${index + 1}`}
                  onChange={(event) =>
                    updateActivities(
                      activities.map((entry) =>
                        entry.id === activeEntry.id
                          ? {
                              ...entry,
                              places: entry.places.map((place, placeIndex) =>
                                placeIndex === index
                                  ? event.target.value
                                  : place,
                              ),
                            }
                          : entry,
                      ),
                    )
                  }
                />
                <button
                  aria-label={`Remove ${item}`}
                  disabled={activeEntry.places.length === 1}
                  onClick={() =>
                    updateActivities(
                      activities.map((entry) =>
                        entry.id === activeEntry.id
                          ? {
                              ...entry,
                              places: entry.places.filter(
                                (_, placeIndex) => placeIndex !== index,
                              ),
                            }
                          : entry,
                      ),
                    )
                  }
                >
                  −
                </button>
              </div>
            ))}
            <button
              className="inline-add-button"
              disabled={activeEntry.places.length >= 10}
              onClick={() =>
                updateActivities(
                  activities.map((entry) =>
                    entry.id === activeEntry.id
                      ? { ...entry, places: [...entry.places, 'New place'] }
                      : entry,
                  ),
                )
              }
            >
              ＋ ADD A PLACE
            </button>
            <div className="activity-place-tabs" aria-label="Choose an activity">
              {activities.map((item) => (
                <button
                  key={item.id}
                  className={item.id === activeEntry.id ? 'active' : ''}
                  onClick={() => setActiveId(item.id)}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>
        )}
        {!editing && (
          <p className="confirm-hint">Tap your choice again to confirm.</p>
        )}
        <output className="picker-error" aria-live="polite">
          {error}
        </output>
        <div className="picker-progress" aria-label={`Step ${number} of 3`}>
          <span className="done">WHAT</span>
          <span aria-hidden="true">···</span>
          <span className={number >= 2 ? 'done' : ''}>WHEN</span>
          <span aria-hidden="true">···</span>
          <span className={number === 3 ? 'done' : ''}>WHERE</span>
        </div>
      </section>
      {!editing && (
        <footer className="softkeys picker-softkeys">
          {number > 1 ? (
            <button onClick={() => dispatch({ type: 'BACK' })}>◀ Back</button>
          ) : (
            <span className="picker-soft-note">JUST THE TWO OF US ♥</span>
          )}
          <button
            className="confirm-button"
            onClick={select}
            disabled={number === 2 && !chosenTime}
          >
            {number === 3 ? 'Set the date' : 'Confirm'}{' '}
            <span aria-hidden="true">▶</span>
          </button>
        </footer>
      )}
    </>
  );
}
