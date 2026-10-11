#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const repoRoot = path.resolve(path.dirname(__filename), '..');
const webRoot = path.join(repoRoot, 'web', 'seller');
const enPath = path.join(webRoot, 'locales', 'en.json');
const arPath = path.join(webRoot, 'locales', 'ar.json');

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function flattenKeys(dictionaryNode, prefix = '') {
  if (!dictionaryNode || typeof dictionaryNode !== 'object' || Array.isArray(dictionaryNode)) return [];
  return Object.entries(dictionaryNode).flatMap(([key, child]) => {
    const next = prefix ? `${prefix}.${key}` : key;
    return child && typeof child === 'object' && !Array.isArray(child) ? flattenKeys(child, next) : [next];
  });
}

function getNested(dictionaryRoot, key) {
  return key.split('.').reduce((current, part) => (current && typeof current === 'object' ? current[part] : undefined), dictionaryRoot);
}

function listSourceFiles(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  return entries.flatMap((entry) => {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) return listSourceFiles(fullPath);
    return /\.(tsx?|jsx?)$/.test(entry.name) ? [fullPath] : [];
  });
}

function lineNumber(source, index) {
  return source.slice(0, index).split('\n').length;
}

function compactText(text) {
  return text.replace(/\s+/g, ' ').trim();
}

/**
 * Code-shaped runs that the greedy JSX-text regex can pick up between closing
 * tags: conditional-render fragments such as `) : activeTab === 'X' ? (`, and
 * TypeScript generic call sites (a leading parenthesis).
 * These are JSX/TS syntax, never visible UI copy, so they are not findings.
 */
function isCodeShape(text) {
  return /^[)\]};?(]/.test(text) || /\?\s*\(/.test(text) || /:\s*\(/.test(text);
}

function hasLetters(text) {
  return /[A-Za-z][A-Za-z\s]/.test(text);
}

function isSafeLiteral(text) {
  const trimmed = compactText(text);
  if (!trimmed || trimmed.length < 3) return true;
  if (!hasLetters(trimmed)) return true;
  if (/^[A-Z0-9_./:-]+$/.test(trimmed)) return true;
  if (/^(GET|POST|PUT|PATCH|DELETE|SHA-256|SAR|SA|EGP|API|ID|SKU|URL|UUID|TRK-|FULL|OPEN|ACTIVE|ERROR|READY|MAPPINGS|WEBHOOKS|CONNECTIONS|SYNC_JOBS|OVERVIEW|LEDGER|SETTLEMENTS|PAYOUTS|API_KEYS)$/.test(trimmed)) return true;
  if (/^(en|ar|ltr|rtl|light|dark|button|submit|search|text|number|checkbox|radio|dialog|status|alert|listbox|option|group|img)$/.test(trimmed)) return true;
  if (/^[a-z0-9-]+$/.test(trimmed)) return true;
  if (/^[@./#?&=:%{}\w-]+$/.test(trimmed) && !trimmed.includes(' ')) return true;
  if (/^merchant-|^store-|^dashboard\./.test(trimmed)) return true;
  return false;
}

function stripNonVisibleSource(source) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|\n)\s*\/\/.*(?=\n|$)/g, '$1')
    .replace(/console\.[a-z]+\([^)]*\)/g, '')
    .replace(/className=(['"])[\s\S]*?\1/g, '')
    .replace(/data-testid=(['"])[\s\S]*?\1/g, '')
    .replace(/data-[a-zA-Z0-9_-]+=(['"])[\s\S]*?\1/g, '')
    .replace(/href=\{?`[^`]*`\}?/g, '')
    .replace(/href=(['"])[^'"]*\1/g, '')
    .replace(/path:\s*`[^`]*`/g, '')
    .replace(/path:\s*['"][^'"]*['"]/g, '')
    .replace(/id:\s*['"][^'"]*['"]/g, '')
    .replace(/key:\s*['"][^'"]*['"]/g, '')
    .replace(/status:\s*['"][^'"]*['"]/g, '')
    .replace(/type:\s*['"][^'"]*['"]/g, '')
    .replace(/value:\s*['"][^'"]*['"]/g, '')
    .replace(/case\s+['"][^'"]*['"]:/g, '')
    .replace(/import[\s\S]*?from\s+['"][^'"]+['"];?/g, '');
}

function untranslatedLiterals(filePath) {
  const source = fs.readFileSync(filePath, 'utf8');
  const scanSource = stripNonVisibleSource(source);
  const findings = [];
  const propPattern = /\b(title|description|primaryLabel|backlogNote|message|placeholder|aria-label|confirmLabel|cancelLabel|eyebrow)=(['"])([^'"{}]*[A-Za-z][^'"{}]*)\2/g;
  for (const match of scanSource.matchAll(propPattern)) {
    const text = compactText(match[3]);
    if (!isSafeLiteral(text)) findings.push({ line: lineNumber(scanSource, match.index), text });
  }
  const jsxTextPattern = />\s*([^<>{}\n]*[A-Za-z][^<>{}\n]*)\s*</g;
  for (const match of scanSource.matchAll(jsxTextPattern)) {
    const text = compactText(match[1]);
    if (isCodeShape(text)) continue;
    if (!isSafeLiteral(text)) findings.push({ line: lineNumber(scanSource, match.index), text });
  }
  const setterPattern = /\bset[A-Z][A-Za-z0-9_]*\(\s*(['"])([^'"{}]*[A-Za-z][^'"{}]*)\1\s*\)/g;
  for (const match of scanSource.matchAll(setterPattern)) {
    const text = compactText(match[2]);
    if (!isSafeLiteral(text)) findings.push({ line: lineNumber(scanSource, match.index), text });
  }
  return findings;
}

const en = readJson(enPath);
const ar = readJson(arPath);
const enKeys = new Set(flattenKeys(en));
const arKeys = new Set(flattenKeys(ar));
const missingInAr = [...enKeys].filter((key) => !arKeys.has(key));
const missingInEn = [...arKeys].filter((key) => !enKeys.has(key));

const requiredDashboardKeys = [
  'common.loading','common.save','common.cancel','statuses.active','statuses.draft','statuses.inactive','statuses.archived',
  'nav.dashboard','nav.catalog','nav.products','nav.supplierOffers','nav.listings','nav.categories','nav.inventory','nav.media','nav.orders','nav.ordersList','nav.storefront','nav.finance','nav.wallet','nav.integrations','nav.settings','nav.storeSettings','nav.account','nav.supply','nav.connections','nav.importBatches','nav.reviewCases','nav.mappings','nav.synchronization','nav.fulfillment',
  'shell.sellerPortal','shell.sellerRole','shell.sellerNavigation','shell.closeNavigation','shell.openNavigation','shell.closeNavigationOverlay','shell.breadcrumb','shell.searchCatalog','shell.submitCatalogSearch','shell.switchToArabicLayout','shell.switchToEnglishLayout','shell.toggleColorMode','shell.helpAndSettings','shell.accountSettings','shell.switchWorkspace','shell.signOut','shell.consoleUnavailableTitle','shell.consoleUnavailableMessage',
  'merchantWorkspaceSwitcher.label','merchantWorkspaceSwitcher.listLabel','storeSwitcher.selectStore','storeSwitcher.stores','storeSwitcher.activeCount','storeSwitcher.loadingStores','dashboardOverview.loadingStores','dashboardOverview.merchantConsoleTitle','dashboardOverview.merchantConsoleSubtitle','dashboardOverview.authorizedStores','dashboardOverview.openWorkspace','dashboardOverview.noStoreTitle','dashboardOverview.noStoreBody','dashboardOverview.startStoreOnboarding','dashboardOverview.sellerStoresTitle','dashboardOverview.sellerStoresSubtitle','dashboardOverview.newStore','dashboardOverview.openDashboard','merchantAccessDenied.title','merchantAccessDenied.message','merchantAccessDenied.backToDashboard',
  'merchantOverview.errorTitle','merchantOverview.errorMessage','merchantOverview.retailCapability','merchantOverview.supplyCapability','merchantOverview.authorizedStores',
  'supply.state.errorTitle','supply.connections.title','supply.reviewCases.title','supply.importBatches.title','supply.fulfillment.title','supply.synchronization.title','supply.mappings.title',
  'inventory.title','inventory.subtitle','inventory.adjustStockTitle','inventory.selectSku','inventory.fulfillmentLocation','inventory.applyAdjustment','inventory.headerLocation','inventory.headerActions','inventory.loading',
  'storeOverview.dashboardTitle','storeOverview.kpiProducts','storeOverview.kpiOrders','storeOverview.noRecentOrders','storeOverview.noLowStock','storeOverview.noChannels','storeOverview.quickActionsKicker','storeOverview.performanceSummaryAria','storeOverview.unavailableTitle','storeOverview.loadFailed'
];
const missingRequired = requiredDashboardKeys.filter((key) => !enKeys.has(key) || !arKeys.has(key));
const blankValues = [...new Set([...enKeys, ...arKeys])].filter((key) => {
  const dictionaryValues = [getNested(en, key), getNested(ar, key)].filter((entryText) => entryText !== undefined);
  return dictionaryValues.some((entryText) => typeof entryText !== 'string' || entryText.trim() === '' || /^(todo|tbd|placeholder)$/i.test(entryText.trim()));
});

const sourceRoots = [
  path.join(webRoot, 'components', 'shell'),
  path.join(webRoot, 'components', 'dashboard'),
  path.join(webRoot, 'components', 'seller'),
  path.join(webRoot, 'components', 'supply'),
  path.join(webRoot, 'config'),
  path.join(webRoot, 'app', '(dashboard)', 'dashboard')
].filter((dir) => fs.existsSync(dir));
const sourceFiles = sourceRoots.flatMap(listSourceFiles);
const usedTranslationKeys = new Set();
for (const filePath of sourceFiles) {
  const source = fs.readFileSync(filePath, 'utf8');
  for (const match of source.matchAll(/\bt\(\s*['"]([a-zA-Z0-9_.-]+)['"]/g)) usedTranslationKeys.add(match[1]);
  for (const match of source.matchAll(/labelKey:\s*['"]([a-zA-Z0-9_.-]+)['"]/g)) usedTranslationKeys.add(match[1]);
}
const missingUsed = [...usedTranslationKeys].filter((key) => !enKeys.has(key) || !arKeys.has(key));
const routeRoot = path.join(webRoot, 'app', '(dashboard)', 'dashboard');

/**
 * Translation-scope allowlist (US4/US5 merchant + Supply slice; T024 store
 * operations storefront then store-root/inventory slices). The untranslated-fixed-copy scan is scoped to
 * the route trees that are localized as of this slice: the merchant workspace
 * overview (its error/denied fallbacks), the whole `merchants/[merchant_id]`
 * Supply module tree (`supply/**`), the already-localized dashboard root page,
 * the store-scoped `stores/[store_id]/integrations` and `stores/[store_id]/media`
 * pages, the store-scoped `orders/**`, `shipments/**`, and `storefront/**`
 * route trees, the store-root overview page, the store-scoped `inventory/**`
 * route tree, and (this slice) the store-scoped `catalog/categories/**` and
 * `catalog/listings/**` (including listing detail) route trees, plus (this
 * slice) the store-scoped `catalog/products/**` route tree (products index,
 * new product, and product detail), plus (this slice) the store-scoped
 * `catalog/supplier-offers` page, plus (this slice) the
 * store-segment `error.tsx` boundary copy.
 * The remaining store route trees (the other store
 * operational pages) are a later localization slice and are
 * NOT gated here; their findings are still scanned and reported out of band so
 * the scope is never silently widened.
 * Global checks above (EN/AR parity, required keys, used keys, blank values)
 * remain unscoped and keep failing on any dictionary regression.
 */
const localizedRouteRoots = [
  path.join(routeRoot, 'page.tsx'),
  path.join(routeRoot, 'merchants'),
  path.join(routeRoot, 'stores', '[store_id]', 'integrations', 'page.tsx'),
  path.join(routeRoot, 'stores', '[store_id]', 'media', 'page.tsx'),
  path.join(routeRoot, 'stores', '[store_id]', 'orders'),
  path.join(routeRoot, 'stores', '[store_id]', 'shipments'),
  path.join(routeRoot, 'stores', '[store_id]', 'storefront'),
  path.join(routeRoot, 'stores', '[store_id]', 'page.tsx'),
  path.join(routeRoot, 'stores', '[store_id]', 'error.tsx'),
  path.join(routeRoot, 'stores', '[store_id]', 'inventory'),
  path.join(routeRoot, 'stores', '[store_id]', 'catalog', 'categories'),
  path.join(routeRoot, 'stores', '[store_id]', 'catalog', 'listings'),
  path.join(routeRoot, 'stores', '[store_id]', 'catalog', 'products'),
  path.join(routeRoot, 'stores', '[store_id]', 'catalog', 'supplier-offers')
].filter((p) => fs.existsSync(p));
const localizedRouteFiles = new Set(
  localizedRouteRoots.flatMap((p) => (fs.statSync(p).isDirectory() ? listSourceFiles(p) : [p]))
);
const allRouteFiles = listSourceFiles(routeRoot);
const outOfScopeRouteFiles = allRouteFiles.filter((filePath) => !localizedRouteFiles.has(filePath));
const untranslatedRouteCopy = [...localizedRouteFiles]
  .flatMap((filePath) => untranslatedLiterals(filePath).map((finding) => ({ filePath, ...finding })))
  .slice(0, 200);
const outOfScopeFindings = outOfScopeRouteFiles
  .flatMap((filePath) => untranslatedLiterals(filePath).map((finding) => ({ filePath, ...finding })))
  .slice(0, 500);

const failures = [];
if (missingInAr.length) failures.push(`Missing in ar.json:\n${missingInAr.map((key) => `  - ${key}`).join('\n')}`);
if (missingInEn.length) failures.push(`Missing in en.json:\n${missingInEn.map((key) => `  - ${key}`).join('\n')}`);
if (missingRequired.length) failures.push(`Missing required dashboard coverage keys:\n${missingRequired.map((key) => `  - ${key}`).join('\n')}`);
if (blankValues.length) failures.push(`Blank or placeholder locale values:\n${blankValues.map((key) => `  - ${key}`).join('\n')}`);
if (missingUsed.length) failures.push(`Translation keys used by Seller dashboard code but missing from a dictionary:\n${missingUsed.map((key) => `  - ${key}`).join('\n')}`);
if (untranslatedRouteCopy.length) {
  failures.push(`Untranslated fixed dashboard route copy:\n${untranslatedRouteCopy.map((finding) => `  - ${path.relative(repoRoot, finding.filePath)}:${finding.line}: ${finding.text}`).join('\n')}`);
}

if (outOfScopeFindings.length) {
  const outOfScopeRoots = [...new Set(outOfScopeFindings.map((finding) => path.relative(routeRoot, path.dirname(finding.filePath))))];
  console.warn(
    `NOTE (not gating): ${outOfScopeFindings.length} untranslated literals remain in out-of-scope route roots ` +
      `(pending their own localization slice): ${outOfScopeRoots.join(', ')}`
  );
}

if (failures.length) {
  console.error(failures.join('\n\n'));
  process.exit(1);
}

console.log(
  `Seller dashboard locale coverage OK: ${enKeys.size} EN keys, ${arKeys.size} AR keys, ${usedTranslationKeys.size} used dashboard keys, no untranslated copy in the gated route roots (dashboard overview, merchant/Supply tree, store integrations/media pages, the store orders/shipments/storefront route trees, the store-root overview page and its error boundary, the store inventory route tree, and the store catalog categories/listings route trees, and the store catalog products and supplier-offers route trees).`
);
