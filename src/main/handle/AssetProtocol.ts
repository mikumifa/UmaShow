import fs from 'fs';
import path from 'path';
import { net, protocol } from 'electron';
import { pathToFileURL } from 'url';
import { APP_PATH, ASSETS_PATH } from 'main/paths';

export const ASSET_SCHEME = 'asset';

const resolvedAssetCache = new Map<string, string | null>();

function assetRoots() {
  return [
    ASSETS_PATH,
    APP_PATH,
    path.join(APP_PATH, 'dist'),
    path.join(APP_PATH, 'web-assets'),
    path.join(APP_PATH, 'dist', 'web-assets'),
    path.join(process.cwd(), 'web-assets'),
  ];
}

export function resolveAssetPath(relativeFilePath: string) {
  const normalizedRelativePath = relativeFilePath
    .replace(/\\/g, '/')
    .replace(/^\/+/, '');
  if (
    !normalizedRelativePath ||
    normalizedRelativePath.includes('\0') ||
    normalizedRelativePath.split('/').includes('..')
  ) {
    return null;
  }
  const cached = resolvedAssetCache.get(normalizedRelativePath);
  if (cached !== undefined) return cached;

  const fullPath = assetRoots()
    .map((root) => {
      const resolvedRoot = path.resolve(root);
      const candidate = path.resolve(resolvedRoot, normalizedRelativePath);
      const relative = path.relative(resolvedRoot, candidate);
      if (relative.startsWith('..') || path.isAbsolute(relative)) return null;
      try {
        if (fs.statSync(candidate).isFile()) {
          return candidate;
        }
      } catch {
        // Try the next development/packaged asset root.
      }
      return null;
    })
    .find((candidate): candidate is string => Boolean(candidate));
  resolvedAssetCache.set(normalizedRelativePath, fullPath || null);
  return fullPath || null;
}

export function registerAssetProtocol() {
  protocol.handle(ASSET_SCHEME, (request) => {
    let relativeFilePath = '';
    try {
      const url = new URL(request.url);
      relativeFilePath = decodeURIComponent(
        `${url.hostname ? `${url.hostname}/` : ''}${url.pathname}`,
      );
    } catch {
      return new Response('Invalid asset URL', { status: 400 });
    }
    const fullPath = resolveAssetPath(relativeFilePath);
    if (!fullPath) return new Response('Asset not found', { status: 404 });
    return net.fetch(pathToFileURL(fullPath).toString());
  });
}
