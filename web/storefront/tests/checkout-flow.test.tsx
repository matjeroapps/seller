import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';

import CheckoutPage from '../src/app/[locale]/(store)/checkout/[sessionID]/page';
import { copyFor } from './support/render';

describe('CheckoutPage Component', () => {
  const copy = copyFor('en');

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders checkout form with shipping fields and COD payment method', () => {
    render(
      <CheckoutPage
        params={{ locale: 'en', sessionID: 'sess-123' }}
      />
    );

    expect(screen.getByRole('heading', { name: copy.checkout.title, level: 1 })).toBeInTheDocument();
    expect(screen.getByLabelText(copy.checkout.recipientName)).toBeInTheDocument();
    expect(screen.getByLabelText(copy.checkout.contactEmail)).toBeInTheDocument();
    expect(screen.getByLabelText(copy.checkout.addressLine1)).toBeInTheDocument();
    expect(screen.getByLabelText(copy.checkout.city)).toBeInTheDocument();
    expect(screen.getByLabelText(copy.checkout.countryCode)).toBeInTheDocument();
    expect(screen.getByText(copy.checkout.cod)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: copy.checkout.submit })).toBeInTheDocument();
  });

  it('submits checkout form successfully and redirects to order page', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ id: 'order-xyz-999' })
    });
    global.fetch = fetchMock;

    delete (window as any).location;
    window.location = { href: '' } as any;

    render(
      <CheckoutPage
        params={{ locale: 'en', sessionID: 'sess-123' }}
      />
    );

    fireEvent.change(screen.getByLabelText(copy.checkout.recipientName), {
      target: { value: 'Ahmad Mansoor' }
    });
    fireEvent.change(screen.getByLabelText(copy.checkout.contactEmail), {
      target: { value: 'ahmad@example.com' }
    });
    fireEvent.change(screen.getByLabelText(copy.checkout.addressLine1), {
      target: { value: 'King Fahd Road' }
    });
    fireEvent.change(screen.getByLabelText(copy.checkout.city), {
      target: { value: 'Riyadh' }
    });
    fireEvent.change(screen.getByLabelText(copy.checkout.countryCode), {
      target: { value: 'SA' }
    });

    const submitBtn = screen.getByRole('button', { name: copy.checkout.submit });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        '/v1/storefront/checkout/sessions/sess-123/finalize',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            shipping_address: {
              recipient_name: 'Ahmad Mansoor',
              address_line_1: 'King Fahd Road',
              city: 'Riyadh',
              country_code: 'SA'
            },
            contact_email: 'ahmad@example.com'
          })
        })
      );
    });

    await waitFor(() => {
      expect(window.location.href).toBe('/en/orders/order-xyz-999');
    });
  });

  it('displays localized error banner when price change or inventory depletion occurs', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({ code: 'price_changed' })
    });
    global.fetch = fetchMock;

    render(
      <CheckoutPage
        params={{ locale: 'en', sessionID: 'sess-123' }}
      />
    );

    fireEvent.change(screen.getByLabelText(copy.checkout.recipientName), {
      target: { value: 'Ahmad Mansoor' }
    });
    fireEvent.change(screen.getByLabelText(copy.checkout.contactEmail), {
      target: { value: 'ahmad@example.com' }
    });
    fireEvent.change(screen.getByLabelText(copy.checkout.addressLine1), {
      target: { value: 'King Fahd Road' }
    });
    fireEvent.change(screen.getByLabelText(copy.checkout.city), {
      target: { value: 'Riyadh' }
    });

    const submitBtn = screen.getByRole('button', { name: copy.checkout.submit });
    fireEvent.click(submitBtn);

    expect(await screen.findByRole('alert')).toHaveTextContent(copy.checkout.priceChangedError);
  });
});
