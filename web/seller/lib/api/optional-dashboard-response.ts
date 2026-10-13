/**
 * A missing finance account or theme installation is a valid empty state for
 * the store dashboard. Normalize only those optional reads at the Seller BFF
 * so the browser receives JSON null instead of logging an expected 404.
 */
export function isOptionalStoreReadNotFound(
  method: string,
  path: readonly string[],
  status: number
): boolean {
  if (method !== 'GET' || status !== 404 || path[0] !== 'v1' || path[1] !== 'seller' || path[2] !== 'stores' || !path[3]) {
    return false;
  }

  return (path.length === 5 && path[4] === 'theme') ||
    (path.length === 6 && path[4] === 'finance' && path[5] === 'balance');
}
