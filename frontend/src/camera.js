// Shared photo-capture helper — used by every photo-based flow (sticker scans, bill
// photos). Uses a native file input rather than raw getUserMedia, since it works
// without extra permissions UI to build ourselves and needs no HTTPS (getUserMedia
// requires a secure context; a plain file input does not).
//
// Supports two modes:
// - useCamera: true  -> sets capture="environment", opening the camera app directly.
// - useCamera: false -> plain file picker (Gallery/Files), no camera hint.
//
// Why both exist: forcing the camera hint on every capture caused a native "low memory"
// crash on some Android devices when the browser process got suspended while the camera
// app was open — so it was removed entirely. But without the hint, some browsers/devices
// don't surface a "Camera" option in the plain picker at all, only Gallery/Files. Offering
// both as an explicit choice restores camera access without forcing it on devices where
// it's flaky — if the camera path misbehaves again, Gallery still works as a fallback.

const MAX_DIMENSION = 1600;
const JPEG_QUALITY = 0.8;

function resizeImage(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);

      let { width, height } = img;
      if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
        const scale = MAX_DIMENSION / Math.max(width, height);
        width = Math.round(width * scale);
        height = Math.round(height * scale);
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      canvas.getContext('2d').drawImage(img, 0, 0, width, height);

      const dataUrl = canvas.toDataURL('image/jpeg', JPEG_QUALITY);
      const match = dataUrl.match(/^data:(.*);base64,(.*)$/);
      if (!match) {
        reject(new Error('Could not process the photo.'));
        return;
      }
      resolve({ mediaType: match[1], base64: match[2] });
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Could not process the photo.'));
    };

    img.src = objectUrl;
  });
}

function capturePhoto({ useCamera = false } = {}) {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    if (useCamera) {
      input.capture = 'environment';
    }

    input.onchange = () => {
      const file = input.files && input.files[0];
      if (!file) {
        reject(new Error('No photo captured.'));
        return;
      }
      resizeImage(file).then(resolve).catch(reject);
    };

    input.click();
  });
}

window.capturePhoto = capturePhoto;