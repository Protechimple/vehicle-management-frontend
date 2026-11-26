import { useEffect, useState } from 'react';
import { assetPhotosApi } from '../api/client';

// Photo files need the sign-in token, which an <img src> cannot send. This fetches the file and gives an object URL.
export default function useAuthedImage(assetType, assetId, photoId, size = 'thumb') {
  const [state, setState] = useState({ url: null, failed: false });

  useEffect(() => {
    if (!photoId) {
      setState({ url: null, failed: false });
      return undefined;
    }

    const controller = new AbortController();
    let url = null;
    setState({ url: null, failed: false });

    assetPhotosApi
      .fetchImage(assetType, assetId, photoId, size, { signal: controller.signal })
      .then((blob) => {
        url = URL.createObjectURL(blob);
        setState({ url, failed: false });
      })
      .catch((error) => {
        if (error.name !== 'AbortError') setState({ url: null, failed: true });
      });

    return () => {
      controller.abort();
      if (url) URL.revokeObjectURL(url);
    };
  }, [assetType, assetId, photoId, size]);

  return state;
}
