/**
 * Плагин для зума изображений в галерее Pictura.js
 */
class ZoomPlugin {
    constructor(gallery, options = {}) {
        this.gallery = gallery;
        this.defaults = {
            maxScale: 3, // Максимальное увеличение
            minScale: 1, // Минимальное увеличение
            step: 0.5, // Шаг увеличения/уменьшения
            animationDuration: 300, // Длительность анимации в мс
        };
        this.settings = { ...this.defaults, ...options };
        
        // Состояние зума
        this.currentScale = 1;
        this.zoomControls = null;
        this.isModalOpen = false;
        this.stylesAdded = false;
    }
    
    init() {
        console.log('Инициализация плагина ZoomPlugin');
        
        this.addStyles();
        this.bindGalleryEvents();
        
        return this;
    }
    
    /**
     * Привязывает события галереи для отслеживания открытия/закрытия модалки
     */
    bindGalleryEvents() {
        // Слушаем события галереи
        if (this.gallery.on) {
            this.gallery.on('modalOpen', () => this.onModalOpen());
            this.gallery.on('modalClose', () => this.onModalClose());
            this.gallery.on('imageChanged', () => this.onImageChanged());
        } else {
            // Если нет событий галереи, используем MutationObserver для отслеживания появления модалки
            this.observeModalChanges();
        }
    }
    
    /**
     * Отслеживает появление/исчезновение модалки через MutationObserver
     */
    observeModalChanges() {
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                // Отслеживаем изменения классов
                if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
                    const target = mutation.target;
                    if (target.classList.contains('gallery-overlay')) {
                        const isActive = target.classList.contains('active');
                        if (isActive && !this.isModalOpen) {
                            this.onModalOpen();
                        } else if (!isActive && this.isModalOpen) {
                            this.onModalClose();
                        }
                    }
                }
                
                // Отслеживаем добавление/удаление элементов (на случай если модалка создается/удаляется)
                if (mutation.type === 'childList') {
                    const overlay = document.querySelector('.gallery-overlay.active');
                    if (overlay && !this.isModalOpen) {
                        this.onModalOpen();
                    } else if (!overlay && this.isModalOpen) {
                        this.onModalClose();
                    }
                }
            });
        });
        
        observer.observe(document.body, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ['class']
        });
        
        this.observer = observer; // Сохраняем ссылку для возможности отключения
    }
    
    /**
     * Обработчик открытия модалки
     */
    onModalOpen() {
        console.log('Модалка открыта, создаем контролы зума');
        this.isModalOpen = true;
        this.createZoomControls();
        this.resetZoom();
    }
    
    /**
     * Обработчик закрытия модалки
     */
    onModalClose() {
        console.log('Модалка закрыта, удаляем контролы зума');
        this.isModalOpen = false;
        this.removeZoomControls();
        this.resetZoom();
    }
    
    /**
     * Обработчик смены изображения в галерее
     */
    onImageChanged() {
        if (this.isModalOpen) {
            this.resetZoom();
        }
    }
    
    /**
     * Создает элементы управления зумом
     */
    createZoomControls() {
        // Ищем overlay галереи
        const overlay = document.querySelector('.gallery-overlay.active');
        if (!overlay) return;
        
        // Создаем контейнер для кнопок управления
        this.zoomControls = document.createElement('div');
        this.zoomControls.className = 'pictura-zoom-controls';
        this.zoomControls.innerHTML = `
            <button class="pictura-zoom-in" title="Увеличить">+</button>
            <button class="pictura-zoom-out" title="Уменьшить">−</button>
            <button class="pictura-zoom-reset" title="Сбросить">⌂</button>
        `;
        
        // Добавляем контролы в overlay галереи
        overlay.appendChild(this.zoomControls);
        
        // Привязываем события к кнопкам
        this.bindControlEvents();
        this.updateControls();
    }
    
    /**
     * Удаляет контролы зума
     */
    removeZoomControls() {
        if (this.zoomControls) {
            this.zoomControls.remove();
            this.zoomControls = null;
        }
    }
    
    /**
     * Добавляет CSS стили для контролов
     */
    addStyles() {
        if (this.stylesAdded) return;
        
        const style = document.createElement('style');
        style.textContent = `
            .pictura-zoom-controls {
                position: absolute;
                top: 20px;
                right: 70px;
                display: flex;
                flex-direction: row;
                gap: 5px;
                z-index: 10001;
            }
            
            .pictura-zoom-controls button {
                width: 40px;
                height: 40px;
                background: rgba(0, 0, 0, 0.7);
                color: white;
                border: none;
                border-radius: 50%;
                font-size: 18px;
                font-weight: bold;
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: center;
                transition: background-color 0.2s;
            }
            
            .pictura-zoom-controls button:hover {
                background: rgba(0, 0, 0, 0.9);
            }
            
            .pictura-zoom-controls button:disabled {
                opacity: 0.5;
                cursor: not-allowed;
            }
            
            .gallery-content {
                overflow: hidden;
            }
            
            .gallery-image {
                transition: transform 0.3s ease;
                transform-origin: center center;
            }
        `;
        document.head.appendChild(style);
        this.stylesAdded = true;
    }
    
    /**
     * Привязывает события к кнопкам
     */
    bindControlEvents() {
        if (!this.zoomControls) return;
        
        const zoomInBtn = this.zoomControls.querySelector('.pictura-zoom-in');
        const zoomOutBtn = this.zoomControls.querySelector('.pictura-zoom-out');
        const zoomResetBtn = this.zoomControls.querySelector('.pictura-zoom-reset');
        
        zoomInBtn.addEventListener('click', () => this.zoomIn());
        zoomOutBtn.addEventListener('click', () => this.zoomOut());
        zoomResetBtn.addEventListener('click', () => this.resetZoom());
    }
    
    /**
     * Получает текущее изображение в галерее
     */
    getCurrentImage() {
        return document.querySelector('.gallery-overlay.active .gallery-image');
    }
    
    /**
     * Увеличивает изображение
     */
    zoomIn() {
        if (this.currentScale < this.settings.maxScale) {
            this.currentScale += this.settings.step;
            this.applyZoom();
        }
        this.updateControls();
    }
    
    /**
     * Уменьшает изображение
     */
    zoomOut() {
        if (this.currentScale > this.settings.minScale) {
            this.currentScale -= this.settings.step;
            this.applyZoom();
        }
        this.updateControls();
    }
    
    /**
     * Сбрасывает зум до исходного размера
     */
    resetZoom() {
        this.currentScale = 1;
        this.applyZoom();
        this.updateControls();
    }
    
    /**
     * Применяет текущий масштаб к изображению
     */
    applyZoom() {
        const image = this.getCurrentImage();
        if (!image) return;
        
        image.style.transform = `scale(${this.currentScale})`;
        image.style.transformOrigin = 'center center';
        image.style.transition = `transform ${this.settings.animationDuration}ms ease`;
        
        console.log(`Применен зум: ${this.currentScale}x`);
    }
    
    /**
     * Обновляет состояние кнопок управления
     */
    updateControls() {
        if (!this.zoomControls) return;
        
        const zoomInBtn = this.zoomControls.querySelector('.pictura-zoom-in');
        const zoomOutBtn = this.zoomControls.querySelector('.pictura-zoom-out');
        
        // Отключаем кнопку + при максимальном зуме
        zoomInBtn.disabled = this.currentScale >= this.settings.maxScale;
        
        // Отключаем кнопку - при минимальном зуме
        zoomOutBtn.disabled = this.currentScale <= this.settings.minScale;
    }
    
    /**
     * Уничтожает плагин и очищает ресурсы
     */
    destroy() {
        this.removeZoomControls();
        
        const image = this.getCurrentImage();
        if (image) {
            image.style.transform = '';
            image.style.transformOrigin = '';
            image.style.transition = '';
        }
        
        // Отключаем observer
        if (this.observer) {
            this.observer.disconnect();
        }
        
        this.isModalOpen = false;
    }
}

// Экспорт плагина
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ZoomPlugin;
} else if (typeof window !== 'undefined') {
    window.PicturaZoomPlugin = ZoomPlugin;
}