export default function assetUrl(assetPath: string) {
  const normalizedPath = assetPath.trim();
  if (!normalizedPath) return '';
  if (/^(?:asset|https?|data|blob|file):/i.test(normalizedPath)) {
    return normalizedPath;
  }
  return `asset:///${normalizedPath
    .replace(/\\/g, '/')
    .replace(/^\/+/, '')
    .split('/')
    .map(encodeURIComponent)
    .join('/')}`;
}
