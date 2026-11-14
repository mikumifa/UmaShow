const resolvedAssetUrlCache = new Map<string, string>();
const MAX_ASSET_CACHE_SIZE = 4096;

export default function assetUrl(assetPath: string) {
  const normalizedPath = assetPath.trim();
  if (!normalizedPath) return '';
  const isAutoUma = document.documentElement.dataset.autouma === 'true';
  const cacheKey = `${isAutoUma ? '1' : '0'}:${normalizedPath}`;
  const cached = resolvedAssetUrlCache.get(cacheKey);
  if (cached !== undefined) return cached;

  let resolved: string;
  if (/^(?:asset|https?|data|blob|file):/i.test(normalizedPath)) {
    resolved = normalizedPath;
  } else if (isAutoUma) {
    resolved = new URL(
      normalizedPath.replace(/\\/g, '/').replace(/^\/+/, ''),
      document.baseURI,
    ).toString();
  } else {
    resolved = `asset:///${normalizedPath
      .replace(/\\/g, '/')
      .replace(/^\/+/, '')
      .split('/')
      .map(encodeURIComponent)
      .join('/')}`;
  }

  if (resolvedAssetUrlCache.size >= MAX_ASSET_CACHE_SIZE) {
    resolvedAssetUrlCache.clear();
  }
  resolvedAssetUrlCache.set(cacheKey, resolved);
  return resolved;
}
