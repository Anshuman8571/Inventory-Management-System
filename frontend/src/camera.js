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
    // Keep it out of the visible layout, but it MUST be attached to the document.
    // A detached <input> that's only held in memory is what was causing the
    // "Opening gallery..." screen to hang forever: opening the Gallery/Photos app
    // backgrounds the browser tab for much longer than a direct Camera capture
    // does, and on many Android browsers/WebViews an element that was never
    // actually in the DOM gets its listeners dropped during that time — so
    // `change` never fires and the promise never resolves or rejects.
    input.style.position = 'fixed';
    input.style.top = '-9999px';
    input.style.left = '-9999px';
    document.body.appendChild(input);

    let settled = false;

    function cleanup() {
      window.removeEventListener('focus', onWindowFocus);
      if (input.parentNode) input.parentNode.removeChild(input);
    }

    function settleResolve(value) {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(value);
    }

    function settleReject(err) {
      if (settled) return;
      settled = true;
      cleanup();
      reject(err);
    }

    input.onchange = () => {
      const file = input.files && input.files[0];
      if (!file) {
        settleReject(new Error('No photo selected.'));
        return;
      }
      resizeImage(file).then(settleResolve).catch(settleReject);
    };

    // Fallback for the case where the user opens Gallery/Camera and then cancels
    // without picking anything — some browsers never fire `change` at all in that
    // case, which would otherwise leave the screen hanging indefinitely just like
    // the bug above. When the browser tab regains focus with nothing selected,
    // treat it as a cancellation instead of waiting forever.
    function onWindowFocus() {
      setTimeout(() => {
        if (!settled && (!input.files || input.files.length === 0)) {
          settleReject(new Error('No photo selected.'));
        }
      }, 300);
    }
    window.addEventListener('focus', onWindowFocus);

    input.click();
  });
}

// Shows the photo the user just captured, before it's sent off for reading, so a
// blurry/wrong/cut-off shot can be retaken with zero cost — no wasted API call, no
// waiting to find out the read failed. This is the real equivalent of "immediate
// visual feedback" for a photo-then-read flow (this app has no live/bounding-box
// barcode scanning — see capturePhoto's comment above for why).
//
// photo is { mediaType, base64 } as returned by capturePhoto/resizeImage.
function renderPhotoPreview(container, photo, { onRetake, onUsePhoto, useLabel = 'Use Photo' } = {}) {
  const dataUrl = `data:${photo.mediaType};base64,${photo.base64}`;

  container.innerHTML = `
    <h1 class="title">Review Photo</h1>
    <div class="photo-preview-frame">
      <img src="${dataUrl}" alt="Captured photo" class="photo-preview-img" />
    </div>
    <p class="muted" style="text-align:center; margin: 10px 0 20px;">
      Make sure the text is in frame and readable.
    </p>
    <button type="button" class="btn-primary" id="use-photo-btn">${useLabel}</button>
    <button type="button" class="btn-secondary" id="retake-photo-btn">Retake Photo</button>
  `;

  document.getElementById('use-photo-btn').addEventListener('click', onUsePhoto);
  document.getElementById('retake-photo-btn').addEventListener('click', onRetake);
}

window.capturePhoto = capturePhoto;
window.renderPhotoPreview = renderPhotoPreview;