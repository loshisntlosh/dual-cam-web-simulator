document.addEventListener('DOMContentLoaded', () => {
    const videoSource = document.getElementById('camera-source');
    const canvasVertical = document.getElementById('canvas-vertical');
    const canvasHorizontal = document.getElementById('canvas-horizontal');
    const btnSwitch = document.getElementById('btn-switch');
    const btnShutter = document.getElementById('btn-shutter');
    const galleryPreview = document.getElementById('gallery-preview');

    const ctxVertical = canvasVertical.getContext('2d');
    const ctxHorizontal = canvasHorizontal.getContext('2d');

    let currentFacingMode = 'environment'; // Inicia con cámara trasera, cambia a 'user' (frontal)
    let currentStream = null;
    let lastCapturedImage = null;

    // Función para iniciar o cambiar la cámara
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
                audio: false
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
            alert('No se pudo acceder a la cámara. Verifica los permisos.');
        }
    }

    // Bucle para pintar simultáneamente en los canvas vertical y horizontal en tiempo real
    function renderSimultaneousFeeds() {
        if (videoSource.paused || videoSource.ended) return;

        // Configurar resoluciones internas de los canvas
        canvasVertical.width = 300;
        canvasVertical.height = 500;

        canvasHorizontal.width = 600;
        canvasHorizontal.height = 340;

        // 1. Dibujar en formato vertical (recortando el centro del video fuente)
        const vWidth = videoSource.videoWidth;
        const vHeight = videoSource.videoHeight;
        
        // Render Vertical
        ctxVertical.drawImage(videoSource, (vWidth/4), 0, (vWidth/2), vHeight, 0, 0, canvasVertical.width, canvasVertical.height);

        // 2. Dibujar en formato horizontal (al mismo tiempo)
        ctxHorizontal.drawImage(videoSource, 0, 0, vWidth, vHeight, 0, 0, canvasHorizontal.width, canvasHorizontal.height);

        requestAnimationFrame(renderSimultaneousFeeds);
    }

    // Botón para rotar cámara (Trasera <-> Frontal) manteniendo ambos visores activos
    btnSwitch.addEventListener('click', () => {
        currentFacingMode = currentFacingMode === 'environment' ? 'user' : 'environment';
        startCamera(currentFacingMode);
    });

    // Botón Disparador: Toma una foto combinada de ambos formatos y la manda a la galería
    btnShutter.addEventListener('click', () => {
        triggerFlashEffect();

        // Crear un canvas temporal para fusionar ambas vistas en una sola imagen final descargable
        const finalCanvas = document.createElement('canvas');
        finalCanvas.width = 600;
        finalCanvas.height = 900;
        const finalCtx = finalCanvas.getContext('2d');

        // Fondo negro
        finalCtx.fillStyle = '#000000';
        finalCtx.fillRect(0, 0, finalCanvas.width, finalCanvas.height);

        // Dibujar el cuadro vertical arriba y el horizontal abajo
        finalCtx.drawImage(canvasVertical, 150, 40, 300, 500);
        finalCtx.drawImage(canvasHorizontal, 0, 560, 600, 320);

        // Convertir a imagen descargable (simulando envío a galería)
        lastCapturedImage = finalCanvas.toDataURL('image/jpeg', 0.9);

        // Actualizar miniatura de galería en pantalla
        galleryPreview.innerHTML = `<img src="${lastCapturedImage}" alt="Captura">`;

        // Descarga automática al dispositivo / galería
        const link = document.createElement('a');
        link.href = lastCapturedImage;
        link.download = `DualCam_${Date.now()}.jpg`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        console.log('[Gallery] Foto dual guardada y enviada a galería.');
    });

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

    // Inicializar app de cámara
    startCamera(currentFacingMode);
});
