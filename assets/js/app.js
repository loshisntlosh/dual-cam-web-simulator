document.addEventListener('DOMContentLoaded', () => {
    // Referencias a elementos de la UI
    const btnQuality = document.getElementById('btn-quality');
    const btnSwitch = document.getElementById('btn-switch');
    const btnShutter = document.getElementById('btn-shutter');
    const galleryTrigger = document.getElementById('gallery-trigger');

    // Estados de la app
    let qualityState = 'HD / 1080p';
    let isRecording = false;

    // 1. Botón de Calidad
    btnQuality.addEventListener('click', () => {
        if (qualityState === 'HD / 1080p') {
            qualityState = '4K / 60FPS';
            btnQuality.style.borderColor = '#ffcc00';
            btnQuality.style.color = '#ffcc00';
        } else {
            qualityState = 'HD / 1080p';
            btnQuality.style.borderColor = 'transparent';
            btnQuality.style.color = '#ffffff';
        }
        btnQuality.textContent = qualityState;
        console.log(`[UI] Calidad cambiada a: ${qualityState}`);
    });

    // 2. Botón de Cambio de Cámaras (Intercambiar PiP con Principal)
    btnSwitch.addEventListener('click', () => {
        const primaryFeed = document.querySelector('.primary-feed video');
        const secondaryFeed = document.querySelector('.secondary-feed video');
        
        // Intercambiar fuentes de video si están activas
        // (Esto se enlazará con las cámaras reales en la Fase 4)
        console.log('[UI] Intercambiando posición de cámaras...');
    });

    // 3. Botón Disparador (Shutter)
    btnShutter.addEventListener('click', () => {
        // Efecto visual de flash rápido en pantalla
        triggerFlashEffect();
        console.log(`[UI] ¡Captura realizada en modo ${qualityState}!`);
    });

    // 4. Galería simulada
    galleryTrigger.addEventListener('click', () => {
        alert('Abriendo galería simulada de capturas duales...');
    });

    // Función auxiliar para efecto de flash fotográfico
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
});
