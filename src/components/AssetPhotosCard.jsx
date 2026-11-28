import { useCallback, useEffect, useRef, useState } from 'react';
import { assetPhotosApi } from '../api/client';
import { Alert, Badge, Button, Card, Modal, Spinner } from './ui';
import Can from './Can';
import AssetPhoto from './AssetPhoto';
import { resizeForUpload } from '../utils/resizeImage';

export const MAX_PHOTOS = 10;
export const PHOTO_ACCEPT = 'image/jpeg,image/png,image/webp,image/*';

// Resizes and uploads photos one at a time. Returns the names of the ones that failed, with the reason.
export async function uploadPhotos(assetType, assetId, files, onProgress) {
  const failures = [];
  for (const [index, file] of files.entries()) {
    onProgress?.(index + 1, files.length);
    try {
      const resized = await resizeForUpload(file);
      await assetPhotosApi.upload(assetType, assetId, resized);
    } catch (err) {
      failures.push(`${file.name}: ${err.message}`);
    }
  }
  return failures;
}

function PhotoViewer({ assetType, assetId, photos, index, onIndexChange, onClose, onChanged }) {
  const photo = photos[index];
  const [busy, setBusy] = useState(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    setConfirmingDelete(false);
    setError(null);
  }, [photo?.id]);

  useEffect(() => {
    function handleKey(event) {
      if (event.key === 'ArrowRight' && index < photos.length - 1) onIndexChange(index + 1);
      if (event.key === 'ArrowLeft' && index > 0) onIndexChange(index - 1);
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [index, photos.length, onIndexChange]);

  if (!photo) return null;

  async function run(action, work) {
    setBusy(action);
    setError(null);
    try {
      await work();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(null);
    }
  }

  const setCover = () =>
    run('cover', async () => {
      await assetPhotosApi.setCover(assetType, assetId, photo.id);
      await onChanged();
      onIndexChange(0);
    });

  const remove = () =>
    run('delete', async () => {
      await assetPhotosApi.remove(assetType, assetId, photo.id);
      const remaining = photos.length - 1;
      await onChanged();
      if (remaining === 0) onClose();
      else onIndexChange(Math.min(index, remaining - 1));
    });

  return (
    <Modal
      open
      wide="xl"
      onClose={onClose}
      title={`Photo ${index + 1} of ${photos.length}`}
      description={[photo.originalFilename, photo.uploadedByName].filter(Boolean).join(' · ')}
      footer={
        <>
          <Can resource="DOCUMENT" action="CREATE">
            {confirmingDelete ? (
              <>
                <span className="mr-auto self-center text-sm text-steel-600">Delete this photo?</span>
                <Button variant="secondary" onClick={() => setConfirmingDelete(false)} disabled={busy === 'delete'}>
                  Keep
                </Button>
                <Button variant="danger" loading={busy === 'delete'} onClick={remove}>
                  Delete
                </Button>
              </>
            ) : (
              <>
                <Button variant="danger" onClick={() => setConfirmingDelete(true)} disabled={Boolean(busy)}>
                  Delete
                </Button>
                {!photo.isCover && (
                  <Button variant="secondary" loading={busy === 'cover'} onClick={setCover}>
                    Set as cover
                  </Button>
                )}
              </>
            )}
          </Can>
          {!confirmingDelete && (
            <>
              <Button variant="secondary" disabled={index === 0} onClick={() => onIndexChange(index - 1)}>
                ← Previous
              </Button>
              <Button variant="secondary" disabled={index === photos.length - 1} onClick={() => onIndexChange(index + 1)}>
                Next →
              </Button>
            </>
          )}
        </>
      }
    >
      {error && <Alert tone="error">{error}</Alert>}
      <div className="relative">
        {photo.isCover && (
          <div className="absolute top-2 left-2 z-10">
            <Badge tone="brand">Cover</Badge>
          </div>
        )}
        <AssetPhoto
          assetType={assetType}
          assetId={assetId}
          photoId={photo.id}
          size="full"
          fit="contain"
          alt={photo.originalFilename}
          className="h-[60vh] w-full rounded"
        />
      </div>
    </Modal>
  );
}

export default function AssetPhotosCard({ assetType, assetId, onChange }) {
  const inputRef = useRef(null);
  const [photos, setPhotos] = useState(null);
  const [maxPhotos, setMaxPhotos] = useState(MAX_PHOTOS);
  const [loadError, setLoadError] = useState(null);
  const [uploadErrors, setUploadErrors] = useState([]);
  const [progress, setProgress] = useState(null);
  const [viewing, setViewing] = useState(null);

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      const response = await assetPhotosApi.list(assetType, assetId);
      setPhotos(response.data);
      if (response.maxPhotos) setMaxPhotos(response.maxPhotos);
    } catch (err) {
      setLoadError(err.message);
    }
  }, [assetType, assetId]);

  useEffect(() => {
    load();
  }, [load]);

  const remaining = photos ? Math.max(0, maxPhotos - photos.length) : 0;

  async function handleFiles(event) {
    const chosen = [...(event.target.files ?? [])];
    event.target.value = '';
    if (chosen.length === 0) return;

    const errors = [];
    const files = chosen.slice(0, remaining);
    if (chosen.length > remaining) {
      errors.push(`Only ${remaining} more photo${remaining === 1 ? '' : 's'} can be added; the rest were skipped.`);
    }

    setUploadErrors([]);
    errors.push(...(await uploadPhotos(assetType, assetId, files, (done, total) => setProgress({ done, total }))));
    setProgress(null);
    setUploadErrors(errors);
    await load();
    onChange?.();
  }

  async function handleChanged() {
    await load();
    onChange?.();
  }

  return (
    <Card
      title="Photos"
      subtitle={photos ? `${photos.length} of ${maxPhotos}` : undefined}
      className="mt-4"
      actions={
        <Can resource="DOCUMENT" action="CREATE">
          <Button
            variant="secondary"
            size="sm"
            loading={Boolean(progress)}
            disabled={!photos || remaining === 0}
            onClick={() => inputRef.current?.click()}
          >
            {progress ? `Uploading ${progress.done} of ${progress.total}…` : 'Add photos'}
          </Button>
          <input ref={inputRef} type="file" accept={PHOTO_ACCEPT} multiple className="hidden" onChange={handleFiles} />
        </Can>
      }
    >
      {loadError && <Alert tone="error">{loadError}</Alert>}
      {uploadErrors.length > 0 && (
        <Alert tone="error">
          <ul className="list-disc pl-4">
            {uploadErrors.map((message) => (
              <li key={message}>{message}</li>
            ))}
          </ul>
        </Alert>
      )}

      {!photos ? (
        <Spinner label="Loading photos" />
      ) : photos.length === 0 ? (
        <p className="text-sm text-steel-500">No photos yet. Add up to {maxPhotos}; the first becomes the cover.</p>
      ) : (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
          {photos.map((photo, index) => (
            <button
              key={photo.id}
              type="button"
              onClick={() => setViewing(index)}
              className="group relative aspect-square overflow-hidden rounded border border-steel-200 focus-visible:outline-2 focus-visible:outline-brand-600"
              title={photo.originalFilename}
            >
              <AssetPhoto
                assetType={assetType}
                assetId={assetId}
                photoId={photo.id}
                alt={photo.originalFilename}
                className="size-full transition-transform group-hover:scale-105"
              />
              {photo.isCover && (
                <span className="absolute top-1 left-1">
                  <Badge tone="brand">Cover</Badge>
                </span>
              )}
            </button>
          ))}
        </div>
      )}
      <p className="mt-2 text-xs text-steel-400">JPG, PNG or WEBP. Photos are resized before upload. Tap a photo to view, set as cover or delete.</p>

      {viewing !== null && photos?.length > 0 && (
        <PhotoViewer
          assetType={assetType}
          assetId={assetId}
          photos={photos}
          index={Math.min(viewing, photos.length - 1)}
          onIndexChange={setViewing}
          onClose={() => setViewing(null)}
          onChanged={handleChanged}
        />
      )}
    </Card>
  );
}
