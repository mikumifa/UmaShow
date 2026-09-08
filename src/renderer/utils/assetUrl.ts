export default function assetUrl(assetPath: string) {
  const normalizedPath = assetPath.trim();
  if (!normalizedPath) return '';
  if (/^(?:asset|https?|data|blob|file):/i.test(normalizedPath)) {
    return normalizedPath;
  }
  if (document.documentElement.dataset.autouma === 'true') {
    return new URL(
      normalizedPath.replace(/\\/g, '/').replace(/^\/+/, ''),
      document.baseURI,
    ).toString();
  }
  return `asset:///${normalizedPath
    .replace(/\\/g, '/')
    .replace(/^\/+/, '')
    .split('/')
    .map(encodeURIComponent)
    .join('/')}`;
}
