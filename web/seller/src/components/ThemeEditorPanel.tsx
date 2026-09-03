import React from 'react';
import type { ApiClient } from '../lib/api';
import type { Theme, ThemeInstallationResponse, ThemeVersion } from '../types/themes';
import { SchemaEditor } from './SchemaEditor';
import { ConfirmationModal } from './ConfirmationModal';
import { buildPreviewUrl, openPreviewWindow } from '../lib/preview';

type ThemeEditorPanelProps = {
  api: ApiClient;
  storeId: string;
  locale: string;
  copy: Record<string, string>;
  onNavigateCatalog?: () => void;
};

export function ThemeEditorPanel({
  api,
  storeId,
  locale,
  copy,
  onNavigateCatalog
}: ThemeEditorPanelProps) {
  const [installationData, setInstallationData] = React.useState<ThemeInstallationResponse | null>(null);
  const [themeVersion, setThemeVersion] = React.useState<ThemeVersion | null>(null);
  const [allVersions, setAllVersions] = React.useState<ThemeVersion[]>([]);
  const [draftConfig, setDraftConfig] = React.useState<Record<string, any>>({});
  const [initialDraftConfigJson, setInitialDraftConfigJson] = React.useState<string>('{}');

  const [loading, setLoading] = React.useState(true);
  const [isSaving, setIsSaving] = React.useState(false);
  const [isPublishing, setIsPublishing] = React.useState(false);
  const [isDiscarding, setIsDiscarding] = React.useState(false);
  const [isUpgrading, setIsUpgrading] = React.useState(false);
  const [isPreviewing, setIsPreviewing] = React.useState(false);

  const [error, setError] = React.useState<string | null>(null);
  const [statusMessage, setStatusMessage] = React.useState<string | null>(null);

  // Upgrade selection state
  const [targetUpgradeVersion, setTargetUpgradeVersion] = React.useState<string>('');

  // Confirmation Modals
  const [showPublishModal, setShowPublishModal] = React.useState(false);
  const [showDiscardModal, setShowDiscardModal] = React.useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = React.useState(false);

  const isDirty = JSON.stringify(draftConfig) !== initialDraftConfigJson;

  const loadInstallation = React.useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.get(`/v1/seller/stores/${encodeURIComponent(storeId)}/theme?locale=${locale}`);
      if (res.status === 404) {
        setInstallationData(null);
        return;
      }
      if (!res.ok) throw new Error('Failed to load store theme installation');

      const data = (await res.json()) as ThemeInstallationResponse;
      setInstallationData(data);

      const currentConfig = data.draft_config || data.published_config || {};
      setDraftConfig(currentConfig);
      setInitialDraftConfigJson(JSON.stringify(currentConfig));

      // Resolve theme ID to theme key via themes catalog
      const themesRes = await api.get(`/v1/seller/themes?locale=${locale}`);
      if (!themesRes.ok) throw new Error('Failed to load themes catalog');

      const themesData = (await themesRes.json()) as { items: Theme[] };
      const catalogTheme = (themesData.items || []).find((t) => t.id === data.installation.theme_id);

      if (!catalogTheme) {
        throw new Error(`Installed theme ID (${data.installation.theme_id}) not found in catalog`);
      }

      // Load theme version schema using theme.key
      const versionsRes = await api.get(`/v1/seller/themes/${encodeURIComponent(catalogTheme.key)}/versions?locale=${locale}`);
      if (versionsRes.ok) {
        const vData = (await versionsRes.json()) as { items: ThemeVersion[] };
        const items = vData.items || [];
        setAllVersions(items);
        const activeVer = items.find((v) => v.id === data.installation.theme_version_id);
        if (activeVer) setThemeVersion(activeVer);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error loading store theme');
    } finally {
      setLoading(false);
    }
  }, [api, storeId, locale]);

  React.useEffect(() => {
    void loadInstallation();
  }, [loadInstallation]);

  async function handleSaveDraft(): Promise<boolean> {
    try {
      setIsSaving(true);
      setError(null);
      setStatusMessage(null);

      const res = await api.put(`/v1/seller/stores/${encodeURIComponent(storeId)}/theme/draft?locale=${locale}`, {
        config: draftConfig
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        const msg = errJson.error?.message || 'Failed to save draft';
        throw new Error(msg);
      }

      const updated = (await res.json()) as { config: Record<string, any>; revision: number };
      setDraftConfig(updated.config);
      setInitialDraftConfigJson(JSON.stringify(updated.config));
      if (installationData) {
        setInstallationData({
          ...installationData,
          draft_config: updated.config,
          draft_revision: updated.revision
        });
      }
      setStatusMessage(copy.draftSavedSuccess || 'Draft saved successfully');
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save draft failed');
      return false;
    } finally {
      setIsSaving(false);
    }
  }

  async function handlePublish() {
    try {
      setIsPublishing(true);
      setError(null);
      setStatusMessage(null);

      const res = await api.post(`/v1/seller/stores/${encodeURIComponent(storeId)}/theme/publish?locale=${locale}`);
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error?.message || 'Failed to publish theme');
      }

      const pubRes = (await res.json()) as { published_revision: number };
      setStatusMessage(`${copy.publishSuccess || 'Published revision'} #${pubRes.published_revision}`);
      setShowPublishModal(false);
      await loadInstallation();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Publish failed');
    } finally {
      setIsPublishing(false);
    }
  }

  async function handleDiscard() {
    try {
      setIsDiscarding(true);
      setError(null);
      setStatusMessage(null);

      const res = await api.post(`/v1/seller/stores/${encodeURIComponent(storeId)}/theme/discard?locale=${locale}`);
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error?.message || 'Failed to discard draft');
      }

      const discRes = (await res.json()) as { config: Record<string, any>; revision: number };
      setDraftConfig(discRes.config);
      setInitialDraftConfigJson(JSON.stringify(discRes.config));
      setStatusMessage(copy.discardSuccess || 'Draft discarded');
      setShowDiscardModal(false);
      await loadInstallation();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Discard failed');
    } finally {
      setIsDiscarding(false);
    }
  }

  async function handleUpgrade() {
    if (!targetUpgradeVersion) return;
    try {
      setIsUpgrading(true);
      setError(null);
      setStatusMessage(null);

      const res = await api.post(`/v1/seller/stores/${encodeURIComponent(storeId)}/theme/upgrade?locale=${locale}`, {
        version: targetUpgradeVersion
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error?.message || 'Theme upgrade failed');
      }

      setStatusMessage(`${copy.upgradeSuccess || 'Upgraded theme version to'} v${targetUpgradeVersion}`);
      setShowUpgradeModal(false);
      await loadInstallation();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upgrade failed');
    } finally {
      setIsUpgrading(false);
    }
  }

  async function handlePreview() {
    try {
      setIsPreviewing(true);
      setError(null);

      // Step 1 & 2: If dirty, save draft first
      if (isDirty) {
        const saved = await handleSaveDraft();
        if (!saved) {
          setIsPreviewing(false);
          return;
        }
      }

      // Step 3: Fetch storefront host
      const hostRes = await api.get(`/v1/seller/stores/${encodeURIComponent(storeId)}/storefront-host?locale=${locale}`);
      if (!hostRes.ok) {
        const errJson = await hostRes.json().catch(() => ({}));
        throw new Error(errJson.error?.message || 'Storefront host unavailable');
      }
      const hostData = (await hostRes.json()) as { host: string };

      // Step 4: Fetch preview token
      const previewRes = await api.post(`/v1/seller/stores/${encodeURIComponent(storeId)}/theme/preview?locale=${locale}`);
      if (!previewRes.ok) {
        const errJson = await previewRes.json().catch(() => ({}));
        throw new Error(errJson.error?.message || 'Failed to generate preview token');
      }
      const previewData = (await previewRes.json()) as { token: string };

      // Step 5: Construct preview URL
      const previewUrl = buildPreviewUrl({
        host: hostData.host,
        token: previewData.token,
        locale
      });

      // Step 6: Open preview in new tab safely
      openPreviewWindow(previewUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Preview failed');
    } finally {
      setIsPreviewing(false);
    }
  }

  if (loading) {
    return <div className="notice">{copy.loadingInstallation || 'Loading store theme configuration...'}</div>;
  }

  if (!installationData) {
    return (
      <div className="notice notice-warning">
        <p>{copy.noThemeInstalled || 'No theme is currently installed for this store.'}</p>
        {onNavigateCatalog ? (
          <button type="button" className="btn btn-primary" onClick={onNavigateCatalog}>
            {copy.browseCatalog || 'Browse Themes'}
          </button>
        ) : null}
      </div>
    );
  }

  const possibleUpgrades = allVersions.filter((v) => v.id !== installationData.installation.theme_version_id);

  return (
    <div className="theme-editor-panel">
      {error ? <div className="notice notice-error">{error}</div> : null}
      {statusMessage ? <div className="notice notice-success">{statusMessage}</div> : null}

      <div className="panel-header-toolbar">
        <div>
          <h2>{copy.currentStoreTheme || 'Current Store Theme'}</h2>
          <p className="hint">
            {copy.version || 'Version'}: <strong>v{themeVersion?.version || 'unknown'}</strong> | {copy.draftRev || 'Draft Rev'}: #{installationData.draft_revision} | {copy.publishedRev || 'Published Rev'}: #{installationData.published_revision}
          </p>
        </div>

        <div className="action-button-group">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => void handlePreview()}
            disabled={isPreviewing || isSaving}
          >
            {isPreviewing ? (copy.generatingPreview || 'Preparing Preview...') : (copy.previewDraft || 'Preview Draft')}
          </button>

          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => void handleSaveDraft()}
            disabled={!isDirty || isSaving}
          >
            {isSaving ? (copy.saving || 'Saving...') : (copy.saveDraft || 'Save Draft')}
          </button>

          <button
            type="button"
            className="btn btn-danger-outline"
            onClick={() => setShowDiscardModal(true)}
            disabled={isDiscarding}
          >
            {copy.discardDraft || 'Discard Changes'}
          </button>

          <button
            type="button"
            className="btn btn-primary"
            onClick={() => setShowPublishModal(true)}
            disabled={isPublishing}
          >
            {copy.publishTheme || 'Publish Theme'}
          </button>
        </div>
      </div>

      {possibleUpgrades.length > 0 ? (
        <div className="upgrade-banner">
          <div>
            <strong>{copy.upgradeAvailable || 'Theme Upgrade Available'}</strong>
            <p className="hint">{copy.upgradeHint || 'Newer theme versions are available in the platform catalog.'}</p>
          </div>
          <div className="form-inline">
            <select
              value={targetUpgradeVersion}
              onChange={(e) => setTargetUpgradeVersion(e.target.value)}
              className="form-control"
            >
              <option value="">-- {copy.selectVersion || 'Select version'} --</option>
              {possibleUpgrades.map((uv) => (
                <option key={uv.id} value={uv.version}>
                  v{uv.version} ({uv.status})
                </option>
              ))}
            </select>
            <button
              type="button"
              className="btn btn-secondary"
              disabled={!targetUpgradeVersion || isUpgrading}
              onClick={() => setShowUpgradeModal(true)}
            >
              {copy.upgrade || 'Upgrade Version'}
            </button>
          </div>
        </div>
      ) : null}

      <div className="editor-card">
        <h3>{copy.editorTitle || 'Draft Configuration Schema Editor'}</h3>
        {themeVersion?.configuration_schema ? (
          <SchemaEditor
            schema={themeVersion.configuration_schema}
            value={draftConfig}
            onChange={(next) => setDraftConfig(next)}
            disabled={isSaving || isPublishing}
            copy={copy}
          />
        ) : (
          <div className="hint">{copy.noSchemaAvailable || 'No configuration schema available for this version.'}</div>
        )}
      </div>

      <ConfirmationModal
        isOpen={showPublishModal}
        title={copy.publishModalTitle || 'Publish Draft Theme'}
        message={copy.publishModalMessage || 'Are you sure you want to publish this draft configuration to your live storefront?'}
        confirmLabel={copy.publish || 'Publish Live'}
        cancelLabel={copy.cancel || 'Cancel'}
        onConfirm={() => void handlePublish()}
        onCancel={() => setShowPublishModal(false)}
      />

      <ConfirmationModal
        isOpen={showDiscardModal}
        title={copy.discardModalTitle || 'Discard Draft Changes'}
        message={copy.discardModalMessage || 'Are you sure you want to discard your draft changes? Unsaved modifications will be reverted to the last saved draft/published configuration.'}
        confirmLabel={copy.discard || 'Discard Changes'}
        cancelLabel={copy.cancel || 'Cancel'}
        isDanger
        onConfirm={() => void handleDiscard()}
        onCancel={() => setShowDiscardModal(false)}
      />

      <ConfirmationModal
        isOpen={showUpgradeModal}
        title={copy.upgradeModalTitle || 'Upgrade Theme Version'}
        message={`${copy.upgradeModalMessage || 'Are you sure you want to upgrade your store theme to version'} v${targetUpgradeVersion}?`}
        confirmLabel={copy.upgrade || 'Upgrade'}
        cancelLabel={copy.cancel || 'Cancel'}
        onConfirm={() => void handleUpgrade()}
        onCancel={() => setShowUpgradeModal(false)}
      />
    </div>
  );
}
