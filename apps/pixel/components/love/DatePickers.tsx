'use client';
import { useEffect, useRef, useState } from 'react';
import { Calendar } from '@/components/ui/calendar';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  NativeSelect,
  NativeSelectOption,
} from '@/components/ui/native-select';
import { mn } from 'date-fns/locale';
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
  const places = activeEntry?.places ?? ['Шинэ газар'];
  const customLabel = 'Өөр газар оруулах...';
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
        setError('Ирээдүйн өдөр, цаг сонгоорой.');
        setNow(new Date());
        return;
      }
      dispatch({ type: 'SELECT_DATE', day: localDay(day), time: chosenTime });
    }
    if (number === 3) {
      const value = (place === customLabel ? custom : place).trim();
      if (!value) {
        setError('Уулзах газрынхаа нэрийг оруулаарай.');
        venue.current?.focus();
        return;
      }
      if (!isFuturePlan(plan.day, plan.time)) {
        setError('Энэ цаг өнгөрсөн байна. Буцаад шинэ цаг сонгоорой.');
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
          <span>БИДНИЙ БЯЦХАН ТӨЛӨВЛӨГӨӨ</span>
          <span>{number}/3</span>
        </div>
        <h1 id="picker-title" tabIndex={-1} ref={title}>
          {number === 1
            ? 'ХАМТ ЮУ ХИЙХ ВЭ?'
            : number === 2
              ? 'ХЭЗЭЭ УУЛЗАХ ВЭ?'
              : 'ХААНА УУЛЗАХ ВЭ?'}
        </h1>
        <p className="picker-subtitle">
          {number === 1
            ? 'Чи сонго. Би догдлолоо аваад очъё.'
            : number === 2
              ? 'Хуанлийн нэг өдөр. Зөвхөн бидэнд.'
              : plan.activity}
        </p>
        {number === 1 && !editing && (
          <NokiaMenu
            items={labels}
            value={activity}
            onChange={setActivity}
            onConfirm={select}
            label="Хамт хийх зүйлээ сонгох"
          />
        )}
        {number === 1 && editing && (
          <div className="inline-list-editor" aria-label="Хийх зүйлсийг засах">
            {activities.map((item, index) => (
              <div className="inline-list-row" key={item.id}>
                <span>{String(index + 1).padStart(2, '0')}</span>
                <input
                  aria-label={`${index + 1}-р хийх зүйл`}
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
                  aria-label={`${item.label} устгах`}
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
                    label: 'Шинэ хийх зүйл',
                    places: ['Шинэ газар'],
                  },
                ])
              }
            >
              ＋ ХИЙХ ЗҮЙЛ НЭМЭХ
            </button>
          </div>
        )}
        {number === 2 && (
          <div className="date-picker-content">
            <div className="calendar-section">
              <nav className="month-navigation" aria-label="Сар солих">
                <button
                  aria-label="Өмнөх сар"
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
                  {month.getFullYear()} оны {month.getMonth() + 1}-р сар
                </span>
                <button
                  aria-label="Дараагийн сар"
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
                locale={mn}
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
                    ['Ня', 'Да', 'Мя', 'Лх', 'Пү', 'Ба', 'Бя'][d.getDay()],
                }}
                labels={{
                  labelGrid: (d) =>
                    `${d.getFullYear()} оны ${d.getMonth() + 1}-р сар`,
                  labelDayButton: (d, modifiers) =>
                    `${d.getMonth() + 1} сарын ${d.getDate()}${modifiers.selected ? ', сонгосон' : ''}${modifiers.today ? ', өнөөдөр' : ''}`,
                }}
              />
            </div>
            <div className="time-row">
              <label htmlFor="date-time">ХЭДЭН ЦАГТ?</label>
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
                    Өнөөдрийн цаг дууссан
                  </NativeSelectOption>
                )}
                {slots.map((slot) => (
                  <NativeSelectOption key={slot} value={slot}>
                    {slot}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
              <span className="time-hint">ТАНЫ ОРОН НУТГИЙН ЦАГ</span>
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
              label="Уулзах газраа сонгох"
            />
            {place === customLabel && (
              <div className="custom-place">
                <label htmlFor="venue">НЭР ЭСВЭЛ ХАЯГ</label>
                <input
                  ref={venue}
                  id="venue"
                  type="text"
                  maxLength={70}
                  value={custom}
                  placeholder="Чиний дуртай тэр газар..."
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
            aria-label="Газруудыг засах"
          >
            <p className="edit-only-warning">
              ⚠ Хийх зүйл бүр өөрийн газар сонголттой. Хийх зүйл тус бүрийн
              газрыг тусад нь засна уу.
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
                  aria-label={`${index + 1}-р газар`}
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
                  aria-label={`${item} устгах`}
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
                      ? { ...entry, places: [...entry.places, 'Шинэ газар'] }
                      : entry,
                  ),
                )
              }
            >
              ＋ ГАЗАР НЭМЭХ
            </button>
            <div className="activity-place-tabs" aria-label="Хийх зүйл сонгох">
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
          <p className="confirm-hint">Сонгосноо дахин дарвал батална.</p>
        )}
        <output className="picker-error" aria-live="polite">
          {error}
        </output>
        <div className="picker-progress" aria-label={`3 алхмын ${number}`}>
          <span className="done">ЮУ</span>
          <span aria-hidden="true">···</span>
          <span className={number >= 2 ? 'done' : ''}>ХЭЗЭЭ</span>
          <span aria-hidden="true">···</span>
          <span className={number === 3 ? 'done' : ''}>ХААНА</span>
        </div>
      </section>
      {!editing && (
        <footer className="softkeys picker-softkeys">
          {number > 1 ? (
            <button onClick={() => dispatch({ type: 'BACK' })}>◀ Буцах</button>
          ) : (
            <span className="picker-soft-note">ЗӨВХӨН БИД ХОЁР ♥</span>
          )}
          <button
            className="confirm-button"
            onClick={select}
            disabled={number === 2 && !chosenTime}
          >
            {number === 3 ? 'Болзоогоо товлох' : 'Батлах'}{' '}
            <span aria-hidden="true">▶</span>
          </button>
        </footer>
      )}
    </>
  );
}
