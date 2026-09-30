import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { StoreOperationalStatePanel } from '../components/store/StoreOperationalStatePanel';

describe('store operational state settings', () => {
  it('shows accepting state and pauses checkout on operator action', () => {
    const onToggle = vi.fn();
    render(
      <StoreOperationalStatePanel
        state={{
          store_id: 'store-1',
          checkout_status: 'accepting',
          maintenance_message: 'Checkout is temporarily unavailable. Please try again later.',
          checkout_accepting: true
        }}
        maintenanceMessage="Checkout is temporarily unavailable. Please try again later."
        isSaving={false}
        onMaintenanceMessageChange={vi.fn()}
        onToggle={onToggle}
      />
    );

    expect(screen.getByText('Accepting orders')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /pause checkout/i }));
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it('shows paused state and allows resume with an updated message', () => {
    const onToggle = vi.fn();
    const onMessageChange = vi.fn();
    render(
      <StoreOperationalStatePanel
        state={{
          store_id: 'store-1',
          checkout_status: 'paused',
          maintenance_message: 'Back soon',
          checkout_accepting: false
        }}
        maintenanceMessage="Back soon"
        isSaving={false}
        onMaintenanceMessageChange={onMessageChange}
        onToggle={onToggle}
      />
    );

    expect(screen.getByText('Checkout paused')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Customer message'), { target: { value: 'Inventory review in progress' } });
    expect(onMessageChange).toHaveBeenCalledWith('Inventory review in progress');
    fireEvent.click(screen.getByRole('button', { name: /resume checkout/i }));
    expect(onToggle).toHaveBeenCalledTimes(1);
  });
});
