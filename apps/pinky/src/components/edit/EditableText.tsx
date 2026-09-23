/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef } from 'react';

interface EditableTextProps {
  value: string;
  onCommit: (next: string) => void;
  /** Which element the live (non-editing) design already renders this text as — kept
   * identical here so editing mode never changes position/size/alignment/font/color. */
  tag?: keyof React.JSX.IntrinsicElements;
  className?: string;
  style?: React.CSSProperties;
  /** Enter inserts a newline instead of committing/blurring. */
  multiline?: boolean;
  ariaLabel: string;
  placeholder?: string;
}

/**
 * A single piece of text that renders EXACTLY like its normal (non-editing) span/p/h3 —
 * same tag, className and style are passed straight through by the caller — but becomes
 * directly editable in place via contentEditable. No separate input/textarea swapped in,
 * so font, size, color, alignment and layout never shift when editing mode turns on.
 *
 * Content is written to the DOM imperatively (via the ref effect below), never as JSX
 * children. That's deliberate: if `{value}` were passed as children, every unrelated
 * re-render of a parent component (animations elsewhere on the page tick constantly)
 * would make React try to reconcile the child back to the last-known `value`, stomping
 * on whatever the person is mid-typing. Writing to textContent only when `value` actually
 * changes (i.e. after a real external update, not on every render) avoids that entirely —
 * commits happen on blur, so the prop and the DOM are already in sync when this runs.
 */
export function EditableText({
  value,
  onCommit,
  tag = 'span',
  className = '',
  style,
  multiline = false,
  ariaLabel,
  placeholder
}: EditableTextProps) {
  const ref = useRef<HTMLElement>(null);
  const Tag = tag as React.ElementType;

  useEffect(() => {
    const el = ref.current;
    if (el && el.textContent !== value) {
      el.textContent = value;
    }
  }, [value]);

  const commit = () => {
    const next = ref.current?.textContent ?? '';
    if (next !== value) onCommit(next);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLElement>) => {
    if (e.key === 'Escape') {
      if (ref.current) ref.current.textContent = value;
      e.currentTarget.blur();
      return;
    }
    if (!multiline && e.key === 'Enter') {
      e.preventDefault();
      e.currentTarget.blur();
    }
  };

  return (
    <Tag
      ref={ref}
      contentEditable
      suppressContentEditableWarning
      role="textbox"
      aria-label={ariaLabel}
      aria-multiline={multiline}
      data-placeholder={placeholder}
      onBlur={commit}
      onKeyDown={handleKeyDown}
      // Stop a click from bubbling into a parent's onClick (e.g. the Yes/No button
      // containers, or a picker card's "select" handler) — placing a text cursor
      // should never also trigger the thing the click would normally do.
      onClick={(e: React.MouseEvent) => e.stopPropagation()}
      className={`${className} inline-editable`.trim()}
      style={style}
    />
  );
}
