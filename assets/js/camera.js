document.addEventListener('DOMContentLoaded', async () => {
    const videoPrimary = document.getElementById('video-primary');
    const videoSecondary = document.getElementById('video-secondary');

    try {
        // Solicitar acceso a las cámaras del dispositivo (PC o iPhone)
        // Intentamos abrir la cámara trasera/principal para el feed principal
        const primaryStream = await navigator.mediaDevices.getUserMedia({
            video: { 
                facingMode: 'environment', // 'user' para frontal, 'environment' para trasera
                width: { ideal: 1920 },
                height: { ideal: 1080 }
            },
            audio: false
        });
        videoPrimary.srcObject = primaryStream;
        console.log('[Camera] Cámara principal iniciada correctamente.');

        // Intentar abrir la cámara frontal para el feed secundario (PiP)
        const secondaryStream = await navigator.mediaDevices.getUserMedia({
            video: { 
                facingMode: 'user',
                width: { ideal: 640 },
                height: { ideal: 480 }
            },
            audio: false
        });
        videoSecondary.srcObject = secondaryStream;
        console.log('[Camera] Cámara secundaria (selfie) iniciada correctamente.');

    } catch (error) {
        console.warn('[Camera] No se pudieron abrir ambas cámaras simultáneamente en este navegador:', error);
        
        // Plan de respaldo (Fallback): Si el navegador bloquea el doble flujo, 
        // usamos la misma cámara para ambos visores para que la interfaz no se rompa visualmente.
        try {
            const fallbackStream = await navigator.mediaDevices.getUserMedia({
                video: true,
                audio: false
            });
            videoPrimary.srcObject = fallbackStream;
            videoSecondary.srcObject = fallbackStream;
            console.log('[Camera] Modo de respaldo activado: Usando stream unificado.');
        } catch (fallbackError) {
            alert('No se pudo acceder a la cámara. Por favor, asegúrate de dar permisos en tu navegador.');
            console.error('[Camera] Error crítico de permisos:', fallbackError);
        }
    }
});
