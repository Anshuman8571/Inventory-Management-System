// Shared photo-capture helper — used by every photo-based flow (sticker scans, bill
// photos). Uses a native file input rather than raw getUserMedia, since it works
// without extra permissions UI to build ourselves and needs no HTTPS (getUserMedia
// requires a secure context; a plain file input does not).
//
// Supports two modes:
// - useCamera: true  -> sets capture="environment", opening the camera app directly.
// - useCamera: false -> plain file picker (Gallery/Files), no camera hint.
//
// IMPORTANT FIX: previously, if the user opened the picker and tapped Cancel without
// choosing a photo, nothing ever fired — the screen sat on "Opening camera..." forever,
// with no way out except refreshing the page (this was likely the main cause of needing
// to refresh to get back to Home). Modern browsers fire a 'cancel' event on the file
// input when the picker is dismissed without a selection — listening for that now
// rejects the promise properly so the UI can recover instead of hanging.

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

    let settled = false;

    input.onchange = () => {
      const file = input.files && input.files[0];
      if (!file) {
        if (!settled) {
          settled = true;
          reject(new Error('No photo captured.'));
        }
        return;
      }
      settled = true;
      resizeImage(file).then(resolve).catch(reject);
    };

    // Fires when the user dismisses the picker without choosing anything (supported in
    // current Chrome/Edge/Android WebView; harmless no-op on browsers that don't support
    // it yet — see the fallback timer below for those cases).
    input.addEventListener('cancel', () => {
      if (!settled) {
        settled = true;
        reject(new Error('Photo selection was cancelled.'));
      }
    });

    // Fallback safety net for browsers that don't fire 'cancel' at all: if focus returns
    // to the page (picker closed, one way or another) and nothing was chosen after a
    // short grace period, treat it as cancelled rather than hanging indefinitely.
    window.addEventListener(
      'focus',
      function onFocusBack() {
        window.removeEventListener('focus', onFocusBack);
        setTimeout(() => {
          if (!settled) {
            settled = true;
            reject(new Error('Photo selection was cancelled.'));
          }
        }, 1000);
      },
      { once: true }
    );

    input.click();
  });
}

window.capturePhoto = capturePhoto;