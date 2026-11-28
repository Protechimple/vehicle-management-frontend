// Phone photos are often 4–8 MB. They are shrunk in the browser before upload, so the server needs no image library
// and pages load quickly. Returns the resized photo and a small thumbnail, both as JPEG blobs.

export const FULL_MAX_SIDE = 1600;
export const THUMB_MAX_SIDE = 320;

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error(`"${file.name}" could not be read as an image`));
    };
    image.src = url;
  });
}

function drawScaled(image, maxSide, quality) {
  const scale = Math.min(1, maxSide / Math.max(image.naturalWidth, image.naturalHeight));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
  const context = canvas.getContext('2d');
  // JPEG has no transparency: a transparent PNG would otherwise turn black.
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('The photo could not be resized'))),
      'image/jpeg',
      quality
    );
  });
}

export async function resizeForUpload(file) {
  const image = await loadImage(file);
  const [photo, thumb] = await Promise.all([
    drawScaled(image, FULL_MAX_SIDE, 0.82),
    drawScaled(image, THUMB_MAX_SIDE, 0.75),
  ]);
  const baseName = file.name.replace(/\.[^.]+$/, '') || 'photo';
  return { photo, thumb, filename: `${baseName}.jpg` };
}
