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
    
    // Variables para la grabación de video unificada y estable
    let masterMediaRecorder = null;
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

    // Inicialización de la cámara con manejo de errores robusto
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
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true
                }
            };

            currentStream = await navigator.mediaDevices.getUserMedia(constraints);
            videoSource.srcObject = currentStream;
            
            videoSource.onloadedmetadata = () => {
                videoSource.play();
                requestAnimationFrame(renderSimultaneousFeeds);
            };
        } catch (error) {
            console.warn('Fallback a resolución estándar por restricción de hardware', error);
            try {
                currentStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
                videoSource.srcObject = currentStream;
                videoSource.play();
                requestAnimationFrame(renderSimultaneousFeeds);
            } catch (err) {
                alert('No se pudo acceder a la cámara. Por favor, verifica los permisos en tu navegador.');
            }
        }
    }

    // Renderizado matemático con proporción fija (Crop Center sin deformaciones)
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

        // Definir resoluciones nativas limpias para cada canvas
        canvasVertical.width = 1080;
        canvasVertical.height = 1920; // 9:16

        canvasHorizontal.width = 1920;
        canvasHorizontal.height = 1080; // 16:9

        drawPerfectProportions(videoSource, ctxVertical, canvasVertical, 9 / 16);
        drawPerfectProportions(videoSource, ctxHorizontal, canvasHorizontal, 16 / 9);

        requestAnimationFrame(renderSimultaneousFeeds);
    }

    // Selector de Calidad
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

    // Cambiar Cámara Frontal / Trasera
    btnSwitch.addEventListener('click', () => {
        if (isRecordingVideo) return;
        currentFacingMode = currentFacingMode === 'environment' ? 'user' : 'environment';
        startCamera(currentFacingMode, videoQualities[currentQualityIndex]);
    });

    // Disparador Único (Foto o Video)
    btnShutter.addEventListener('click', () => {
        if (currentMode === 'FOTO') {
            takeTwoPhotosAndSendToGallery();
        } else {
            toggleUnifiedVideoRecording();
        }
    });

    // --- 1. CAPTURA DE 2 FOTOS INDEPENDIENTES ---
    function takeTwoPhotosAndSendToGallery() {
        triggerFlashEffect();
        const timestamp = Date.now();

        canvasVertical.toBlob((blobV) => {
            const fileV = new File([blobV], `DualCam_Vertical_${timestamp}.jpg`, { type: 'image/jpeg' });

            canvasHorizontal.toBlob(async (blobH) => {
                const fileH = new File([blobH], `DualCam_Horizontal_${timestamp}.jpg`, { type: 'image/jpeg' });

                if (navigator.canShare && navigator.canShare({ files: [fileV, fileH] })) {
                    try {
                        await navigator.share({
                            files: [fileV, fileH],
                            title: 'Capturas DualCam',
                            text: 'Fotos vertical y horizontal independientes'
                        });
                        galleryPreview.innerHTML = '✅';
                        setTimeout(() => { galleryPreview.innerHTML = '📥'; }, 2000);
                        return;
                    } catch (err) {
                        if (err.name !== 'AbortError') console.log('Share cancelado');
                    }
                }

                // Respaldo de descarga si no hay soporte de share nativo
                triggerIOSDownload(URL.createObjectURL(blobV), `DualCam_Vertical_${timestamp}.jpg`);
                setTimeout(() => {
                    triggerIOSDownload(URL.createObjectURL(blobH), `DualCam_Horizontal_${timestamp}.jpg`);
                }, 400);

                galleryPreview.innerHTML = '✅';
                setTimeout(() => { galleryPreview.innerHTML = '📥'; }, 2000);
            }, 'image/jpeg', 0.95);
        }, 'image/jpeg', 0.95);
    }

    // --- 2. GRABACIÓN DE VIDEO UNIFICADA Y ESTABLE ---
    function toggleUnifiedVideoRecording() {
        if (!isRecordingVideo) {
            recordedChunks = [];

            // Creamos un canvas combinado maestro para capturar el stream de forma estable en móviles
            const masterCanvas = document.createElement('canvas');
            masterCanvas.width = 1920;
            masterCanvas.height = 3000; // Contenedor vertical que almacena ambos feeds ordenados
            const mCtx = masterCanvas.getContext('2d');

            let recordingInterval;

            function drawMasterFrame() {
                if (isRecordingVideo) {
                    mCtx.fillStyle = '#000000';
                    mCtx.fillRect(0, 0, masterCanvas.width, masterCanvas.height);
                    
                    // Dibujar Feed Vertical arriba
                    mCtx.drawImage(canvasVertical, (1920 - 1080) / 2, 0, 1080, 1920);
                    // Dibujar Feed Horizontal abajo
                    mCtx.drawImage(canvasHorizontal, 0, 1940, 1920, 1080);
                    
                    recordingInterval = requestAnimationFrame(drawMasterFrame);
                }
            }

            drawMasterFrame();

            const masterStream = masterCanvas.captureStream(60); // 60 FPS estables
            const audioTracks = currentStream.getAudioTracks();
            if (audioTracks.length > 0) {
                masterStream.addTrack(audioTracks[0]);
            }

            let options = { mimeType: 'video/mp4' };
            if (!MediaRecorder.isTypeSupported('video/mp4')) {
                options = { mimeType: 'video/webm;codecs=vp9' };
            }

            try {
                masterMediaRecorder = new MediaRecorder(masterStream, options);
            } catch (e) {
                masterMediaRecorder = new MediaRecorder(masterStream);
            }

            masterMediaRecorder.ondataavailable = (event) => {
                if (event.data && event.data.size > 0) {
                    recordedChunks.push(event.data);
                }
            };

            const timestamp = Date.now();

            masterMediaRecorder.onstop = async () => {
                cancelAnimationFrame(recordingInterval);
                const blob = new Blob(recordedChunks, { type: masterMediaRecorder.mimeType || 'video/mp4' });
                const file = new File([blob], `DualCam_Video_Master_${timestamp}.mp4`, { type: blob.type });

                if (navigator.canShare && navigator.canShare({ files: [file] })) {
                    try {
                        await navigator.share({
                            files: [file],
                            title: 'Video DualCam Master',
                            text: 'Grabación dual unificada'
                        });
                        galleryPreview.innerHTML = '✅';
                        setTimeout(() => { galleryPreview.innerHTML = '📥'; }, 2000);
                        return;
                    } catch (err) {
                        if (err.name !== 'AbortError') console.log('Share de video cancelado');
                    }
                }

                triggerIOSDownload(URL.createObjectURL(blob), `DualCam_Video_${timestamp}.mp4`);
                galleryPreview.innerHTML = '✅';
                setTimeout(() => { galleryPreview.innerHTML = '📥'; }, 2000);
            };

            masterMediaRecorder.start(250); // Recolectar datos en chunks cada 250ms para evitar pérdida de búfer
            isRecordingVideo = true;

            btnShutter.style.borderColor = '#ff3b30';
            recIndicator.classList.add('recording');
            recIndicator.textContent = '🔴 GRABANDO';
            btnModeToggle.style.opacity = '0.3';
            btnQuality.style.opacity = '0.3';

        } else {
            if (masterMediaRecorder && masterMediaRecorder.state !== 'inactive') {
                masterMediaRecorder.stop();
            }
            isRecordingVideo = false;

            btnShutter.style.borderColor = 'white';
            recIndicator.classList.remove('recording');
            recIndicator.textContent = '● MODO VIDEO';
            btnModeToggle.style.opacity = '1';
            btnQuality.style.opacity = '1';
        }
    }

    function triggerIOSDownload(fileUrl, filename) {
        const a = document.createElement('a');
        a.href = fileUrl;
        a.download = filename;
        a.setAttribute('target', '_blank');
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
