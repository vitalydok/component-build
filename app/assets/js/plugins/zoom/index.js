/**
 * Плагин для зума изображений в галерее GalleryDok
 */
class ZoomPlugin {
    constructor(gallery, options = {}) {
        this.gallery = gallery;
        this.defaults = {
            maxScale: 3, // Максимальное увеличение
            step: 0.5, // Шаг увеличения/уменьшения при скролле
            animationDuration: 300, // Длительность анимации в мс
        };

        this.settings = { ...this.defaults, ...options };
    }

    init() {
        console.log('Инициализация плагина ZoomPlugin');
        
        return this;
    }
}

// Экспорт плагина
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ZoomPlugin;
} else if (typeof window !== 'undefined') {
    window.GalleryZoomPlugin = ZoomPlugin;
}