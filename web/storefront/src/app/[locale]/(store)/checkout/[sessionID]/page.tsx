'use client';

import { useState, use } from 'react';
import { dictionaryFor, isLocale, type Locale } from '../../../../../i18n/locales';

export default function CheckoutPage({
  params
}: {
  params: Promise<{ locale: string; sessionID: string }> | { locale: string; sessionID: string };
}) {
  const resolvedParams = 'then' in params ? use(params) : params;
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
    countryCode: 'SA',
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
        recipient_name: formData.recipientName.trim(),
        address_line_1: formData.addressLine1.trim(),
        address_line_2: formData.addressLine2.trim() || undefined,
        city: formData.city.trim(),
        region: formData.region.trim() || undefined,
        postal_code: formData.postalCode.trim() || undefined,
        country_code: formData.countryCode.trim().toUpperCase()
      },
      contact_email: formData.contactEmail.trim()
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
          throw new Error(copy.checkout.priceChangedError);
        } else if (code === 'insufficient_inventory' || code === 'listing_unavailable') {
          throw new Error(copy.checkout.inventoryError);
        } else if (code === 'session_expired') {
          throw new Error(copy.checkout.expiredError);
        } else {
          throw new Error(data.message || data.error?.message || copy.error.body);
        }
      }

      const order = await res.json();
      window.location.href = `/${locale}/orders/${order.id}`;
    } catch (err: any) {
      setError(err.message || copy.error.body);
      setSubmitting(false);
    }
  }

  return (
    <main className="main-content">
      <div className="container container--sm">
        <h1>{copy.checkout.title}</h1>

        {error ? (
          <div role="alert" className="error-banner" style={{ marginBottom: '1.5rem' }}>
            {error}
          </div>
        ) : null}

        <form onSubmit={handleSubmit} className="checkout-form">
          <fieldset className="checkout-form__group" style={{ marginBottom: '1.5rem' }}>
            <legend className="product__heading">{copy.checkout.shippingInfo}</legend>

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

          <fieldset className="checkout-form__group" style={{ marginBottom: '2rem' }}>
            <legend className="product__heading">{copy.checkout.paymentMethod}</legend>
            <div
              style={{
                border: '1px solid var(--color-border, #e2e8f0)',
                borderRadius: '8px',
                padding: '1rem',
                backgroundColor: 'var(--color-surface, #f8fafc)',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '0.75rem'
              }}
            >
              <input
                type="radio"
                id="paymentMethodCOD"
                name="paymentMethod"
                value="cod"
                checked
                readOnly
                style={{ marginTop: '0.25rem' }}
              />
              <div>
                <label htmlFor="paymentMethodCOD" style={{ fontWeight: 600, display: 'block' }}>
                  {copy.checkout.cod}
                </label>
                <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.875rem', color: 'var(--color-text-muted, #64748b)' }}>
                  {copy.checkout.codDescription}
                </p>
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

