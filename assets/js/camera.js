document.addEventListener('DOMContentLoaded', () => {
    const videoSource = document.getElementById('camera-source');
    const canvasVertical = document.getElementById('canvas-vertical');
    const canvasHorizontal = document.getElementById('canvas-horizontal');
    const btnShutter = document.getElementById('btn-shutter');
    const btnModeToggle = document.getElementById('btn-mode-toggle');
    const btnQuality = document.getElementById('btn-quality');
    const recIndicator = document.getElementById('rec-indicator');
    const galleryPreview = document.getElementById('gallery-trigger');

    const btnSettingsToggle = document.getElementById('btn-settings-toggle');
    const settingsModal = document.getElementById('settings-modal');
    const btnCloseSettings = document.getElementById('btn-close-settings');
    const chkGrid = document.getElementById('chk-grid');
    const chkMirror = document.getElementById('chk-mirror');

    setupGridOverlays();

    const ctxVertical = canvasVertical.getContext('2d', { alpha: false });
    const ctxHorizontal = canvasHorizontal.getContext('2d', { alpha: false });

    let currentFacingMode = 'user';
    let currentStream = null;
    let currentMode = 'FOTO';
    let masterMediaRecorder = null;
    let recordedChunks = [];
    let isRecordingVideo = false;
    let animationFrameId = null;

    // Perfiles seguros compatibles con navegadores móviles
    const videoQualities = [
        { label: 'HD · 30', width: 1280, height: 720, frameRate: 30 },
        { label: 'FHD · 30', width: 1920, height: 1080, frameRate: 30 }
    ];
    let currentQualityIndex = 0;

    btnSettingsToggle.addEventListener('click', () => {
        if (isRecordingVideo) return;
        settingsModal.classList.remove('hidden');
    });

    btnCloseSettings.addEventListener('click', () => {
        settingsModal.classList.add('hidden');
    });

    chkGrid.addEventListener('change', (e) => {
        document.querySelectorAll('.grid-overlay').forEach(g => {
            g.classList.toggle('hidden', !e.target.checked);
        });
    });

    function setupGridOverlays() {
        document.querySelectorAll('.feed-container').forEach(container => {
            if (!container.querySelector('.grid-overlay')) {
                const grid = document.createElement('div');
                grid.className = 'grid-overlay';
                grid.innerHTML = `
                    <div class="grid-line-v"></div><div class="grid-line-v"></div><div class="grid-line-v"></div>
                    <div class="grid-line-h"></div><div class="grid-line-h"></div><div class="grid-line-h"></div>
                `;
                container.appendChild(grid);
            }
        });
    }

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
                audio: { echoCancellation: true, noiseSuppression: true }
            };

            currentStream = await navigator.mediaDevices.getUserMedia(constraints);
            videoSource.srcObject = currentStream;
            
            await videoSource.play().catch(e => console.warn("Error en play automático:", e));
            
            if (animationFrameId) cancelAnimationFrame(animationFrameId);
            renderSimultaneousFeeds();

        } catch (error) {
            console.warn('Fallback a restricciones genéricas de cámara', error);
            try {
                currentStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
                videoSource.srcObject = currentStream;
                await videoSource.play();
                if (animationFrameId) cancelAnimationFrame(animationFrameId);
                renderSimultaneousFeeds();
            } catch (err) {
                alert('No se pudo acceder a la cámara. Revisa los permisos de tu navegador.');
            }
        }
    }

    function drawPerfectProportions(video, ctx, canvas, targetAspect, isMirrored) {
        const vW = video.videoWidth;
        const vH = video.videoHeight;
        const cW = canvas.width;
        const cH = canvas.height;

        ctx.save();
        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, cW, cH);

        if (!vW || !vH) {
            ctx.restore();
            return;
        }

        if (isMirrored && currentFacingMode === 'user') {
            ctx.translate(cW, 0);
            ctx.scale(-1, 1);
        }

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
        ctx.restore();
    }

    function renderSimultaneousFeeds() {
        if (!videoSource.paused && !videoSource.ended && videoSource.videoWidth > 0) {
            canvasVertical.width = 1080;
            canvasVertical.height = 1920;

            canvasHorizontal.width = 1920;
            canvasHorizontal.height = 1080;

            const isMirrored = chkMirror.checked;

            drawPerfectProportions(videoSource, ctxVertical, canvasVertical, 9 / 16, isMirrored);
            drawPerfectProportions(videoSource, ctxHorizontal, canvasHorizontal, 16 / 9, isMirrored);
        }
        animationFrameId = requestAnimationFrame(renderSimultaneousFeeds);
    }

    btnQuality.addEventListener('click', () => {
        if (isRecordingVideo) return;
        currentQualityIndex = (currentQualityIndex + 1) % videoQualities.length;
        const activeQ = videoQualities[currentQualityIndex];
        btnQuality.textContent = activeQ.label;
        startCamera(currentFacingMode, activeQ);
    });

    btnModeToggle.addEventListener('click', () => {
        if (isRecordingVideo) return;

        if (currentMode === 'FOTO') {
            currentMode = 'VIDEO';
            btnModeToggle.textContent = 'FOTO';
            btnShutter.classList.add('recording-mode');
            recIndicator.textContent = 'VIDEO';
        } else {
            currentMode = 'FOTO';
            btnModeToggle.textContent = 'VIDEO';
            btnShutter.classList.remove('recording-mode');
            recIndicator.textContent = 'DUAL LIVE';
        }
    });

    btnShutter.addEventListener('click', () => {
        if (currentMode === 'FOTO') {
            takeTwoPhotosAndSendToGallery();
        } else {
            toggleUnifiedVideoRecording();
        }
    });

    function takeTwoPhotosAndSendToGallery() {
        triggerFlashEffect();
        const timestamp = Date.now();

        canvasVertical.toBlob((blobV) => {
            const fileV = new File([blobV], `DualCam_V_${timestamp}.jpg`, { type: 'image/jpeg' });

            canvasHorizontal.toBlob(async (blobH) => {
                const fileH = new File([blobH], `DualCam_H_${timestamp}.jpg`, { type: 'image/jpeg' });

                if (navigator.canShare && navigator.canShare({ files: [fileV, fileH] })) {
                    try {
                        await navigator.share({
                            files: [fileV, fileH],
                            title: 'Capturas DualCam',
                            text: 'Fotos vertical y horizontal'
                        });
                        galleryPreview.innerHTML = '✅';
                        setTimeout(() => { galleryPreview.innerHTML = '📥'; }, 2000);
                        return;
                    } catch (err) {
                        if (err.name !== 'AbortError') console.log('Share cancelado');
                    }
                }

                triggerIOSDownload(URL.createObjectURL(blobV), `DualCam_V_${timestamp}.jpg`);
                setTimeout(() => {
                    triggerIOSDownload(URL.createObjectURL(blobH), `DualCam_H_${timestamp}.jpg`);
                }, 400);

                galleryPreview.innerHTML = '✅';
                setTimeout(() => { galleryPreview.innerHTML = '📥'; }, 2000);
            }, 'image/jpeg', 0.95);
        }, 'image/jpeg', 0.95);
    }

    function toggleUnifiedVideoRecording() {
        if (!isRecordingVideo) {
            recordedChunks = [];

            const masterCanvas = document.createElement('canvas');
            masterCanvas.width = 1920;
            masterCanvas.height = 3000;
            const mCtx = masterCanvas.getContext('2d', { alpha: false });

            let recInterval;

            function drawMasterFrame() {
                if (isRecordingVideo) {
                    mCtx.fillStyle = '#000000';
                    mCtx.fillRect(0, 0, masterCanvas.width, masterCanvas.height);
                    mCtx.drawImage(canvasVertical, (1920 - 1080) / 2, 0, 1080, 1920);
                    mCtx.drawImage(canvasHorizontal, 0, 1940, 1920, 1080);
                    recInterval = requestAnimationFrame(drawMasterFrame);
                }
            }

            drawMasterFrame();

            const masterStream = masterCanvas.captureStream(30);
            const audioTracks = currentStream.getAudioTracks();
            if (audioTracks.length > 0) {
                masterStream.addTrack(audioTracks[0]);
            }

            let options = { mimeType: 'video/mp4' };
            if (!MediaRecorder.isTypeSupported(options.mimeType)) {
                options = { mimeType: 'video/webm' };
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
                cancelAnimationFrame(recInterval);
                const blob = new Blob(recordedChunks, { type: masterMediaRecorder.mimeType || 'video/mp4' });
                const file = new File([blob], `DualCam_Video_${timestamp}.mp4`, { type: blob.type });

                if (navigator.canShare && navigator.canShare({ files: [file] })) {
                    try {
                        await navigator.share({
                            files: [file],
                            title: 'Video DualCam',
                            text: 'Grabación dual'
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

            masterMediaRecorder.start(200);
            isRecordingVideo = true;

            btnShutter.style.borderColor = '#ff3b30';
            recIndicator.classList.add('recording');
            recIndicator.textContent = 'GRABANDO';
            btnModeToggle.style.opacity = '0.3';
            btnQuality.style.opacity = '0.3';
            btnSettingsToggle.style.opacity = '0.3';

        } else {
            if (masterMediaRecorder && masterMediaRecorder.state !== 'inactive') {
                masterMediaRecorder.stop();
            }
            isRecordingVideo = false;

            btnShutter.style.borderColor = 'white';
            recIndicator.classList.remove('recording');
            recIndicator.textContent = 'VIDEO';
            btnModeToggle.style.opacity = '1';
            btnQuality.style.opacity = '1';
            btnSettingsToggle.style.opacity = '1';
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
