import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MergedPlanModal } from '../MergedPlanModal';
import type { DatePlan } from '../../../types';

const plan: DatePlan = {
  activity: 'Sunset Picnic in the Park',
  date: '2099-06-14',
  time: '7:00 PM',
  restaurant: "L'Amore Sky Rooftop & Italian Bistro",
  mapsLink: 'https://maps.google.com/?q=lamore',
  restaurantImageUrl: 'https://images.unsplash.com/photo-1'
};

describe('MergedPlanModal', () => {
  it('shows the confirmed plan the Share Image action redraws', () => {
    render(<MergedPlanModal plan={plan} celebrationWord="Monica" />);
    expect(screen.getByText('Sunset Picnic in the Park')).toBeInTheDocument();
    expect(screen.getByText('7:00 PM')).toBeInTheDocument();
    expect(screen.getByText("L'Amore Sky Rooftop & Italian Bistro")).toBeInTheDocument();
    expect(screen.getByText(/Jun 14, 2099/)).toBeInTheDocument();
  });

  it('renders the restaurant photo at a 1:1 ratio with no border', () => {
    render(<MergedPlanModal plan={plan} celebrationWord="Monica" />);
    const img = screen.getByAltText("L'Amore Sky Rooftop & Italian Bistro");
    expect(img).toHaveClass('aspect-square', 'object-cover');
    expect(img.className).not.toMatch(/\bborder\b/);
  });

  it('offers exactly the 3 share actions and no email/sweet-note/start-over', () => {
    render(<MergedPlanModal plan={plan} celebrationWord="Monica" />);
    expect(screen.getByRole('button', { name: /share image/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /send by message/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /save to calendar/i })).toBeInTheDocument();
    expect(screen.queryByText(/send to email/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/sweet note/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/start over/i)).not.toBeInTheDocument();
  });

  it('disables Save to Calendar until the plan has a valid future date/time', () => {
    render(<MergedPlanModal plan={{ ...plan, date: '2000-01-01' }} celebrationWord="Monica" />);
    expect(screen.getByRole('button', { name: /save to calendar/i })).toBeDisabled();
  });
});
