'use client';

import { useState, use } from 'react';
import { dictionaryFor, isLocale, type Locale } from '../../../../../i18n/locales';

export default function CheckoutPage({
  params
}: {
  params: Promise<{ locale: string; sessionID: string }>;
}) {
  const resolvedParams = use(params);
  const locale: Locale = isLocale(resolvedParams.locale) ? resolvedParams.locale : 'en';
  const sessionID = resolvedParams.sessionID;
  const copy = dictionaryFor(locale);

  const [formData, setFormData] = useState({
    recipientName: '',
    addressLine1: '',
    addressLine2: '',
    city: '',
    region: '',
    postalCode: '',
    countryCode: 'US',
    contactEmail: ''
  });

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const payload = {
      shipping_address: {
        recipient_name: formData.recipientName,
        address_line_1: formData.addressLine1,
        address_line_2: formData.addressLine2 || undefined,
        city: formData.city,
        region: formData.region || undefined,
        postal_code: formData.postalCode || undefined,
        country_code: formData.countryCode
      },
      contact_email: formData.contactEmail
    };

    try {
      const res = await fetch(`/v1/storefront/checkout/sessions/${sessionID}/finalize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        const code = data.code || data.error?.code;
        if (code === 'price_changed') {
          throw new Error('Prices changed since checkout began. Please review your cart.');
        } else if (code === 'insufficient_inventory' || code === 'listing_unavailable') {
          throw new Error('An item in your cart is no longer available in the requested quantity.');
        } else {
          throw new Error(data.message || data.error?.message || 'Finalization failed');
        }
      }

      const order = await res.json();
      window.location.href = `/${locale}/orders/${order.id}`;
    } catch (err: any) {
      setError(err.message || 'Error completing checkout');
      setSubmitting(false);
    }
  }

  return (
    <main className="main-content">
      <div className="container container--sm">
        <h1>{copy.checkout.title}</h1>

        {error ? <div className="error-banner">{error}</div> : null}

        <form onSubmit={handleSubmit} className="checkout-form">
          <fieldset className="checkout-form__group">
            <legend className="product__heading">{copy.checkout.title}</legend>

            <div className="form-field">
              <label htmlFor="recipientName">{copy.checkout.recipientName}</label>
              <input
                id="recipientName"
                name="recipientName"
                type="text"
                required
                value={formData.recipientName}
                onChange={handleChange}
                className="input-text"
              />
            </div>

            <div className="form-field">
              <label htmlFor="contactEmail">{copy.checkout.contactEmail}</label>
              <input
                id="contactEmail"
                name="contactEmail"
                type="email"
                required
                value={formData.contactEmail}
                onChange={handleChange}
                className="input-text"
              />
            </div>

            <div className="form-field">
              <label htmlFor="addressLine1">{copy.checkout.addressLine1}</label>
              <input
                id="addressLine1"
                name="addressLine1"
                type="text"
                required
                value={formData.addressLine1}
                onChange={handleChange}
                className="input-text"
              />
            </div>

            <div className="form-field">
              <label htmlFor="addressLine2">{copy.checkout.addressLine2}</label>
              <input
                id="addressLine2"
                name="addressLine2"
                type="text"
                value={formData.addressLine2}
                onChange={handleChange}
                className="input-text"
              />
            </div>

            <div className="form-grid">
              <div className="form-field">
                <label htmlFor="city">{copy.checkout.city}</label>
                <input
                  id="city"
                  name="city"
                  type="text"
                  required
                  value={formData.city}
                  onChange={handleChange}
                  className="input-text"
                />
              </div>

              <div className="form-field">
                <label htmlFor="region">{copy.checkout.region}</label>
                <input
                  id="region"
                  name="region"
                  type="text"
                  value={formData.region}
                  onChange={handleChange}
                  className="input-text"
                />
              </div>
            </div>

            <div className="form-grid">
              <div className="form-field">
                <label htmlFor="postalCode">{copy.checkout.postalCode}</label>
                <input
                  id="postalCode"
                  name="postalCode"
                  type="text"
                  value={formData.postalCode}
                  onChange={handleChange}
                  className="input-text"
                />
              </div>

              <div className="form-field">
                <label htmlFor="countryCode">{copy.checkout.countryCode}</label>
                <input
                  id="countryCode"
                  name="countryCode"
                  type="text"
                  required
                  maxLength={2}
                  value={formData.countryCode}
                  onChange={handleChange}
                  className="input-text"
                />
              </div>
            </div>
          </fieldset>

          <div className="checkout-form__actions">
            <button
              type="submit"
              disabled={submitting}
              className="button button--primary button--block"
            >
              {submitting ? copy.checkout.submitting : copy.checkout.submit}
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}
