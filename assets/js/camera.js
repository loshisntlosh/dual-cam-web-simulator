document.addEventListener('DOMContentLoaded', () => {
    const videoSource = document.getElementById('camera-source');
    const canvasVertical = document.getElementById('canvas-vertical');
    const canvasHorizontal = document.getElementById('canvas-horizontal');
    const btnSwitch = document.getElementById('btn-switch');
    const btnShutter = document.getElementById('btn-shutter');
    const btnModeToggle = document.getElementById('btn-mode-toggle');
    const btnQuality = document.getElementById('btn-quality');
    const recIndicator = document.getElementById('rec-indicator');
    const galleryPreview = document.getElementById('gallery-trigger');

    const ctxVertical = canvasVertical.getContext('2d');
    const ctxHorizontal = canvasHorizontal.getContext('2d');

    let currentFacingMode = 'environment';
    let currentStream = null;
    let currentMode = 'FOTO'; // 'FOTO' o 'VIDEO'
    let mediaRecorder = null;
    let recordedChunks = [];
    let isRecordingVideo = false;

    // Perfiles de Calidad basados en especificaciones del iPhone 15 Pro Max
    const videoQualities = [
        { label: '4K / 30FPS', width: 3840, height: 2160, frameRate: 30 },
        { label: '4K / 60FPS', width: 3840, height: 2160, frameRate: 60 },
        { label: '1080p / 30FPS', width: 1920, height: 1080, frameRate: 30 },
        { label: '1080p / 60FPS', width: 1920, height: 1080, frameRate: 60 }
    ];
    let currentQualityIndex = 0;

    async function startCamera(facingMode, qualityConfig = videoQualities[currentQualityIndex]) {
        if (currentStream) {
            currentStream.getTracks().forEach(track => track.stop());
        }

        try {
            const constraints = {
                video: { 
                    facingMode: facingMode,
                    width: { ideal: qualityConfig.width },
                    height: { ideal: qualityConfig.height },
                    frameRate: { ideal: qualityConfig.frameRate }
                },
                audio: true
            };

            currentStream = await navigator.mediaDevices.getUserMedia(constraints);
            videoSource.srcObject = currentStream;
            
            videoSource.onloadedmetadata = () => {
                videoSource.play();
                requestAnimationFrame(renderSimultaneousFeeds);
            };
            console.log(`[Camera] Configurada: ${qualityConfig.label} | Facing: ${facingMode}`);
        } catch (error) {
            console.warn('[Camera] Ajuste estricto falló, intentando formato estándar...', error);
            try {
                currentStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
                videoSource.srcObject = currentStream;
                videoSource.play();
                requestAnimationFrame(renderSimultaneousFeeds);
            } catch (err) {
                alert('No se pudo acceder a la cámara. Revisa los permisos.');
            }
        }
    }

    // Renderizado con proporciones matemáticas perfectas (Crop Center sin deformación)
    function drawPerfectProportions(video, ctx, canvas, targetAspect) {
        const vW = video.videoWidth;
        const vH = video.videoHeight;
        const cW = canvas.width;
        const cH = canvas.height;

        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, cW, cH);

        if (!vW || !vH) return;

        const sourceAspect = vW / vH;
        let sWidth = vW;
        let sHeight = vH;
        let sX = 0;
        let sY = 0;

        if (sourceAspect > targetAspect) {
            sWidth = vH * targetAspect;
            sX = (vW - sWidth) / 2;
        } else {
            sHeight = vW / targetAspect;
            sY = (vH - sHeight) / 2;
        }

        ctx.drawImage(video, sX, sY, sWidth, sHeight, 0, 0, cW, cH);
    }

    function renderSimultaneousFeeds() {
        if (videoSource.paused || videoSource.ended) return;

        canvasVertical.width = 1080;
        canvasVertical.height = 1920; // 9:16

        canvasHorizontal.width = 1920;
        canvasHorizontal.height = 1080; // 16:9

        // Dibujar con proporciones exactas simultáneamente
        drawPerfectProportions(videoSource, ctxVertical, canvasVertical, 9 / 16);
        drawPerfectProportions(videoSource, ctxHorizontal, canvasHorizontal, 16 / 9);

        requestAnimationFrame(renderSimultaneousFeeds);
    }

    // Cambiar Calidad al presionar el botón superior (Solo aplica en Modo Video o configuración general)
    btnQuality.addEventListener('click', () => {
        if (isRecordingVideo) return;
        currentQualityIndex = (currentQualityIndex + 1) % videoQualities.length;
        const activeQ = videoQualities[currentQualityIndex];
        btnQuality.textContent = activeQ.label;
        startCamera(currentFacingMode, activeQ);
    });

    // Alternar Modo FOTO / VIDEO
    btnModeToggle.addEventListener('click', () => {
        if (isRecordingVideo) return;

        if (currentMode === 'FOTO') {
            currentMode = 'VIDEO';
            btnModeToggle.textContent = 'FOTO';
            btnShutter.classList.add('recording-mode');
            recIndicator.textContent = '● MODO VIDEO';
        } else {
            currentMode = 'FOTO';
            btnModeToggle.textContent = 'VIDEO';
            btnShutter.classList.remove('recording-mode');
            recIndicator.textContent = '● DUAL LIVE';
        }
    });

    // Botón Switch Cámara
    btnSwitch.addEventListener('click', () => {
        if (isRecordingVideo) return;
        currentFacingMode = currentFacingMode === 'environment' ? 'user' : 'environment';
        startCamera(currentFacingMode, videoQualities[currentQualityIndex]);
    });

    // Botón Disparador
    btnShutter.addEventListener('click', () => {
        if (currentMode === 'FOTO') {
            takePhotoAndSaveToNativeGallery();
        } else {
            toggleVideoRecordingNative();
        }
    });

    // --- GUARDADO NATIVO A LA GALERÍA DE FOTOS DEL IPHONE ---
    function takePhotoAndSaveToNativeGallery() {
        triggerFlashEffect();

        const finalCanvas = document.createElement('canvas');
        finalCanvas.width = 1080;
        finalCanvas.height = 3120; // Combinación vertical + horizontal limpia
        const finalCtx = finalCanvas.getContext('2d');

        finalCtx.fillStyle = '#000000';
        finalCtx.fillRect(0, 0, finalCanvas.width, finalCanvas.height);

        // Posicionar proporciones simétricas
        finalCtx.drawImage(canvasVertical, 0, 0, 1080, 1920);
        finalCtx.drawImage(canvasHorizontal, 0, 1940, 1080, 1181);

        finalCanvas.toBlob((blob) => {
            const url = URL.createObjectURL(blob);
            triggerNativeDownload(url, `DualCam_${Date.now()}.jpg`);
            galleryPreview.innerHTML = '✅';
            setTimeout(() => { galleryPreview.innerHTML = '📥'; }, 2000);
        }, 'image/jpeg', 0.95);
    }

    function toggleVideoRecordingNative() {
        if (!isRecordingVideo) {
            recordedChunks = [];
            const combinedStream = captureCombinedCanvasStream();

            let options = { mimeType: 'video/mp4' };
            if (!MediaRecorder.isTypeSupported('video/mp4')) {
                options = { mimeType: 'video/webm;codecs=vp9' };
            }

            try {
                mediaRecorder = new MediaRecorder(combinedStream, options);
            } catch (e) {
                mediaRecorder = new MediaRecorder(combinedStream);
            }

            mediaRecorder.ondataavailable = (event) => {
                if (event.data && event.data.size > 0) {
                    recordedChunks.push(event.data);
                }
            };

            mediaRecorder.onstop = () => {
                const blob = new Blob(recordedChunks, { type: mediaRecorder.mimeType || 'video/mp4' });
                const videoUrl = URL.createObjectURL(blob);
                
                triggerNativeDownload(videoUrl, `DualCam_Video_${Date.now()}.mp4`);
                galleryPreview.innerHTML = '✅';
                setTimeout(() => { galleryPreview.innerHTML = '📥'; }, 2000);
            };

            mediaRecorder.start();
            isRecordingVideo = true;
            btnShutter.style.borderColor = '#ff3b30';
            recIndicator.classList.add('recording');
            recIndicator.textContent = '🔴 GRABANDO';
            btnModeToggle.style.opacity = '0.3';
            btnQuality.style.opacity = '0.3';

        } else {
            mediaRecorder.stop();
            isRecordingVideo = false;
            btnShutter.style.borderColor = 'white';
            recIndicator.classList.remove('recording');
            recIndicator.textContent = '● MODO VIDEO';
            btnModeToggle.style.opacity = '1';
            btnQuality.style.opacity = '1';
        }
    }

    function captureCombinedCanvasStream() {
        const streamCanvas = document.createElement('canvas');
        streamCanvas.width = 1080;
        streamCanvas.height = 3120;
        const sCtx = streamCanvas.getContext('2d');

        function drawStreamFrame() {
            if (isRecordingVideo) {
                sCtx.fillStyle = '#000000';
                sCtx.fillRect(0, 0, streamCanvas.width, streamCanvas.height);
                sCtx.drawImage(canvasVertical, 0, 0, 1080, 1920);
                sCtx.drawImage(canvasHorizontal, 0, 1940, 1080, 1181);
                requestAnimationFrame(drawStreamFrame);
            }
        }
        drawStreamFrame();

        const canvasStream = streamCanvas.captureStream(60); // 60 FPS fluidos
        const audioTracks = currentStream.getAudioTracks();
        if (audioTracks.length > 0) {
            canvasStream.addTrack(audioTracks[0]);
        }
        return canvasStream;
    }

    // Disparador de descarga optimizado para el sistema nativo de iOS (Safari / PWA)
    function triggerNativeDownload(fileUrl, filename) {
        const a = document.createElement('a');
        a.href = fileUrl;
        a.download = filename;
        a.target = '_blank';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    }

    function triggerFlashEffect() {
        const flash = document.createElement('div');
        flash.style.position = 'fixed';
        flash.style.top = '0';
        flash.style.left = '0';
        flash.style.width = '100vw';
        flash.style.height = '100vh';
        flash.style.backgroundColor = 'white';
        flash.style.zIndex = '99999';
        flash.style.transition = 'opacity 0.25s ease';
        document.body.appendChild(flash);

        setTimeout(() => {
            flash.style.opacity = '0';
            setTimeout(() => flash.remove(), 250);
        }, 40);
    }

    startCamera(currentFacingMode, videoQualities[currentQualityIndex]);
});
