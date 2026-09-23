import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ActivitySection } from '../ActivitySection';

const activities = [
  { id: 'a1', emoji: '🌅', text: 'Sunset Picnic' },
  { id: 'a2', emoji: '🎬', text: 'Movie Night' }
];

describe('ActivitySection in owner edit mode', () => {
  it('edits an activity title directly on its existing card (no separate form) and reports the update', () => {
    const onUpdateActivity = vi.fn();
    render(
      <ActivitySection
        activities={activities}
        initialActivity=""
        onSave={() => {}}
        onCancel={() => {}}
        editing
        onUpdateActivity={onUpdateActivity}
        onAddActivity={() => {}}
        onRemoveActivity={() => {}}
      />
    );

    const titleField = screen.getByText('Sunset Picnic');
    expect(titleField).toHaveAttribute('contenteditable', 'true');

    titleField.textContent = 'Sunset Kayaking';
    fireEvent.blur(titleField);

    expect(onUpdateActivity).toHaveBeenCalledWith('a1', { text: 'Sunset Kayaking' });
  });

  it('clicking a card while editing does not fire the visitor "select" flow', () => {
    const onSave = vi.fn();
    render(
      <ActivitySection
        activities={activities}
        initialActivity=""
        onSave={onSave}
        onCancel={() => {}}
        editing
        onUpdateActivity={() => {}}
      />
    );
    fireEvent.click(screen.getByText('Movie Night').closest('div')!);
    expect(onSave).not.toHaveBeenCalled();
  });

  it('the visitor (non-editing) view renders plain text, not editable fields', () => {
    render(
      <ActivitySection activities={activities} initialActivity="" onSave={() => {}} onCancel={() => {}} />
    );
    const title = screen.getByText('Sunset Picnic');
    expect(title).not.toHaveAttribute('contenteditable');
  });

  it('removing an activity calls onRemoveActivity with its id', () => {
    const onRemoveActivity = vi.fn();
    render(
      <ActivitySection
        activities={activities}
        initialActivity=""
        onSave={() => {}}
        onCancel={() => {}}
        editing
        onRemoveActivity={onRemoveActivity}
      />
    );
    fireEvent.click(document.getElementById('btn-remove-activity-a1')!);
    expect(onRemoveActivity).toHaveBeenCalledWith('a1');
  });
});
