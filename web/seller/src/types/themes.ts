export type Theme = {
  id: string;
  key: string;
  name: string;
  description: string;
  type: string;
  status: string;
  created_at: string;
  updated_at: string;
};

export type ThemeVersion = {
  id: string;
  theme_id: string;
  version: string;
  status: string;
  configuration_schema: Record<string, any>;
  default_configuration: Record<string, any>;
  component_registry_version: string;
  created_at: string;
  published_at?: string;
  deprecated_at?: string;
};

export type ThemeInstallation = {
  id: string;
  store_id: string;
  theme_id: string;
  theme_version_id: string;
  status: string;
  installed_at: string;
  created_at: string;
  updated_at: string;
};

export type ThemeInstallationResponse = {
  installation: ThemeInstallation;
  draft_config?: Record<string, any>;
  published_config?: Record<string, any>;
  draft_revision: number;
  published_revision: number;
};

export type ThemeDraftResponse = {
  config: Record<string, any>;
  revision: number;
};

export type ThemePublishResponse = {
  published_revision: number;
};

export type ThemePreviewResponse = {
  token: string;
};

export type StorefrontHostResponse = {
  host: string;
};

export type ThemeInstallRequest = {
  theme_key: string;
  version?: string;
};

export type ThemeConfigRequest = {
  config: Record<string, any>;
};

export type ThemeUpgradeRequest = {
  version: string;
};
