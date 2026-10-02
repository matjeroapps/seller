import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ActionFeedback, type ActionFeedbackState } from '../components/seller/ActionFeedback';

describe('Action Feedback Component & Primary Action Outcomes (T037)', () => {
  it('renders success action feedback', () => {
    const feedback: ActionFeedbackState = {
      type: 'success',
      message: 'Product created successfully.',
    };
    render(<ActionFeedback feedback={feedback} />);
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText('Product created successfully.')).toBeInTheDocument();
  });

  it('renders error action feedback with detail', () => {
    const feedback: ActionFeedbackState = {
      type: 'error',
      message: 'Validation failed.',
      detail: 'Slug must be unique for this store.',
    };
    render(<ActionFeedback feedback={feedback} />);
    expect(screen.getByText('Validation failed.')).toBeInTheDocument();
    expect(screen.getByText('Slug must be unique for this store.')).toBeInTheDocument();
  });

  it('renders manual-review action feedback', () => {
    const feedback: ActionFeedbackState = {
      type: 'manual-review',
      message: 'Payout request submitted for operator review.',
    };
    render(<ActionFeedback feedback={feedback} />);
    expect(screen.getByText('Payout request submitted for operator review.')).toBeInTheDocument();
  });
});
