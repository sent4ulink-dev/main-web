import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { EditableText } from '../EditableText';

describe('EditableText (inline edit mode primitive)', () => {
  it('renders as the exact tag/className the live design uses, not a separate input', () => {
    render(
      <EditableText
        tag="p"
        className="font-serif-italic text-2xl text-white"
        value="Will you go on a date with me?"
        onCommit={() => {}}
        ariaLabel="Opening question"
      />
    );
    const el = screen.getByRole('textbox', { name: 'Opening question' });
    expect(el.tagName).toBe('P');
    expect(el).toHaveClass('font-serif-italic', 'text-2xl', 'text-white');
    // Only a subtle outline is allowed to change — never the design's own classes.
    expect(el).toHaveClass('inline-editable');
    expect(el.getAttribute('contenteditable')).toBe('true');
    expect(el.textContent).toBe('Will you go on a date with me?');
  });

  it('commits the edited text, in place, when the field loses focus', () => {
    const onCommit = vi.fn();
    render(<EditableText tag="span" value="Yes" onCommit={onCommit} ariaLabel="Yes button label" />);
    const el = screen.getByRole('textbox', { name: 'Yes button label' });

    el.textContent = 'Absolutely!';
    fireEvent.blur(el);

    expect(onCommit).toHaveBeenCalledWith('Absolutely!');
  });

  it('does not commit when the text is unchanged', () => {
    const onCommit = vi.fn();
    render(<EditableText tag="span" value="No" onCommit={onCommit} ariaLabel="No button label" />);
    fireEvent.blur(screen.getByRole('textbox', { name: 'No button label' }));
    expect(onCommit).not.toHaveBeenCalled();
  });

  it('Enter blurs (commits) a single-line field instead of inserting a newline', () => {
    const onCommit = vi.fn();
    render(<EditableText tag="span" value="No" onCommit={onCommit} ariaLabel="label" />);
    const el = screen.getByRole('textbox', { name: 'label' }) as HTMLElement;
    el.focus(); // real typing focuses the field first — blur() is a no-op on an unfocused element
    el.textContent = 'Nope';
    fireEvent.keyDown(el, { key: 'Enter' });
    expect(onCommit).toHaveBeenCalledWith('Nope');
  });

  it('Escape reverts to the last committed value instead of saving the in-progress edit', () => {
    const onCommit = vi.fn();
    render(<EditableText tag="span" value="No" onCommit={onCommit} ariaLabel="label" />);
    const el = screen.getByRole('textbox', { name: 'label' }) as HTMLElement;
    el.focus();
    el.textContent = 'something else entirely';
    fireEvent.keyDown(el, { key: 'Escape' });
    expect(el.textContent).toBe('No');
    expect(onCommit).not.toHaveBeenCalled();
  });

  it('a click inside the field never bubbles to a parent (so it never also triggers a Yes/No select)', () => {
    const parentClick = vi.fn();
    render(
      <div onClick={parentClick}>
        <EditableText tag="span" value="Yes" onCommit={() => {}} ariaLabel="Yes button label" />
      </div>
    );
    fireEvent.click(screen.getByRole('textbox', { name: 'Yes button label' }));
    expect(parentClick).not.toHaveBeenCalled();
  });
});
