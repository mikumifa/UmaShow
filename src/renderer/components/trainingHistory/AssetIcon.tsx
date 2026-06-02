import { useEffect, useState } from 'react';

const iconUrlCache = new Map<string, Promise<string | null>>();

function getIconUrl(path: string) {
  const cached = iconUrlCache.get(path);
  if (cached) return cached;
  const promise = window.electron.utils.getFile(path) as Promise<string | null>;
  iconUrlCache.set(path, promise);
  return promise;
}

export default function AssetIcon({
  path,
  alt,
  className,
}: {
  path: string;
  alt: string;
  className: string;
}) {
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    getIconUrl(path).then((url) => {
      if (mounted) setSrc(url);
    });
    return () => {
      mounted = false;
    };
  }, [path]);

  if (!src) {
    return <div className={`${className} bg-gray-100`} title={alt} />;
  }

  return <img src={src} alt={alt} className={className} draggable={false} />;
}
