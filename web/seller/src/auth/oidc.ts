import { UserManager, WebStorageStateStore, type User } from 'oidc-client-ts';

export type AuthUser = {
  subject: string;
  preferred_username?: string;
  email?: string;
  roles?: string[];
};

export type AuthState = {
  isAuthenticated: boolean;
  user: AuthUser | null;
  isLoading: boolean;
  error: string | null;
};

export interface AuthClient {
  getAccessToken(): Promise<string | null>;
  login(returnPath?: string): Promise<void>;
  handleCallback(): Promise<string>;
  logout(): Promise<void>;
  getUser(): AuthUser | null;
  subscribe(listener: (state: AuthState) => void): () => void;
  getState(): AuthState;
}

function sanitizeReturnPath(path?: string): string {
  if (!path || typeof path !== 'string') return '/';
  if (path.startsWith('/') && !path.startsWith('//') && !path.startsWith('/\\')) {
    return path;
  }
  return '/';
}

export function createOidcAuthClient(): AuthClient {
  const issuer = import.meta.env.VITE_ZITADEL_ISSUER;
  const clientId = import.meta.env.VITE_ZITADEL_CLIENT_ID;
  const redirectUri = import.meta.env.VITE_ZITADEL_REDIRECT_URI || `${window.location.origin}/auth/callback`;
  const postLogoutRedirectUri = import.meta.env.VITE_ZITADEL_POST_LOGOUT_REDIRECT_URI || window.location.origin;

  const listeners = new Set<(state: AuthState) => void>();

  let currentState: AuthState = {
    isAuthenticated: false,
    user: null,
    isLoading: true,
    error: null
  };

  function updateState(next: Partial<AuthState>) {
    currentState = { ...currentState, ...next };
    for (const listener of listeners) {
      listener(currentState);
    }
  }

  let userManager: UserManager | null = null;

  if (issuer && clientId) {
    userManager = new UserManager({
      authority: issuer,
      client_id: clientId,
      redirect_uri: redirectUri,
      post_logout_redirect_uri: postLogoutRedirectUri,
      response_type: 'code',
      scope: 'openid profile email',
      userStore: new WebStorageStateStore({ store: window.sessionStorage }),
      automaticSilentRenew: true
    });

    userManager.getUser().then((user) => {
      if (user && !user.expired) {
        updateState({
          isAuthenticated: true,
          user: mapUser(user),
          isLoading: false
        });
      } else {
        updateState({ isAuthenticated: false, user: null, isLoading: false });
      }
    }).catch((err) => {
      updateState({
        isAuthenticated: false,
        user: null,
        isLoading: false,
        error: err instanceof Error ? err.message : 'Auth initialization failed'
      });
    });

    userManager.events.addUserLoaded((user) => {
      updateState({ isAuthenticated: true, user: mapUser(user), isLoading: false, error: null });
    });

    userManager.events.addUserUnloaded(() => {
      updateState({ isAuthenticated: false, user: null, isLoading: false });
    });

    userManager.events.addAccessTokenExpired(() => {
      updateState({ isAuthenticated: false, user: null, isLoading: false, error: 'Session expired' });
    });
  } else {
    // Development / unconfigured fallthrough: check sessionStorage for dev user state
    const stored = sessionStorage.getItem('matjero_dev_user');
    if (stored) {
      try {
        const u = JSON.parse(stored) as AuthUser;
        currentState = { isAuthenticated: true, user: u, isLoading: false, error: null };
      } catch {
        currentState = { isAuthenticated: false, user: null, isLoading: false, error: null };
      }
    } else {
      currentState = { isAuthenticated: false, user: null, isLoading: false, error: null };
    }
  }

  function mapUser(user: User): AuthUser {
    const profile = user.profile;
    return {
      subject: profile.sub,
      preferred_username: (profile.preferred_username as string) || (profile.name as string) || profile.sub,
      email: profile.email as string,
      roles: (profile.roles as string[]) || []
    };
  }

  return {
    async getAccessToken(): Promise<string | null> {
      if (userManager) {
        const user = await userManager.getUser();
        if (user && !user.expired) {
          return user.access_token;
        }
        if (user && user.expired) {
          try {
            const renewed = await userManager.signinSilent();
            return renewed?.access_token ?? null;
          } catch {
            updateState({ isAuthenticated: false, user: null, error: 'Session expired' });
            return null;
          }
        }
        return null;
      }
      const devToken = sessionStorage.getItem('matjero_dev_token');
      return devToken ?? (currentState.isAuthenticated ? 'dev-access-token' : null);
    },

    async login(returnPath?: string): Promise<void> {
      const safePath = sanitizeReturnPath(returnPath);
      if (userManager) {
        await userManager.signinRedirect({ state: { returnPath: safePath } });
      } else {
        // Dev login mode
        const devUser: AuthUser = {
          subject: 'usr_seller_dev',
          preferred_username: 'seller_dev',
          email: 'seller@example.com'
        };
        sessionStorage.setItem('matjero_dev_user', JSON.stringify(devUser));
        sessionStorage.setItem('matjero_dev_token', 'dev-access-token');
        updateState({ isAuthenticated: true, user: devUser, isLoading: false, error: null });
        window.location.hash = safePath;
      }
    },

    async handleCallback(): Promise<string> {
      if (userManager) {
        const user = await userManager.signinRedirectCallback();
        updateState({ isAuthenticated: true, user: mapUser(user), isLoading: false, error: null });
        const stateObj = user.state as { returnPath?: string } | undefined;
        return sanitizeReturnPath(stateObj?.returnPath);
      }
      return '/';
    },

    async logout(): Promise<void> {
      if (userManager) {
        await userManager.signoutRedirect();
      } else {
        sessionStorage.removeItem('matjero_dev_user');
        sessionStorage.removeItem('matjero_dev_token');
        updateState({ isAuthenticated: false, user: null, isLoading: false, error: null });
      }
    },

    getUser(): AuthUser | null {
      return currentState.user;
    },

    getState(): AuthState {
      return currentState;
    },

    subscribe(listener: (state: AuthState) => void): () => void {
      listeners.add(listener);
      return () => listeners.delete(listener);
    }
  };
}
