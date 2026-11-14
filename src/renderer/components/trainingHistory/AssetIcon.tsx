import { memo, type ReactNode, useState } from 'react';
import assetUrl from 'renderer/utils/assetUrl';

const failedAssetSrcSet = new Set<string>();

function AssetIconImpl({
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
  const src = assetUrl(path);
  const [failedSrc, setFailedSrc] = useState<string | null>(() =>
    src && failedAssetSrcSet.has(src) ? src : null,
  );

  if (!src || failedSrc === src || failedAssetSrcSet.has(src)) {
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
      onError={() => {
        failedAssetSrcSet.add(src);
        setFailedSrc(src);
      }}
    />
  );
}

const AssetIcon = memo(AssetIconImpl);
export default AssetIcon;
