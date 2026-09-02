import { type ReactNode, useEffect, useMemo, useState } from 'react';

function assetUrl(path: string) {
  return `asset:///${path
    .replace(/\\/g, '/')
    .replace(/^\/+/, '')
    .split('/')
    .map(encodeURIComponent)
    .join('/')}`;
}

export default function AssetIcon({
  path,
  alt,
  className,
  fallback,
  loading = 'lazy',
}: {
  path: string;
  alt: string;
  className: string;
  fallback?: ReactNode;
  loading?: 'eager' | 'lazy';
}) {
  const [failed, setFailed] = useState(false);
  const src = useMemo(() => assetUrl(path), [path]);

  useEffect(() => {
    setFailed(false);
  }, [path]);

  if (failed) {
    return (
      fallback ?? <div className={`${className} bg-gray-100`} title={alt} />
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      className={className}
      draggable={false}
      loading={loading}
      decoding="async"
      onError={() => setFailed(true)}
    />
  );
}
