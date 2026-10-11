/** Build the customer-facing URL for a Core-resolved storefront host. */
export function storefrontUrlForHost(host?: string): string | undefined {
  if (!host) return undefined;

  const hostname = host
    .trim()
    .replace(/^https?:\/\//i, '')
    .split('/')[0]
    .replace(/:\d+$/, '');
  if (!hostname || !/^[a-z0-9.-]+$/i.test(hostname)) return undefined;

  if (process.env.NEXT_PUBLIC_STOREFRONT_LOCAL_MODE === 'true') {
    return `http://${hostname}:3000`;
  }

  return `https://${hostname}`;
}
