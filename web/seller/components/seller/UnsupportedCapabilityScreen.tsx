import Link from 'next/link';
import { AlertCircle, ArrowLeft, Compass } from 'lucide-react';

type UnsupportedCapabilityScreenProps = {
  eyebrow: string;
  title: string;
  description: string;
  storeId: string;
  primaryHref: string;
  primaryLabel: string;
  backlogNote?: string;
};

export function UnsupportedCapabilityScreen({
  eyebrow,
  title,
  description,
  storeId,
  primaryHref,
  primaryLabel,
  backlogNote,
}: UnsupportedCapabilityScreenProps) {
  return (
    <div className="seller-dashboard">
      <section className="seller-dashboard-hero">
        <div>
          <div className="seller-dashboard-hero__eyebrow">
            <Compass aria-hidden="true" />
            <span>{eyebrow}</span>
          </div>
          <div className="seller-dashboard-hero__title-row">
            <h1>{title}</h1>
            <span className="seller-status-badge seller-status-badge--draft">Deferred</span>
          </div>
          <div className="seller-dashboard-hero__meta">
            <span>Store scoped route</span>
            <span>{storeId}</span>
            <span>Not available in this release</span>
          </div>
        </div>
      </section>

      <section className="seller-panel">
        <div className="seller-panel__header">
          <div>
            <span className="seller-section-kicker">Capability not available yet</span>
            <h2>{title}</h2>
          </div>
          <AlertCircle aria-hidden="true" />
        </div>

        <div className="seller-inline-empty">
          <p>{description}</p>
          {backlogNote && <p>{backlogNote}</p>}
        </div>

        <div className="seller-form-actions">
          <Link href={primaryHref} className="seller-primary-action">
            {primaryLabel}
          </Link>
          <Link href={`/dashboard/stores/${storeId}`} className="seller-secondary-link">
            <ArrowLeft aria-hidden="true" />
            Return to dashboard
          </Link>
        </div>
      </section>
    </div>
  );
}
