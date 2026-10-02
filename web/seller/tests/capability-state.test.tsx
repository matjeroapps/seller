import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CapabilityState } from '../components/seller/CapabilityState';
import {
  createBlockedState,
  createEmptyState,
  createErrorState,
  createUnavailableState,
  type CapabilityStateInfo,
} from '../lib/screens/state';

describe('CapabilityState Component & State Transitions (T017)', () => {
  it('renders loading status', () => {
    const state: CapabilityStateInfo = {
      status: 'loading',
      title: 'Loading Catalog',
      description: 'Fetching products...',
    };
    render(<CapabilityState state={state} />);
    expect(screen.getByRole('region')).toHaveAttribute('data-capability-status', 'loading');
    expect(screen.getByText('Loading Catalog')).toBeInTheDocument();
  });

  it('renders live status with children', () => {
    const state: CapabilityStateInfo = {
      status: 'live',
      title: 'Products Live',
      description: 'Loaded 5 products',
    };
    render(
      <CapabilityState state={state}>
        <div data-testid="live-products-grid">Products Grid</div>
      </CapabilityState>
    );
    expect(screen.getByTestId('live-products-grid')).toBeInTheDocument();
  });

  it('renders empty status with CTA', () => {
    const state = createEmptyState('Products', 'No products found.', 'Create Product', '/dashboard/stores/str_1/catalog/products/new');
    render(<CapabilityState state={state} />);
    expect(screen.getByRole('region')).toHaveAttribute('data-capability-status', 'empty');
    expect(screen.getByText('Create Product')).toBeInTheDocument();
  });

  it('renders blocked status', () => {
    const state = createBlockedState('Financial Payouts', 'You do not have owner permissions.');
    render(<CapabilityState state={state} />);
    expect(screen.getByRole('region')).toHaveAttribute('data-capability-status', 'blocked');
    expect(screen.getByText('Access Restricted for Financial Payouts')).toBeInTheDocument();
  });

  it('renders unavailable status truthfully', () => {
    const state = createUnavailableState('Customer Carts', 'Seller active cart tracking is not supported by Core.');
    render(<CapabilityState state={state} />);
    expect(screen.getByRole('region')).toHaveAttribute('data-capability-status', 'unavailable');
    expect(screen.getByText('Customer Carts Unavailable')).toBeInTheDocument();
  });

  it('renders error status with retry button', () => {
    const onRetry = vi.fn();
    const state = createErrorState('Network connection timeout', onRetry);
    render(<CapabilityState state={state} />);
    expect(screen.getByRole('region')).toHaveAttribute('data-capability-status', 'error');
    const retryBtn = screen.getByRole('button', { name: /retry/i });
    expect(retryBtn).toBeInTheDocument();
  });
});
