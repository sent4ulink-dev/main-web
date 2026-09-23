'use client';
/* oxlint-disable jsx-a11y/prefer-tag-over-role -- contenteditable preserves the existing LCD typography */

import { useEffect, useRef, type KeyboardEvent } from 'react';

export function InlineEdit({
  value,
  editing,
  onChange,
  className = '',
}: {
  value: string;
  editing: boolean;
  onChange: (value: string) => void;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (ref.current && ref.current.innerText !== value)
      ref.current.innerText = value;
  }, [value]);
  const commit = () => {
    const next = ref.current?.innerText.replace(/\r/g, '').trim() ?? '';
    if (next && next !== value) onChange(next);
    else if (!next && ref.current) ref.current.innerText = value;
  };
  const keyDown = (event: KeyboardEvent<HTMLSpanElement>) => {
    event.stopPropagation();
    if (event.key === 'Escape') {
      if (ref.current) ref.current.innerText = value;
      ref.current?.blur();
    }
  };
  return (
    <span
      ref={ref}
      className={`inline-edit ${editing ? 'is-editing' : ''} ${className}`}
      contentEditable={editing}
      suppressContentEditableWarning
      role="textbox"
      tabIndex={editing ? 0 : -1}
      aria-readonly={!editing}
      aria-multiline={editing || undefined}
      spellCheck={editing}
      onClick={(event) => editing && event.stopPropagation()}
      onPointerDown={(event) => editing && event.stopPropagation()}
      onKeyDown={keyDown}
      onBlur={commit}
    >
      {value}
    </span>
  );
}
