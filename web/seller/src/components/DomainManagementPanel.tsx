import React from 'react';
import type { ApiClient } from '../lib/api';
import type { StoreDomain } from '../types/domains';

type DomainManagementPanelProps = {
  api: ApiClient;
  storeId: string;
  locale: string;
  copy: Record<string, string>;
};

export function DomainManagementPanel({
  api,
  storeId,
  locale,
  copy
}: DomainManagementPanelProps) {
  const [domains, setDomains] = React.useState<StoreDomain[]>([]);
  const [storefrontHost, setStorefrontHost] = React.useState<string>('');
  const [isLoading, setIsLoading] = React.useState<boolean>(true);
  const [error, setError] = React.useState<string | null>(null);
  const [notice, setNotice] = React.useState<string | null>(null);

  // Form state
  const [newDomain, setNewDomain] = React.useState<string>('');
  const [isRequesting, setIsRequesting] = React.useState<boolean>(false);
  const [formError, setFormError] = React.useState<string | null>(null);

  // Action state
  const [actionDomainId, setActionDomainId] = React.useState<string | null>(null);
  const [actionType, setActionType] = React.useState<'verifying' | 'activating' | null>(null);

  // Activation modal state
  const [activateTarget, setActivateTarget] = React.useState<StoreDomain | null>(null);

  // Copy state for TXT values
  const [copiedKey, setCopiedKey] = React.useState<string | null>(null);

  // Store generation guard to prevent async response races across store switches
  const generationRef = React.useRef<number>(0);

  const loadDataForStore = React.useCallback(
    async (targetStoreId: string, targetGen: number) => {
      if (!targetStoreId) return;
      setIsLoading(true);
      setError(null);
      try {
        const [domainRes, hostRes] = await Promise.all([
          api.listStoreDomains(targetStoreId),
          api.getStorefrontHost(targetStoreId).catch(() => ({ host: '' }))
        ]);
        if (targetGen !== generationRef.current || targetStoreId !== storeId) {
          return;
        }
        setDomains(domainRes.items || []);
        setStorefrontHost(hostRes.host || '');
      } catch (err: any) {
        if (targetGen !== generationRef.current || targetStoreId !== storeId) {
          return;
        }
        setError(err?.message || 'Failed to load domain data');
      } finally {
        if (targetGen === generationRef.current && targetStoreId === storeId) {
          setIsLoading(false);
        }
      }
    },
    [api, storeId]
  );

  // Store switch isolation: increment generation and reset all state immediately
  React.useEffect(() => {
    generationRef.current += 1;
    const currentGen = generationRef.current;

    setDomains([]);
    setStorefrontHost('');
    setNewDomain('');
    setFormError(null);
    setError(null);
    setNotice(null);
    setActivateTarget(null);
    setActionDomainId(null);
    setActionType(null);
    setCopiedKey(null);

    void loadDataForStore(storeId, currentGen);
  }, [storeId, loadDataForStore]);

  const handleRequestDomain = async (e: React.FormEvent) => {
    e.preventDefault();
    const currentGen = generationRef.current;
    const targetStoreId = storeId;

    setFormError(null);
    setNotice(null);

    let clean = newDomain.trim().toLowerCase();
    clean = clean.replace(/^https?:\/\//, '').replace(/\/.*$/, '');
    if (!clean) {
      setFormError(copy.domainInputHelp || 'Please enter a valid hostname.');
      return;
    }

    setIsRequesting(true);
    try {
      await api.requestCustomDomain(targetStoreId, clean);
      if (currentGen !== generationRef.current || targetStoreId !== storeId) {
        return;
      }
      setNewDomain('');
      setNotice(copy.requestSuccess || 'Custom domain requested successfully.');
      await loadDataForStore(targetStoreId, currentGen);
    } catch (err: any) {
      if (currentGen !== generationRef.current || targetStoreId !== storeId) {
        return;
      }
      setFormError(err?.message || 'Failed to request custom domain.');
    } finally {
      if (currentGen === generationRef.current && targetStoreId === storeId) {
        setIsRequesting(false);
      }
    }
  };

  const handleVerify = async (domainId: string) => {
    const currentGen = generationRef.current;
    const targetStoreId = storeId;

    setActionDomainId(domainId);
    setActionType('verifying');
    setError(null);
    setNotice(null);
    try {
      const updated = await api.verifyCustomDomain(targetStoreId, domainId);
      if (currentGen !== generationRef.current || targetStoreId !== storeId) {
        return;
      }
      if (updated.status === 'verified') {
        setNotice(copy.verifiedNotice || 'Domain ownership verified successfully! You can now activate it.');
      }
      await loadDataForStore(targetStoreId, currentGen);
    } catch (err: any) {
      if (currentGen !== generationRef.current || targetStoreId !== storeId) {
        return;
      }
      if (err?.status === 503 || err?.code === 'service_unavailable') {
        setError(copy.verificationServiceUnavailable || 'Verification service is temporarily unavailable. Try again later.');
      } else {
        setError(err?.message || 'Verification check failed.');
      }
    } finally {
      if (currentGen === generationRef.current && targetStoreId === storeId) {
        setActionDomainId(null);
        setActionType(null);
      }
    }
  };

  const handleConfirmActivate = async () => {
    if (!activateTarget) return;
    const currentGen = generationRef.current;
    const targetStoreId = storeId;
    const domainId = activateTarget.id;

    setActivateTarget(null);
    setActionDomainId(domainId);
    setActionType('activating');
    setError(null);
    setNotice(null);
    try {
      await api.activateCustomDomain(targetStoreId, domainId);
      if (currentGen !== generationRef.current || targetStoreId !== storeId) {
        return;
      }
      setNotice(copy.activateSuccess || 'Custom primary domain activated successfully!');
      await loadDataForStore(targetStoreId, currentGen);
    } catch (err: any) {
      if (currentGen !== generationRef.current || targetStoreId !== storeId) {
        return;
      }
      setError(err?.message || 'Failed to activate custom domain.');
    } finally {
      if (currentGen === generationRef.current && targetStoreId === storeId) {
        setActionDomainId(null);
        setActionType(null);
      }
    }
  };

  const handleCopy = (key: string, text: string) => {
    if (navigator.clipboard) {
      void navigator.clipboard.writeText(text);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 2000);
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'pending':
        return copy.statusPending || 'Pending Verification';
      case 'verified':
        return copy.statusVerified || 'Verified (Not Active)';
      case 'active':
        return copy.statusActive || 'Active';
      case 'failed':
        return copy.statusFailed || 'Verification Failed';
      case 'disabled':
        return copy.statusDisabled || 'Disabled by Admin';
      default:
        return status;
    }
  };

  const platformDomains = domains.filter((d) => d.domain_type === 'platform');
  const customDomains = domains.filter((d) => d.domain_type === 'custom');

  if (isLoading) {
    return <div className="notice">{copy.loadingDomains || 'Loading storefront domains...'}</div>;
  }

  return (
    <div className="domain-management-panel" dir={locale === 'ar' ? 'rtl' : 'ltr'}>
      <div className="panel-header">
        <h2>{copy.storefrontDomainsTitle || 'Storefront Domains'}</h2>
        {storefrontHost ? (
          <div className="storefront-host-badge">
            <span className="label">{copy.currentStorefrontHost || 'Current Live Storefront Host'}:</span>{' '}
            <strong dir="ltr" className="mono">{storefrontHost}</strong>
          </div>
        ) : null}
      </div>

      {error ? (
        <div className="notice notice-error" role="alert">
          {error}
        </div>
      ) : null}

      {notice ? (
        <div className="notice notice-info" role="status" aria-live="polite">
          {notice}
        </div>
      ) : null}

      {/* Platform Domains Section */}
      <section className="domain-section">
        <h3>{copy.platformDomainSection || 'Platform Domain'}</h3>
        <div className="domain-card-list">
          {platformDomains.length === 0 ? (
            <p className="text-muted">{copy.noDomainsFound || 'No domains found.'}</p>
          ) : (
            platformDomains.map((d) => (
              <div key={d.id} className={`domain-card platform-domain-card domain-status-${d.status}`}>
                <div className="domain-info">
                  <span className="domain-name mono" dir="ltr">{d.domain}</span>
                  <span className="badge badge-platform">{copy.domainTypePlatform || 'Platform Domain'}</span>
                  {d.is_primary ? (
                    <span className="badge badge-primary">{copy.primaryDomain || 'Primary Domain'}</span>
                  ) : (
                    <span className="badge badge-secondary">{copy.secondaryDomain || 'Secondary Domain'}</span>
                  )}
                  <span className={`badge badge-status-${d.status}`}>{getStatusLabel(d.status)}</span>
                </div>
                {d.status === 'disabled' && (
                  <div className="notice notice-warning disabled-notice">
                    {copy.disabledNotice || 'This domain was disabled by platform administration and requires administrative resolution.'}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </section>

      {/* Add Custom Domain Form */}
      <section className="domain-section">
        <h3>{copy.addCustomDomain || 'Add Custom Domain'}</h3>
        <form onSubmit={handleRequestDomain} className="add-domain-form">
          <div className="form-group">
            <label htmlFor="custom-domain-input">{copy.domainInputLabel || 'Custom Domain Hostname'}:</label>
            <input
              id="custom-domain-input"
              type="text"
              dir="ltr"
              value={newDomain}
              onChange={(e) => setNewDomain(e.target.value)}
              placeholder={copy.domainInputPlaceholder || 'e.g. shop.example.com'}
              className="form-control mono"
              disabled={isRequesting}
            />
            <small className="form-text text-muted">
              {copy.domainInputHelp || 'Enter the hostname only, without https:// or trailing slashes.'}
            </small>
            {formError ? <div className="form-error">{formError}</div> : null}
          </div>
          <button type="submit" className="btn btn-primary" disabled={isRequesting || !newDomain.trim()}>
            {isRequesting ? (copy.requesting || 'Submitting request...') : (copy.requestDomain || 'Request Custom Domain')}
          </button>
        </form>
      </section>

      {/* Custom Domains Section */}
      <section className="domain-section">
        <h3>{copy.customDomainsSection || 'Custom Domains'}</h3>
        <div className="domain-card-list">
          {customDomains.length === 0 ? (
            <p className="text-muted">{copy.noDomainsFound || 'No custom domains registered for this store.'}</p>
          ) : (
            customDomains.map((d) => (
              <div key={d.id} className={`domain-card custom-domain-card domain-status-${d.status}`}>
                <div className="domain-header">
                  <div className="domain-info">
                    <strong className="domain-name mono" dir="ltr">{d.domain}</strong>
                    <span className="badge badge-custom">{copy.domainTypeCustom || 'Custom Domain'}</span>
                    {d.is_primary ? (
                      <span className="badge badge-primary">{copy.primaryDomain || 'Primary Domain'}</span>
                    ) : (
                      <span className="badge badge-secondary">{copy.secondaryDomain || 'Secondary Domain'}</span>
                    )}
                    <span className={`badge badge-status-${d.status}`}>{getStatusLabel(d.status)}</span>
                  </div>

                  {/* Actions */}
                  <div className="domain-actions">
                    {(d.status === 'pending' || d.status === 'failed') && (
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() => handleVerify(d.id)}
                        disabled={actionDomainId === d.id}
                      >
                        {actionDomainId === d.id && actionType === 'verifying'
                          ? (copy.verifying || 'Checking DNS...')
                          : (copy.checkVerification || 'Check Verification')}
                      </button>
                    )}

                    {d.status === 'verified' && (
                      <button
                        type="button"
                        className="btn btn-success btn-sm"
                        onClick={() => setActivateTarget(d)}
                        disabled={actionDomainId === d.id}
                      >
                        {actionDomainId === d.id && actionType === 'activating'
                          ? (copy.activating || 'Activating...')
                          : (copy.activateDomain || 'Activate Domain')}
                      </button>
                    )}
                  </div>
                </div>

                {/* Status Notice / Instructions */}
                {d.status === 'disabled' && (
                  <div className="notice notice-warning disabled-notice">
                    {copy.disabledNotice || 'This domain was disabled by platform administration and requires administrative resolution.'}
                  </div>
                )}

                {d.status === 'failed' && (
                  <div className="notice notice-warning">
                    {copy.verificationFailedNotice || 'TXT record not found or not matching yet. Please verify your DNS settings and click Check Verification again.'}
                  </div>
                )}

                {/* DNS TXT Instructions */}
                {(d.status === 'pending' || d.status === 'failed') && d.verification && (
                  <div className="dns-instructions-box">
                    <h4>{copy.dnsInstructionsTitle || 'DNS TXT Verification Instructions'}</h4>
                    <p className="instructions-help">
                      {copy.dnsInstructionsHelp || 'To prove domain ownership, add the following TXT record to your DNS provider:'}
                    </p>
                    <div className="record-details">
                      <div className="record-field">
                        <span className="field-label">{copy.recordType || 'Record Type'}:</span>
                        <code dir="ltr" className="record-value mono">{d.verification.record_type}</code>
                      </div>
                      <div className="record-field">
                        <span className="field-label">{copy.recordName || 'Record Name'}:</span>
                        <code dir="ltr" className="record-value mono">{d.verification.record_name}</code>
                        <button
                          type="button"
                          className="btn btn-outline btn-xs"
                          onClick={() => handleCopy(`name-${d.id}`, d.verification!.record_name)}
                        >
                          {copiedKey === `name-${d.id}` ? (copy.copied || 'Copied!') : (copy.copy || 'Copy')}
                        </button>
                      </div>
                      <div className="record-field">
                        <span className="field-label">{copy.recordValue || 'Record Value'}:</span>
                        <code dir="ltr" className="record-value mono">{d.verification.record_value}</code>
                        <button
                          type="button"
                          className="btn btn-outline btn-xs"
                          onClick={() => handleCopy(`val-${d.id}`, d.verification!.record_value)}
                        >
                          {copiedKey === `val-${d.id}` ? (copy.copied || 'Copied!') : (copy.copy || 'Copy')}
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </section>

      {/* Activation Confirmation Modal */}
      {activateTarget ? (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="activate-modal-title">
          <div className="modal-content">
            <h3 id="activate-modal-title">{copy.activateConfirmTitle || 'Activate Custom Primary Domain'}</h3>
            <p>
              {copy.activateConfirmMessage ||
                'Activating this custom domain will set it as your store\'s primary storefront host. Your Matjero platform domain will remain available as an active secondary domain.'}
            </p>
            <p className="mono font-semibold" dir="ltr">{activateTarget.domain}</p>
            <div className="modal-actions">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setActivateTarget(null)}
              >
                {copy.cancel || 'Cancel'}
              </button>
              <button
                type="button"
                className="btn btn-success"
                onClick={() => void handleConfirmActivate()}
              >
                {copy.confirmActivate || 'Activate Primary'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
