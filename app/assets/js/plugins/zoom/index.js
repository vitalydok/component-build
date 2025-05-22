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
        
        // Состояние перетаскивания
        this.isDragging = false;
        this.lastX = 0;
        this.lastY = 0;
        this.translateX = 0;
        this.translateY = 0;
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
        this.bindMouseEvents();
        this.resetZoom();
    }
    
    /**
     * Обработчик закрытия модалки
     */
    onModalClose() {
        console.log('Модалка закрыта, удаляем контролы зума');
        this.isModalOpen = false;
        this.removeZoomControls();
        this.unbindMouseEvents();
        this.resetZoom();
    }
    
    /**
     * Обработчик смены изображения в галерее
     */
    onImageChanged() {
        if (this.isModalOpen) {
            this.resetZoom();
            this.resetPosition();
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
                cursor: grab;
            }
            
            .gallery-image.dragging {
                cursor: grabbing;
                transition: none;
            }
        `;
        document.head.appendChild(style);
        this.stylesAdded = true;
    }
    
    /**
     * Привязывает события мыши для перетаскивания
     */
    bindMouseEvents() {
        const image = this.getCurrentImage();
        if (!image) return;
        
        // Отключаем стандартное перетаскивание изображения
        image.draggable = false;
        
        image.addEventListener('mousedown', this.onMouseDown.bind(this));
        document.addEventListener('mousemove', this.onMouseMove.bind(this));
        document.addEventListener('mouseup', this.onMouseUp.bind(this));
        
        // Запрещаем выделение текста при перетаскивании
        image.addEventListener('selectstart', (e) => e.preventDefault());
    }
    
    /**
     * Отвязывает события мыши
     */
    unbindMouseEvents() {
        const image = this.getCurrentImage();
        if (image) {
            image.removeEventListener('mousedown', this.onMouseDown.bind(this));
            image.classList.remove('dragging');
        }
        
        document.removeEventListener('mousemove', this.onMouseMove.bind(this));
        document.removeEventListener('mouseup', this.onMouseUp.bind(this));
    }
    
    /**
     * Обработчик нажатия мыши
     */
    onMouseDown(e) {
        // Перетаскивание только если изображение увеличено
        if (this.currentScale <= 1) return;
        
        e.preventDefault();
        this.isDragging = true;
        this.lastX = e.clientX;
        this.lastY = e.clientY;
        
        const image = this.getCurrentImage();
        if (image) {
            image.classList.add('dragging');
        }
    }
    
    /**
     * Обработчик движения мыши
     */
    onMouseMove(e) {
        if (!this.isDragging || this.currentScale <= 1) return;
        
        e.preventDefault();
        
        const deltaX = e.clientX - this.lastX;
        const deltaY = e.clientY - this.lastY;
        
        // Обновляем позицию с учетом ограничений
        this.updatePosition(deltaX, deltaY);
        
        this.lastX = e.clientX;
        this.lastY = e.clientY;
    }
    
    /**
     * Обработчик отпускания мыши
     */
    onMouseUp(e) {
        if (!this.isDragging) return;
        
        this.isDragging = false;
        
        const image = this.getCurrentImage();
        if (image) {
            image.classList.remove('dragging');
        }
    }
    
    /**
     * Обновляет позицию изображения с учетом ограничений
     */
    updatePosition(deltaX, deltaY) {
        const image = this.getCurrentImage();
        const container = document.querySelector('.gallery-content');
        if (!image || !container) return;
        
        // Вычисляем новую позицию
        const newTranslateX = this.translateX + deltaX;
        const newTranslateY = this.translateY + deltaY;
        
        // Получаем размеры контейнера
        const containerRect = container.getBoundingClientRect();
        
        // Получаем computed style для получения реальных размеров изображения
        const computedStyle = window.getComputedStyle(image);
        const imageWidth = parseFloat(computedStyle.width);
        const imageHeight = parseFloat(computedStyle.height);
        
        // Вычисляем размеры увеличенного изображения
        const scaledWidth = imageWidth * this.currentScale;
        const scaledHeight = imageHeight * this.currentScale;
        
        // Вычисляем максимальные смещения
        const maxTranslateX = Math.max(0, (scaledWidth - containerRect.width) / 2);
        const maxTranslateY = Math.max(0, (scaledHeight - containerRect.height) / 2);
        
        // Ограничиваем смещение
        this.translateX = Math.max(-maxTranslateX, Math.min(maxTranslateX, newTranslateX));
        this.translateY = Math.max(-maxTranslateY, Math.min(maxTranslateY, newTranslateY));
        
        console.log('Position update:', {
            scale: this.currentScale,
            translateX: this.translateX,
            translateY: this.translateY,
            maxTranslateX,
            maxTranslateY,
            scaledWidth,
            scaledHeight,
            containerWidth: containerRect.width,
            containerHeight: containerRect.height
        });
        
        // Применяем трансформацию
        this.applyTransform();
    }
    
    /**
     * Применяет трансформацию (масштаб + позицию) к изображению
     */
    applyTransform() {
        const image = this.getCurrentImage();
        if (!image) return;
        
        // Применяем трансформацию: translate потом scale для правильного позиционирования
        image.style.transform = `translate(${this.translateX}px, ${this.translateY}px) scale(${this.currentScale})`;
        image.style.transformOrigin = 'center center';
        
        if (!this.isDragging) {
            image.style.transition = `transform ${this.settings.animationDuration}ms ease`;
        } else {
            image.style.transition = 'none';
        }
    }
    
    /**
     * Сбрасывает позицию изображения
     */
    resetPosition() {
        this.translateX = 0;
        this.translateY = 0;
        this.applyTransform();
    }
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
            this.applyTransform();
        }
        this.updateControls();
    }
    
    /**
     * Уменьшает изображение
     */
    zoomOut() {
        if (this.currentScale > this.settings.minScale) {
            this.currentScale -= this.settings.step;
            // При уменьшении корректируем позицию
            this.adjustPositionAfterZoom();
            this.applyTransform();
        }
        this.updateControls();
    }
    
    /**
     * Сбрасывает зум до исходного размера
     */
    resetZoom() {
        this.currentScale = 1;
        this.resetPosition();
        this.updateControls();
    }
    
    /**
     * Корректирует позицию после изменения масштаба
     */
    adjustPositionAfterZoom() {
        const image = this.getCurrentImage();
        const container = document.querySelector('.gallery-content');
        if (!image || !container) return;
        
        // Если изображение стало меньше или равно оригинальному размеру, центрируем его
        if (this.currentScale <= 1) {
            this.resetPosition();
            return;
        }
        
        // Получаем размеры контейнера
        const containerRect = container.getBoundingClientRect();
        
        // Получаем оригинальные размеры изображения (до масштабирования)
        const imageRect = image.getBoundingClientRect();
        const originalWidth = imageRect.width / this.currentScale;
        const originalHeight = imageRect.height / this.currentScale;
        
        // Вычисляем размеры для нового масштаба
        const newScaledWidth = originalWidth * this.currentScale;
        const newScaledHeight = originalHeight * this.currentScale;
        
        // Вычисляем новые максимальные смещения
        const maxTranslateX = Math.max(0, (newScaledWidth - containerRect.width) / 2);
        const maxTranslateY = Math.max(0, (newScaledHeight - containerRect.height) / 2);
        
        // Ограничиваем текущую позицию новыми пределами
        this.translateX = Math.max(-maxTranslateX, Math.min(maxTranslateX, this.translateX));
        this.translateY = Math.max(-maxTranslateY, Math.min(maxTranslateY, this.translateY));
    }
    
    /**
     * Применяет текущий масштаб к изображению
     */
    applyZoom() {
        // Заменено на applyTransform() для совместимости с перетаскиванием
        this.applyTransform();
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
        this.unbindMouseEvents();
        
        const image = this.getCurrentImage();
        if (image) {
            image.style.transform = '';
            image.style.transformOrigin = '';
            image.style.transition = '';
            image.classList.remove('dragging');
        }
        
        // Отключаем observer
        if (this.observer) {
            this.observer.disconnect();
        }
        
        this.isModalOpen = false;
        this.resetPosition();
    }
}

// Экспорт плагина
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ZoomPlugin;
} else if (typeof window !== 'undefined') {
    window.PicturaZoomPlugin = ZoomPlugin;
}