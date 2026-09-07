import type { SellerUser } from './session-cookie';

export interface ZitadelConfig {
  domain: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  postLogoutRedirectUri: string;
  scopes: string[];
}

export interface ZitadelEndpoints {
  authorization: string;
  token: string;
  userinfo: string;
  endSession: string;
}

export function getZitadelConfig(): ZitadelConfig {
  const domain = process.env.ZITADEL_DOMAIN || process.env.NEXT_PUBLIC_ZITADEL_DOMAIN || 'matjerhub.zitadel.cloud';
  const clientId = process.env.ZITADEL_CLIENT_ID || process.env.NEXT_PUBLIC_ZITADEL_CLIENT_ID || '';
  const clientSecret = process.env.ZITADEL_CLIENT_SECRET || '';
  const baseUrl = process.env.NEXT_PUBLIC_SELLER_APP_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3001';

  return {
    domain,
    clientId,
    clientSecret,
    redirectUri: `${baseUrl}/auth/callback`,
    postLogoutRedirectUri: `${baseUrl}/login`,
    scopes: ['openid', 'profile', 'email', 'urn:zitadel:iam:org:project:id:zitadel:aud']
  };
}

export function getZitadelEndpoints(config: ZitadelConfig): ZitadelEndpoints {
  const base = `https://${config.domain}`;
  return {
    authorization: `${base}/oauth/v2/authorize`,
    token: `${base}/oauth/v2/token`,
    userinfo: `${base}/oidc/v1/userinfo`,
    endSession: `${base}/oauth/v2/logout`
  };
}

export function getAuthorizationUrl(config: ZitadelConfig, endpoints: ZitadelEndpoints, state: string, codeChallenge: string) {
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    scope: config.scopes.join(' '),
    state,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256'
  });

  return `${endpoints.authorization}?${params.toString()}`;
}

export function getLogoutUrl(config: ZitadelConfig, endpoints: ZitadelEndpoints) {
  const params = new URLSearchParams({
    post_logout_redirect_uri: config.postLogoutRedirectUri
  });

  return `${endpoints.endSession}?${params.toString()}`;
}

export async function exchangeCodeForTokens(config: ZitadelConfig, endpoints: ZitadelEndpoints, code: string, codeVerifier: string) {
  const params = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: config.redirectUri,
    client_id: config.clientId,
    code_verifier: codeVerifier
  });

  if (config.clientSecret) {
    params.set('client_secret', config.clientSecret);
  }

  const response = await fetch(endpoints.token, {
    method: 'POST',
    headers: {
      accept: 'application/json',
      'content-type': 'application/x-www-form-urlencoded'
    },
    body: params.toString()
  });

  if (!response.ok) {
    throw new Error(`Zitadel token exchange failed with ${response.status}`);
  }

  return response.json() as Promise<{ access_token: string; expires_in?: number }>;
}

export async function fetchUserInfo(endpoints: ZitadelEndpoints, accessToken: string): Promise<SellerUser> {
  const response = await fetch(endpoints.userinfo, {
    headers: {
      accept: 'application/json',
      authorization: `Bearer ${accessToken}`
    }
  });

  if (!response.ok) {
    throw new Error(`Zitadel userinfo failed with ${response.status}`);
  }

  const userInfo = await response.json();

  return {
    id: String(userInfo.sub || ''),
    email: String(userInfo.email || ''),
    name: String(userInfo.name || userInfo.preferred_username || userInfo.email || 'Seller'),
    avatarUrl: typeof userInfo.picture === 'string' ? userInfo.picture : undefined,
    roles: Object.keys((userInfo['urn:zitadel:iam:org:project:roles'] as Record<string, unknown> | undefined) || {}),
    tenantId: typeof userInfo['urn:zitadel:iam:org:id'] === 'string' ? userInfo['urn:zitadel:iam:org:id'] : undefined
  };
}
