import React from 'react';
import type { ApiClient } from '../lib/api';
import type { Theme, ThemeVersion } from '../types/themes';
import { ConfirmationModal } from './ConfirmationModal';

type ThemeCatalogProps = {
  api: ApiClient;
  selectedStoreId: string;
  currentInstalledThemeKey?: string;
  onThemeInstalled: () => void;
  locale: string;
  copy: Record<string, string>;
};

export function ThemeCatalog({
  api,
  selectedStoreId,
  currentInstalledThemeKey,
  onThemeInstalled,
  locale,
  copy
}: ThemeCatalogProps) {
  const [themes, setThemes] = React.useState<Theme[]>([]);
  const [selectedThemeKey, setSelectedThemeKey] = React.useState<string | null>(null);
  const [versions, setVersions] = React.useState<ThemeVersion[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [loadingVersions, setLoadingVersions] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // Install Modal state
  const [installingVersion, setInstallingVersion] = React.useState<ThemeVersion | null>(null);
  const [isInstalling, setIsInstalling] = React.useState(false);

  React.useEffect(() => {
    let active = true;
    async function loadThemes() {
      try {
        setLoading(true);
        setError(null);
        const res = await api.get(`/v1/seller/themes?locale=${locale}`);
        if (!res.ok) throw new Error('Failed to load themes');
        const data = (await res.json()) as { items: Theme[] };
        if (active) {
          setThemes(data.items || []);
          if (data.items.length > 0) {
            setSelectedThemeKey(data.items[0].key);
          }
        }
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : 'Failed to load theme catalog');
      } finally {
        if (active) setLoading(false);
      }
    }
    void loadThemes();
    return () => {
      active = false;
    };
  }, [api, locale]);

  React.useEffect(() => {
    if (!selectedThemeKey) return;
    let active = true;
    async function loadVersions() {
      try {
        setLoadingVersions(true);
        const res = await api.get(`/v1/seller/themes/${encodeURIComponent(selectedThemeKey!)}/versions?locale=${locale}`);
        if (!res.ok) throw new Error('Failed to load versions');
        const data = (await res.json()) as { items: ThemeVersion[] };
        if (active) {
          setVersions(data.items || []);
        }
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : 'Failed to load theme versions');
      } finally {
        if (active) setLoadingVersions(false);
      }
    }
    void loadVersions();
    return () => {
      active = false;
    };
  }, [api, selectedThemeKey, locale]);

  async function executeInstall() {
    if (!installingVersion || !selectedStoreId) return;
    try {
      setIsInstalling(true);
      setError(null);
      const res = await api.post(`/v1/seller/stores/${encodeURIComponent(selectedStoreId)}/theme/install?locale=${locale}`, {
        theme_key: selectedThemeKey,
        version: installingVersion.version
      });
      if (!res.ok) throw new Error('Failed to install theme');
      onThemeInstalled();
      setInstallingVersion(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Installation failed');
    } finally {
      setIsInstalling(false);
    }
  }

  if (loading) {
    return <div className="notice">{copy.loadingThemes || 'Loading theme catalog...'}</div>;
  }

  const selectedTheme = themes.find((t) => t.key === selectedThemeKey);

  return (
    <div className="theme-catalog">
      {error ? <div className="notice notice-error">{error}</div> : null}

      <div className="catalog-grid">
        <div className="catalog-sidebar">
          <h3>{copy.platformThemes || 'Platform Themes'}</h3>
          {themes.length === 0 ? (
            <p className="hint">{copy.noThemesFound || 'No themes available.'}</p>
          ) : (
            <div className="stack">
              {themes.map((theme) => {
                const isCurrent = theme.key === currentInstalledThemeKey;
                const isSelected = theme.key === selectedThemeKey;
                return (
                  <div
                    key={theme.key}
                    className={`catalog-item-card ${isSelected ? 'active' : ''}`}
                    onClick={() => setSelectedThemeKey(theme.key)}
                  >
                    <div className="row-between">
                      <strong>{theme.name}</strong>
                      {isCurrent ? <span className="badge badge-success">{copy.active || 'Active'}</span> : null}
                    </div>
                    <p className="hint">{theme.description}</p>
                    <div className="meta-pills">
                      <span className="pill">{theme.type}</span>
                      <span className="pill">{theme.status}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="catalog-details">
          {selectedTheme ? (
            <div>
              <div className="panel-header">
                <div>
                  <h2>{selectedTheme.name}</h2>
                  <p className="hint">{selectedTheme.description}</p>
                </div>
                <span className="pill">{selectedTheme.key}</span>
              </div>

              <h3>{copy.availableVersions || 'Available Versions'}</h3>
              {loadingVersions ? (
                <div className="notice">{copy.loadingVersions || 'Loading versions...'}</div>
              ) : versions.length === 0 ? (
                <p className="hint">{copy.noVersions || 'No versions found for this theme.'}</p>
              ) : (
                <div className="version-table-container">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>{copy.version || 'Version'}</th>
                        <th>{copy.status || 'Status'}</th>
                        <th>{copy.actions || 'Action'}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {versions.map((ver) => {
                        const isInstalled = selectedTheme.key === currentInstalledThemeKey;
                        return (
                          <tr key={ver.id}>
                            <td>
                              <strong>v{ver.version}</strong>
                            </td>
                            <td>
                              <span className={`badge badge-${ver.status.toLowerCase()}`}>{ver.status}</span>
                            </td>
                            <td>
                              <button
                                type="button"
                                className="btn btn-sm btn-primary"
                                disabled={!selectedStoreId || isInstalling}
                                onClick={() => setInstallingVersion(ver)}
                              >
                                {isInstalled ? (copy.reinstall || 'Switch / Reinstall') : (copy.install || 'Install Theme')}
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ) : (
            <div className="hint">{copy.selectThemePrompt || 'Select a theme to inspect versions.'}</div>
          )}
        </div>
      </div>

      <ConfirmationModal
        isOpen={Boolean(installingVersion)}
        title={copy.installThemeTitle || 'Confirm Theme Installation'}
        message={
          installingVersion
            ? `${copy.installConfirmMessage || 'Are you sure you want to install'} ${selectedTheme?.name} v${installingVersion.version}? ${copy.installConfirmWarning || 'This will update your store theme installation.'}`
            : ''
        }
        confirmLabel={copy.confirmInstall || 'Install'}
        cancelLabel={copy.cancel || 'Cancel'}
        onConfirm={() => void executeInstall()}
        onCancel={() => setInstallingVersion(null)}
      />
    </div>
  );
}
