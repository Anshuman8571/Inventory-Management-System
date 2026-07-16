// Shared photo-capture helper — used by every photo-based flow (sticker scans now,
// bill photos later). Uses a native file input rather than raw getUserMedia, since it
// works without extra permissions UI to build ourselves and needs no HTTPS (getUserMedia
// requires a secure context; a plain file input does not).
//
// Deliberately NOT setting input.capture = 'environment' — forcing a direct camera-app
// handoff via that attribute is known to fail with a native "low memory" error on some
// Android devices/browsers when the browser process gets suspended while the camera app
// is open. Leaving capture unset lets the OS show its normal picker (Camera / Gallery /
// Files), which is more stable across devices — the user just taps "Camera" from there.

// Resize/compress before sending — helps avoid memory pressure holding a full-resolution
// phone photo (often 8-12MP) in memory, and keeps the AI extraction call cheaper/faster
// (see rules.md, token/cost efficiency rules). 1600px is plenty for reading sticker text.
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

function capturePhoto() {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';

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
