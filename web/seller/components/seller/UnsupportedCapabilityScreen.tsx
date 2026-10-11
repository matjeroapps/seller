'use client';

import Link from 'next/link';
import { AlertCircle, ArrowLeft, Compass } from 'lucide-react';
import { useTranslation } from '@/lib/i18n/locale-context';

type UnsupportedCapabilityScreenProps = {
  copyKey: string;
  storeId: string;
  primaryHref: string;
};

export function UnsupportedCapabilityScreen({ copyKey, storeId, primaryHref }: UnsupportedCapabilityScreenProps) {
  const { t } = useTranslation();
  const title = t(`${copyKey}.title`);
  const backlogNote = t(`${copyKey}.backlogNote`, '');

  return (
    <div className="seller-dashboard">
      <section className="seller-dashboard-hero">
        <div>
          <div className="seller-dashboard-hero__eyebrow">
            <Compass aria-hidden="true" />
            <span>{t(`${copyKey}.eyebrow`)}</span>
          </div>
          <div className="seller-dashboard-hero__title-row">
            <h1>{title}</h1>
            <span className="seller-status-badge seller-status-badge--draft">{t('unsupported.deferred')}</span>
          </div>
          <div className="seller-dashboard-hero__meta">
            <span>{t('unsupported.storeScopedRoute')}</span>
            <span className="mh-ltr-token" dir="ltr">{storeId}</span>
            <span>{t('unsupported.notAvailableInRelease')}</span>
          </div>
        </div>
      </section>

      <section className="seller-panel">
        <div className="seller-panel__header">
          <div>
            <span className="seller-section-kicker">{t('unsupported.capabilityNotAvailable')}</span>
            <h2>{title}</h2>
          </div>
          <AlertCircle aria-hidden="true" />
        </div>

        <div className="seller-inline-empty">
          <p>{t(`${copyKey}.description`)}</p>
          {backlogNote && <p>{backlogNote}</p>}
        </div>

        <div className="seller-form-actions">
          <Link href={primaryHref} className="seller-primary-action">
            {t(`${copyKey}.primaryLabel`)}
          </Link>
          <Link href={`/dashboard/stores/${storeId}`} className="seller-secondary-link">
            <ArrowLeft aria-hidden="true" />
            {t('unsupported.returnToDashboard')}
          </Link>
        </div>
      </section>
    </div>
  );
}
