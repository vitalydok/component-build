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

        // Создание прототипа changeMedia из базы, для отслеживания смены слайда
        if (this.gallery && typeof this.gallery.changeMedia === 'function') {
            const originalChangeMedia = this.gallery.changeMedia.bind(this.gallery);

            this.gallery.changeMedia = (...args) => {
                const result = originalChangeMedia(...args);

                // Вызов Zoom-поведения после смены медиа
                this.onImageChanged();

                return result;
            };
        }

        
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
            <button class="pictura-zoom-reset" title="Сбросить">↻</button>
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
     * Вычисляет реальные размеры отображаемого изображения с учетом object-fit: contain
     */
    getDisplayedImageSize(image, container) {
        const containerRect = container.getBoundingClientRect();
        const naturalWidth = image.naturalWidth || image.width;
        const naturalHeight = image.naturalHeight || image.height;
        
        if (!naturalWidth || !naturalHeight) {
            return {
                width: containerRect.width,
                height: containerRect.height,
                offsetX: 0,
                offsetY: 0
            };
        }
        
        // Вычисляем соотношения сторон
        const containerAspect = containerRect.width / containerRect.height;
        const imageAspect = naturalWidth / naturalHeight;
        
        let displayWidth, displayHeight, offsetX = 0, offsetY = 0;
        
        // Определяем как изображение вписывается в контейнер (object-fit: contain)
        if (imageAspect > containerAspect) {
            // Изображение шире относительно контейнера - ограничиваем по ширине
            displayWidth = containerRect.width;
            displayHeight = containerRect.width / imageAspect;
            offsetY = (containerRect.height - displayHeight) / 2;
        } else {
            // Изображение выше относительно контейнера - ограничиваем по высоте
            displayHeight = containerRect.height;
            displayWidth = containerRect.height * imageAspect;
            offsetX = (containerRect.width - displayWidth) / 2;
        }
        return {
            width: displayWidth,
            height: displayHeight,
            offsetX: offsetX,
            offsetY: offsetY
        };
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
        
        // Получаем реальные отображаемые размеры изображения
        const displayedSize = this.getDisplayedImageSize(image, container);
        
        // Вычисляем размеры увеличенного изображения
        const scaledWidth = displayedSize.width * this.currentScale;
        const scaledHeight = displayedSize.height * this.currentScale;
        
        // Вычисляем границы перетаскивания
        // Логика: увеличенное изображение не должно выходить за границы контейнера
        let maxTranslateX = 0;
        let maxTranslateY = 0;
        
        if (scaledWidth > containerRect.width) {
            // Если увеличенное изображение шире контейнера
            maxTranslateX = (scaledWidth - containerRect.width) / 2;
        }
        
        if (scaledHeight > containerRect.height) {
            // Если увеличенное изображение выше контейнера
            maxTranslateY = (scaledHeight - containerRect.height) / 2;
        }
        
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
            displayedWidth: displayedSize.width,
            displayedHeight: displayedSize.height,
            containerWidth: containerRect.width,
            containerHeight: containerRect.height,
            imageOffsetX: displayedSize.offsetX,
            imageOffsetY: displayedSize.offsetY
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
            this.setContainerZoomMode(this.isZoomActive());
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
            this.setContainerZoomMode(this.isZoomActive());
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
        this.setContainerZoomMode(false);
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
        
        // Получаем реальные отображаемые размеры изображения
        const displayedSize = this.getDisplayedImageSize(image, container);
        
        // Вычисляем размеры для нового масштаба
        const newScaledWidth = displayedSize.width * this.currentScale;
        const newScaledHeight = displayedSize.height * this.currentScale;
        
        // Вычисляем новые максимальные смещения относительно контейнера
        const maxTranslateX = Math.max(0, (newScaledWidth - containerRect.width) / 2);
        const maxTranslateY = Math.max(0, (newScaledHeight - containerRect.height) / 2);
        
        // Ограничиваем текущую позицию новыми пределами
        this.translateX = Math.max(-maxTranslateX, Math.min(maxTranslateX, this.translateX));
        this.translateY = Math.max(-maxTranslateY, Math.min(maxTranslateY, this.translateY));
    }



    /**
     * Устанавливает режим контейнера для зума с плавной анимацией
     */
    setContainerZoomMode(isZoomed) {
        const container = document.querySelector('.gallery-content');
        if (!container) return;
        
        // Добавляем CSS transition для плавной анимации
        container.style.transition = `width ${this.settings.animationDuration}ms ease, height ${this.settings.animationDuration}ms ease`;
        
        if (isZoomed) {
            // Активируем режим зума - контейнер расширяется для удобного перетаскивания
            container.style.width = '100%';
            container.style.height = '100%';
        } else {
            // Отключаем режим зума - устанавливаем размер точно под текущее изображение
            const imageSize = this.getCurrentImageDisplaySize();
            container.style.width = `${imageSize.width}px`;
            container.style.height = `${imageSize.height}px`;
        }
        
        // Убираем transition через некоторое время чтобы не мешать при перетаскивании
        setTimeout(() => {
            if (container.style.transition) {
                container.style.transition = '';
            }
        }, this.settings.animationDuration + 50);
    }

    /**
     * Получает отображаемый размер текущего изображения в реальном времени
     */
    getCurrentImageDisplaySize() {
        const image = this.getCurrentImage();
        const container = document.querySelector('.gallery-content');
        
        if (!image) return; // fallback
        
        // Если изображение еще не загрузилось, ждем загрузки
        if (!image.naturalWidth || !image.naturalHeight) {
            return new Promise((resolve) => {
                const checkLoad = () => {
                    if (image.naturalWidth && image.naturalHeight) {
                        resolve(this.calculateImageSize(image));
                    } else {
                        setTimeout(checkLoad, 50);
                    }
                };
                checkLoad();
            });
        }
        
        return this.calculateImageSize(image);
    }

    /**
     * Вычисляет размер изображения с учетом доступного пространства
     */
    calculateImageSize(image) {
        const clientWidth = image.clientWidth;
        const clientHeight = image.clientHeight;
        
        if (!clientWidth || !clientHeight) {
            return { width: 400, height: 300 }; // fallback
        }
        
        // Получаем максимально доступное пространство
        const overlay = document.querySelector('.gallery-overlay.active');
        if (!overlay) {
            return { width: clientWidth, height: clientHeight };
        }
        
        const overlayRect = overlay.getBoundingClientRect();
        const maxWidth = overlayRect.width - 80; // отступы для контролов и границ
        const maxHeight = overlayRect.height - 80;
        
        // Вычисляем соотношения сторон
        const imageAspect = clientWidth / clientHeight;
        const maxAspect = maxWidth / maxHeight;
        
        let displayWidth, displayHeight;
        
        // Определяем как изображение вписывается (object-fit: contain)
        if (imageAspect > maxAspect) {
            // Изображение шире - ограничиваем по ширине
            displayWidth = Math.min(maxWidth, clientWidth);
            displayHeight = displayWidth / imageAspect;
        } else {
            // Изображение выше - ограничиваем по высоте
            displayHeight = Math.min(maxHeight, naturalHeight);
            displayWidth = displayHeight * imageAspect;
        }
        
        return {
            width: Math.round(displayWidth),
            height: Math.round(displayHeight)
        };
    }

    /**
     * Проверяет, активен ли режим зума
     */
    isZoomActive() {
        return this.currentScale > 1;
    }
    
    /**
     * Добавим метод для зума с центрированием по курсору (опционально)
     */
    zoomToPoint(scale, clientX, clientY) {
        const image = this.getCurrentImage();
        const container = document.querySelector('.gallery-content');
        if (!image || !container) return;
        
        const containerRect = container.getBoundingClientRect();
        
        // Вычисляем позицию курсора относительно центра контейнера
        const cursorX = clientX - containerRect.left - containerRect.width / 2;
        const cursorY = clientY - containerRect.top - containerRect.height / 2;
        
        // Вычисляем новую позицию с учетом точки зума
        const scaleRatio = scale / this.currentScale;
        this.translateX = cursorX - (cursorX - this.translateX) * scaleRatio;
        this.translateY = cursorY - (cursorY - this.translateY) * scaleRatio;
        
        this.currentScale = Math.max(this.settings.minScale, Math.min(this.settings.maxScale, scale));
        
        // Устанавливаем режим контейнера
        this.setContainerZoomMode(this.isZoomActive());
        
        // Корректируем позицию после зума
        this.adjustPositionAfterZoom();
        this.applyTransform();
        this.updateControls();
    }
    
    /**
     * Обновляет размер контейнера для текущего изображения (асинхронно)
     */
    async updateContainerForCurrentImage() {
        if (!this.isModalOpen || this.isZoomActive()) return;
        
        const imageSize = await this.getCurrentImageDisplaySize();
        const container = document.querySelector('.gallery-content');
        
        if (container && imageSize) {
            container.style.transition = `width ${this.settings.animationDuration}ms ease, height ${this.settings.animationDuration}ms ease`;
            container.style.width = `${imageSize.width}px`;
            container.style.height = `${imageSize.height}px`;
            
            setTimeout(() => {
                if (container.style.transition) {
                    container.style.transition = '';
                }
            }, this.settings.animationDuration + 50);
        }
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