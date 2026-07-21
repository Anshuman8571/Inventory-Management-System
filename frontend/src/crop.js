// Screen for cropping an image before it's sent for processing.

function renderCropScreen(container, base64Image, { onRetake, onCropComplete } = {}) {
  container.innerHTML = `
    <h1 class="title">Crop Image</h1>
    <p class="muted" style="margin-top: -10px; margin-bottom: 20px;">Adjust the frame to focus on the items.</p>
    
    <div style="width: 100%; max-height: 50vh; min-height: 300px; background: #000; display: flex; align-items: center; justify-content: center; overflow: hidden; border-radius: 8px; margin-bottom: 20px;">
      <img id="crop-image-target" src="data:image/jpeg;base64,${base64Image}" style="max-width: 100%; display: block;" />
    </div>

    <div style="display: flex; gap: 10px;">
      <button type="button" class="btn-secondary" id="crop-cancel-btn" style="flex: 1;">Retake</button>
      <button type="button" class="btn-primary" id="crop-confirm-btn" style="flex: 2;">Crop & Continue</button>
    </div>
  `;

  const image = document.getElementById('crop-image-target');
  
  // Initialize Cropper.js
  const cropper = new Cropper(image, {
    viewMode: 1,
    dragMode: 'move',
    autoCropArea: 0.9,
    restore: false,
    guides: true,
    center: true,
    highlight: false,
    cropBoxMovable: true,
    cropBoxResizable: true,
    toggleDragModeOnDblclick: false,
  });

  document.getElementById('crop-cancel-btn').addEventListener('click', () => {
    cropper.destroy();
    if (onRetake) onRetake();
  });

  document.getElementById('crop-confirm-btn').addEventListener('click', () => {
    // Get cropped canvas
    const canvas = cropper.getCroppedCanvas({
      // Limit maximum size to prevent huge base64 strings
      maxWidth: 1600,
      maxHeight: 1600,
    });
    
    // Convert canvas to base64
    const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
    const match = dataUrl.match(/^data:(.*);base64,(.*)$/);
    if (!match) {
      alert("Failed to crop image.");
      return;
    }
    
    const croppedBase64 = match[2];
    cropper.destroy();
    
    // Call the callback with the new base64 string
    onCropComplete(croppedBase64);
  });
}

window.renderCropScreen = renderCropScreen;
