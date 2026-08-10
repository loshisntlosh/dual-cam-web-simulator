document.addEventListener('DOMContentLoaded', () => {
    const videoSource = document.getElementById('camera-source');
    const canvasVertical = document.getElementById('canvas-vertical');
    const canvasHorizontal = document.getElementById('canvas-horizontal');
    const btnSwitch = document.getElementById('btn-switch');
    const btnShutter = document.getElementById('btn-shutter');
    const btnModeToggle = document.getElementById('btn-mode-toggle');
    const recIndicator = document.getElementById('rec-indicator');
    const galleryPreview = document.getElementById('gallery-preview');

    const ctxVertical = canvasVertical.getContext('2d');
    const ctxHorizontal = canvasHorizontal.getContext('2d');

    let currentFacingMode = 'environment';
    let currentStream = null;
    let currentMode = 'FOTO'; // 'FOTO' o 'VIDEO'
    let mediaRecorder = null;
    let recordedChunks = [];
    let isRecordingVideo = false;

    async function startCamera(facingMode) {
        if (currentStream) {
            currentStream.getTracks().forEach(track => track.stop());
        }

        try {
            const constraints = {
                video: { 
                    facingMode: facingMode,
                    width: { ideal: 1280 },
                    height: { ideal: 720 }
                },
                audio: true // Habilitado para grabar video con audio
            };

            currentStream = await navigator.mediaDevices.getUserMedia(constraints);
            videoSource.srcObject = currentStream;
            
            videoSource.onloadedmetadata = () => {
                videoSource.play();
                requestAnimationFrame(renderSimultaneousFeeds);
            };
            console.log(`[Camera] Activa con facingMode: ${facingMode}`);
        } catch (error) {
            console.error('[Camera] Error al acceder a la cámara:', error);
            alert('No se pudo acceder a la cámara o micrófono. Verifica los permisos.');
        }
    }

    // Renderizado con proporciones perfectas (Aspect Fit sin deformaciones)
    function drawProportional(video, ctx, canvas) {
        const vW = video.videoWidth;
        const vH = video.videoHeight;
        const cW = canvas.width;
        const cH = canvas.height;

        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, cW, cH);

        if (!vW || !vH) return;

        // Calcular escala manteniendo proporciones reales
        const vRatio = vW / vH;
        const cRatio = cW / cH;

        let drawW = cW;
        let drawH = cH;
        let startX = 0;
        let startY = 0;

        if (vRatio > cRatio) {
            drawH = cW / vRatio;
            startY = (cH - drawH) / 2;
        } else {
            drawW = cH * vRatio;
            startX = (cW - drawW) / 2;
        }

        ctx.drawImage(video, 0, 0, vW, vH, startX, startY, drawW, drawH);
    }

    function renderSimultaneousFeeds() {
        if (videoSource.paused || videoSource.ended) return;

        canvasVertical.width = 360;
        canvasVertical.height = 640;

        canvasHorizontal.width = 640;
        canvasHorizontal.height = 360;

        // Pintar ambos visores manteniendo proporciones exactas
        drawProportional(videoSource, ctxVertical, canvasVertical);
        drawProportional(videoSource, ctxHorizontal, canvasHorizontal);

        requestAnimationFrame(renderSimultaneousFeeds);
    }

    // Alternar entre modo FOTO y modo VIDEO
    btnModeToggle.addEventListener('click', () => {
        if (isRecordingVideo) return; // No cambiar de modo si está grabando

        if (currentMode === 'FOTO') {
            currentMode = 'VIDEO';
            btnModeToggle.textContent = 'VIDEO';
            btnShutter.classList.add('recording-mode');
            recIndicator.textContent = '● MODO VIDEO';
        } else {
            currentMode = 'FOTO';
            btnModeToggle.textContent = 'FOTO';
            btnShutter.classList.remove('recording-mode');
            recIndicator.textContent = '● LIVE DUAL';
        }
        console.log(`[Mode] Cambiado a: ${currentMode}`);
    });

    // Cambiar cámara (Frontal / Trasera)
    btnSwitch.addEventListener('click', () => {
        if (isRecordingVideo) return;
        currentFacingMode = currentFacingMode === 'environment' ? 'user' : 'environment';
        startCamera(currentFacingMode);
    });

    // Botón Disparador Principal (Acción depende del Modo actual)
    btnShutter.addEventListener('click', () => {
        if (currentMode === 'FOTO') {
            takePhotoAction();
        } else {
            toggleVideoRecordingAction();
        }
    });

    // Acción de Tomar Foto y enviar a Galería
    function takePhotoAction() {
        triggerFlashEffect();

        const finalCanvas = document.createElement('canvas');
        finalCanvas.width = 640;
        finalCanvas.height = 1040;
        const finalCtx = finalCanvas.getContext('2d');

        finalCtx.fillStyle = '#000000';
        finalCtx.fillRect(0, 0, finalCanvas.width, finalCanvas.height);

        // Fusionar diseño vertical arriba y horizontal abajo con proporciones limpias
        finalCtx.drawImage(canvasVertical, (640 - 360)/2, 20, 360, 640);
        finalCtx.drawImage(canvasHorizontal, 0, 680, 640, 360);

        const dataURL = finalCanvas.toDataURL('image/jpeg', 0.95);
        galleryPreview.innerHTML = `<img src="${dataURL}" alt="Foto">`;

        // Descarga automática hacia la galería del dispositivo
        downloadFile(dataURL, `DualCam_Foto_${Date.now()}.jpg`);
        console.log('[Gallery] Foto enviada a galería.');
    }

    // Acción de Grabar / Detener Video y enviar a Galería
    function toggleVideoRecordingAction() {
        if (!isRecordingVideo) {
            // Iniciar Grabación
            recordedChunks = [];
            const combinedStream = captureCombinedCanvasStream();

            try {
                mediaRecorder = new MediaRecorder(combinedStream, { mimeType: 'video/webm;codecs=vp9' });
            } catch (e) {
                try {
                    mediaRecorder = new MediaRecorder(combinedStream, { mimeType: 'video/mp4' });
                } catch (err) {
                    mediaRecorder = new MediaRecorder(combinedStream);
                }
            }

            mediaRecorder.ondataavailable = (event) => {
                if (event.data && event.data.size > 0) {
                    recordedChunks.push(event.data);
                }
            };

            mediaRecorder.onstop = () => {
                const blob = new Blob(recordedChunks, { type: 'video/mp4' });
                const videoUrl = URL.createObjectURL(blob);
                
                galleryPreview.innerHTML = `<video src="${videoUrl}" style="width:100%; height:100%; object-fit:cover;"></video>`;
                
                // Enviar video grabado a la galería del dispositivo
                downloadFile(videoUrl, `DualCam_Video_${Date.now()}.mp4`);
                console.log('[Gallery] Video enviado a galería.');
            };

            mediaRecorder.start();
            isRecordingVideo = true;
            btnShutter.style.borderColor = '#ff3b30';
            recIndicator.classList.add('recording');
            recIndicator.textContent = '🔴 GRABANDO...';
            btnModeToggle.style.opacity = '0.5';

        } else {
            // Detener Grabación
            mediaRecorder.stop();
            isRecordingVideo = false;
            btnShutter.style.borderColor = 'white';
            recIndicator.classList.remove('recording');
            recIndicator.textContent = '● MODO VIDEO';
            btnModeToggle.style.opacity = '1';
        }
    }

    // Capturar el flujo combinado de los canvas para grabar en video
    function captureCombinedCanvasStream() {
        const streamCanvas = document.createElement('canvas');
        streamCanvas.width = 640;
        streamCanvas.height = 1040;
        const sCtx = streamCanvas.getContext('2d');

        function drawStreamFrame() {
            if (isRecordingVideo) {
                sCtx.fillStyle = '#000000';
                sCtx.fillRect(0, 0, streamCanvas.width, streamCanvas.height);
                sCtx.drawImage(canvasVertical, (640 - 360)/2, 20, 360, 640);
                sCtx.drawImage(canvasHorizontal, 0, 680, 640, 360);
                requestAnimationFrame(drawStreamFrame);
            }
        }
        drawStreamFrame();

        const canvasStream = streamCanvas.captureStream(30); // 30 FPS
        
        // Agregar audio del micrófono si está disponible
        const audioTracks = currentStream.getAudioTracks();
        if (audioTracks.length > 0) {
            canvasStream.addTrack(audioTracks[0]);
        }

        return canvasStream;
    }

    function downloadFile(url, filename) {
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    function triggerFlashEffect() {
        const flash = document.createElement('div');
        flash.style.position = 'fixed';
        flash.style.top = '0';
        flash.style.left = '0';
        flash.style.width = '100%';
        flash.style.height = '100%';
        flash.style.backgroundColor = 'white';
        flash.style.zIndex = '9999';
        flash.style.transition = 'opacity 0.3s ease';
        document.body.appendChild(flash);

        setTimeout(() => {
            flash.style.opacity = '0';
            setTimeout(() => flash.remove(), 300);
        }, 50);
    }

    startCamera(currentFacingMode);
});
