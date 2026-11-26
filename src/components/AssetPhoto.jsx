import useAuthedImage from '../hooks/useAuthedImage';

function PlaceholderIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="size-1/2 max-h-8 max-w-8 text-steel-300" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 17l1.5-5A2 2 0 0 1 6.4 10.5h11.2a2 2 0 0 1 1.9 1.5L21 17" />
      <path d="M3 17h18v2a1 1 0 0 1-1 1h-1.5a1 1 0 0 1-1-1v-1h-11v1a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z" />
      <path d="M7 10.5 8.5 6h7L17 10.5" />
    </svg>
  );
}

// One asset photo, or a vehicle outline when there is none. className sets its size and shape.
export default function AssetPhoto({ assetType, assetId, photoId, size = 'thumb', alt = '', className = '', fit = 'cover' }) {
  const { url } = useAuthedImage(assetType, assetId, photoId, size);

  return (
    <div className={`flex items-center justify-center overflow-hidden bg-steel-100 ${className}`}>
      {url ? (
        <img src={url} alt={alt} className={`size-full ${fit === 'contain' ? 'object-contain' : 'object-cover'}`} />
      ) : (
        <PlaceholderIcon />
      )}
    </div>
  );
}
