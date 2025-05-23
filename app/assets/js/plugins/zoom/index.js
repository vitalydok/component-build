/**
 * Упрощенный плагин для зума изображений в галерее Pictura.js
 * Позволяет увеличивать/уменьшать изображения, перетаскивать увеличенные изображения
 * и отображает предпросмотр области зума.
 */
class ZoomPlugin {
    /**
     * Конструктор плагина
     * @param {Object} gallery - Экземпляр галереи Pictura.js
     * @param {Object} options - Настройки плагина
     */
    constructor(gallery, options = {}) {
        // Ссылка на галерею
        this.gallery = gallery;
        
        // Настройки плагина с значениями по умолчанию
        this.settings = {
            maxScale: 3,          // Максимальный масштаб
            minScale: 1,          // Минимальный масштаб
            step: 0.5,            // Шаг изменения масштаба
            animationDuration: 300, // Длительность анимации
            showZoomPreview: true, // Показывать превью зума
            previewSize: 100,     // Размер превью зума
            enableMouseZoom: true, // Включить зум по клику мыши
            ...options            // Переопределение настроек пользователем
        };
        
        // Состояние плагина
        this.currentScale = 1;    // Текущий масштаб
        this.translateX = 0;       // Смещение по X
        this.translateY = 0;       // Смещение по Y
        this.isDragging = false;   // Флаг перетаскивания изображения
        this.dragStarted = false;  // Флаг начала перетаскивания
        this.lastX = 0;            // Последняя позиция X курсора
        this.lastY = 0;            // Последняя позиция Y курсора
        this.isModalOpen = false;  // Открыто ли модальное окно
        this.previewVisible = false; // Видимость превью зума
        
        // Элементы UI
        this.zoomControls = null; // Элементы управления зумом
        this.zoomPreview = null;   // Элемент превью зума
        
        // Привязка методов к контексту
        this.bindMethods();
    }
    
    /**
     * Привязывает методы класса к контексту
     */
    bindMethods() {
        const methods = [
            'onImageClick', 
            'onImageMouseEnter', 
            'onImageMouseLeave', 
            'onImageMouseMove', 
            'onMouseDown', 
            'onMouseMove', 
            'onMouseUp', 
            'preventSelect'
        ];
        methods.forEach(method => this[method] = this[method].bind(this));
    }
    
    /**
     * Инициализация плагина
     * @return {Object} Возвращает экземпляр плагина
     */
    init() {
        this.addStyles();          // Добавляет стили
        this.bindGalleryEvents(); // Подписывается на события галереи
        this.wrapGalleryMethods(); // Оборачивает методы галереи
        return this;
    }
    
    /**
     * Подписывается на события галереи
     */
    bindGalleryEvents() {
        if (this.gallery.on) {
            // Если галерея поддерживает события
            this.gallery.on('modalOpen', () => this.onModalOpen());
            this.gallery.on('modalClose', () => this.onModalClose());
            this.gallery.on('imageChanged', () => this.onImageChanged());
        } else {
            // Иначе используем MutationObserver для отслеживания изменений
            this.observeModalChanges();
        }
    }
    
    /**
     * Оборачивает методы галереи для дополнительной логики
     */
    wrapGalleryMethods() {
        if (this.gallery && typeof this.gallery.changeMedia === 'function') {
            const originalChangeMedia = this.gallery.changeMedia.bind(this.gallery);
            this.gallery.changeMedia = (...args) => {
                const result = originalChangeMedia(...args);
                this.onImageChanged(); // Вызываем обработчик смены изображения
                return result;
            };
        }
    }
    
    /**
     * Отслеживает изменения DOM для определения состояния модального окна
     */
    observeModalChanges() {
        const observer = new MutationObserver(() => {
            const overlay = document.querySelector('.gallery-overlay.active');
            const isOpen = !!overlay;
            
            if (isOpen !== this.isModalOpen) {
                isOpen ? this.onModalOpen() : this.onModalClose();
            }
        });
        
        observer.observe(document.body, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ['class']
        });
        
        this.observer = observer;
    }
    
    /**
     * Обработчик открытия модального окна
     */
    onModalOpen() {
        this.isModalOpen = true;
        this.createUI();  // Создает элементы управления
        this.bindEvents(); // Подписывается на события
        this.reset();      // Сбрасывает состояние
    }
    
    /**
     * Обработчик закрытия модального окна
     */
    onModalClose() {
        this.isModalOpen = false;
        this.removeUI();    // Удаляет элементы управления
        this.unbindEvents(); // Отписывается от событий
        this.reset();       // Сбрасывает состояние
    }
    
    /**
     * Обработчик смены изображения
     */
    onImageChanged() {
        if (!this.isModalOpen) return;
        
        const oldSrc = this.getCurrentImage()?.src;
        this.unbindEvents();
        this.reset();
        
        // Ждем загрузки нового изображения
        this.waitForNewImage(oldSrc).then(() => {
            this.bindEvents();
            this.updateContainer();
        });
    }
    
    /**
     * Ожидает загрузки нового изображения
     * @param {String} oldSrc - URL предыдущего изображения
     * @return {Promise} Промис, который разрешится после загрузки нового изображения
     */
    waitForNewImage(oldSrc) {
        return new Promise(resolve => {
            const check = () => {
                const image = this.getCurrentImage();
                if (image?.complete && image.naturalWidth > 0 && image.src !== oldSrc) {
                    image.draggable = false; // Запрещаем перетаскивание
                    resolve();
                } else {
                    setTimeout(check, 50);
                }
            };
            setTimeout(check, 100);
        });
    }
    
    /**
     * Создает элементы управления зумом
     */
    createUI() {
        const overlay = document.querySelector('.gallery-overlay.active');
        if (!overlay) return;
        
        // Создаем кнопки управления зумом
        this.zoomControls = document.createElement('div');
        this.zoomControls.className = 'pictura-zoom-controls';
        this.zoomControls.innerHTML = `
            <button class="pictura-zoom-in" title="Увеличить">+</button>
            <button class="pictura-zoom-out" title="Уменьшить">−</button>
            <button class="pictura-zoom-reset" title="Сбросить">↻</button>
        `;
        overlay.appendChild(this.zoomControls);
        
        // Создаем превью зума, если включено в настройках
        if (this.settings.showZoomPreview && this.settings.enableMouseZoom) {
            this.zoomPreview = document.createElement('div');
            this.zoomPreview.className = 'pictura-zoom-preview';
            this.zoomPreview.style.display = 'none';
            overlay.appendChild(this.zoomPreview);
        }
        
        this.bindControlEvents(); // Подписываемся на события кнопок
        this.updateControls();    // Обновляем состояние кнопок
    }
    
    /**
     * Удаляет элементы управления зумом
     */
    removeUI() {
        this.zoomControls?.remove();
        this.zoomPreview?.remove();
        this.zoomControls = null;
        this.zoomPreview = null;
        this.previewVisible = false;
    }
    
    /**
     * Добавляет стили для плагина
     */
    addStyles() {
        if (document.querySelector('#pictura-zoom-styles')) return;
        
        const style = document.createElement('style');
        style.id = 'pictura-zoom-styles';
        style.textContent = `
            .pictura-zoom-controls {
                position: absolute;
                top: 20px;
                right: 70px;
                display: flex;
                gap: 5px;
                z-index: 10001;
            }
            
            .pictura-zoom-controls button {
                width: 40px;
                height: 40px;
                background: rgba(0,0,0,0.7);
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
            
            .pictura-zoom-controls button:hover { background: rgba(0,0,0,0.9); }
            .pictura-zoom-controls button:disabled { opacity: 0.5; cursor: not-allowed; }
            
            .pictura-zoom-preview {
                position: absolute;
                width: ${this.settings.previewSize}px;
                height: ${this.settings.previewSize}px;
                border: 2px solid rgba(255,255,255,0.8);
                border-radius: 4px;
                box-shadow: 0 0 0 1px rgba(0,0,0,0.3);
                pointer-events: none;
                z-index: 10000;
                background: rgba(255,255,255,0.1);
                backdrop-filter: blur(1px);
                transition: opacity 0.2s ease;
            }
            
            .gallery-content { overflow: hidden; }
            .gallery-image {
                transition: transform 0.3s ease;
                transform-origin: center center;
                cursor: default;
            }
            .gallery-image.dragging { cursor: grabbing !important; transition: none; }
            .gallery-image.zoom-cursor { cursor: zoom-in; }
            .gallery-image.zoom-active { cursor: grab; }
        `;
        document.head.appendChild(style);
    }
    
    /**
     * Подписывается на события изображения
     */
    bindEvents() {
        const image = this.getCurrentImage();
        if (!image) return;
        
        image.draggable = false; // Запрещаем стандартное перетаскивание
        
        // Подписываемся на события в зависимости от настроек
        if (this.settings.enableMouseZoom) {
            image.addEventListener('click', this.onImageClick);
        }
        
        if (this.settings.showZoomPreview) {
            image.addEventListener('mouseenter', this.onImageMouseEnter);
            image.addEventListener('mouseleave', this.onImageMouseLeave);
            image.addEventListener('mousemove', this.onImageMouseMove);
        }
        
        image.addEventListener('mousedown', this.onMouseDown);
        image.addEventListener('selectstart', this.preventSelect);
        
        // Подписываемся на глобальные события мыши
        document.addEventListener('mousemove', this.onMouseMove);
        document.addEventListener('mouseup', this.onMouseUp);
        
        this.updateImageCursor(); // Обновляем курсор
    }
    
    /**
     * Отписывается от событий изображения
     */
    unbindEvents() {
        const image = this.getCurrentImage();
        if (image) {
            // Удаляем все обработчики событий
            ['click', 'mouseenter', 'mouseleave', 'mousemove', 'mousedown', 'selectstart']
                .forEach(event => image.removeEventListener(event, this[`on${event.charAt(0).toUpperCase() + event.slice(1)}`] || this.preventSelect));
            
            // Сбрасываем классы и стили
            image.classList.remove('dragging', 'zoom-cursor', 'zoom-active');
            image.style.transform = '';
            image.style.transformOrigin = '';
            image.style.transition = '';
        }
        
        // Удаляем глобальные обработчики
        document.removeEventListener('mousemove', this.onMouseMove);
        document.removeEventListener('mouseup', this.onMouseUp);
    }
    
    /**
     * Подписывается на события элементов управления
     */
    bindControlEvents() {
        if (!this.zoomControls) return;
        
        // Подписываемся на клики по кнопкам
        this.zoomControls.querySelector('.pictura-zoom-in').addEventListener('click', () => this.zoomIn());
        this.zoomControls.querySelector('.pictura-zoom-out').addEventListener('click', () => this.zoomOut());
        this.zoomControls.querySelector('.pictura-zoom-reset').addEventListener('click', () => this.resetZoom());
    }
    
    // Обработчики событий
    
    /**
     * Обработчик клика по изображению
     * @param {Event} e - Объект события
     */
    onImageClick(e) {
        if (!this.settings.enableMouseZoom || this.dragStarted) return;
        
        e.preventDefault();
        e.stopPropagation();
        
        const newScale = this.currentScale + this.settings.step;
        
        // Увеличиваем или сбрасываем масштаб
        if (newScale <= this.settings.maxScale) {
            this.zoomToPoint(newScale, e.clientX, e.clientY);
        } else if (this.currentScale > this.settings.minScale) {
            this.resetZoom();
        }
    }
    
    /**
     * Обработчик наведения курсора на изображение
     */
    onImageMouseEnter() {
        if (!this.settings.enableMouseZoom || this.currentScale >= this.settings.maxScale) return;
        this.previewVisible = true;
        if (this.zoomPreview) this.zoomPreview.style.display = 'block';
    }
    
    /**
     * Обработчик ухода курсора с изображения
     */
    onImageMouseLeave() {
        this.previewVisible = false;
        if (this.zoomPreview) this.zoomPreview.style.display = 'none';
    }
    
    /**
     * Обработчик перемещения курсора по изображению
     * @param {Event} e - Объект события
     */
    onImageMouseMove(e) {
        if (this.previewVisible && this.zoomPreview && !this.isDragging && this.settings.enableMouseZoom) {
            this.updateZoomPreview(e);
        }
    }
    
    /**
     * Обработчик нажатия кнопки мыши
     * @param {Event} e - Объект события
     */
    onMouseDown(e) {
        if (this.currentScale <= 1) return;
        
        e.preventDefault();
        this.isDragging = true;
        this.dragStarted = false;
        this.lastX = e.clientX;
        this.lastY = e.clientY;
        
        const image = this.getCurrentImage();
        if (image) image.classList.add('dragging');
        if (this.zoomPreview) this.zoomPreview.style.display = 'none';
    }
    
    /**
     * Обработчик перемещения мыши
     * @param {Event} e - Объект события
     */
    onMouseMove(e) {
        if (!this.isDragging || this.currentScale <= 1) return;
        
        e.preventDefault();
        
        // Вычисляем смещение курсора
        const deltaX = e.clientX - this.lastX;
        const deltaY = e.clientY - this.lastY;
        
        // Определяем, началось ли перетаскивание
        if (Math.abs(deltaX) > 2 || Math.abs(deltaY) > 2) {
            this.dragStarted = true;
        }
        
        // Обновляем позицию изображения
        this.updatePosition(deltaX, deltaY);
        this.lastX = e.clientX;
        this.lastY = e.clientY;
    }
    
    /**
     * Обработчик отпускания кнопки мыши
     */
    onMouseUp() {
        if (!this.isDragging) return;
        
        this.isDragging = false;
        const image = this.getCurrentImage();
        if (image) image.classList.remove('dragging');
        
        // Восстанавливаем превью после перетаскивания
        setTimeout(() => {
            if (this.previewVisible && this.zoomPreview && this.currentScale < this.settings.maxScale && this.settings.enableMouseZoom) {
                this.zoomPreview.style.display = 'block';
            }
            setTimeout(() => this.dragStarted = false, 10);
        }, 100);
    }
    
    /**
     * Запрещает выделение текста при перетаскивании
     * @param {Event} e - Объект события
     */
    preventSelect(e) {
        e.preventDefault();
    }
    
    // Утилиты
    
    /**
     * Получает текущее изображение в галерее
     * @return {HTMLElement|null} Элемент изображения или null
     */
    getCurrentImage() {
        const selectors = [
            '.gallery-overlay.active .gallery-image',
            '.gallery-overlay.active img.gallery-image',
            '.gallery-overlay.active img[src]',
            '.gallery-overlay.active .gallery-content img',
            '.gallery-overlay.active img'
        ];
        
        // Поиск изображения по селекторам
        for (const selector of selectors) {
            const image = document.querySelector(selector);
            if (image?.src) return image;
        }
        return null;
    }
    
    /**
     * Вычисляет размеры изображения с учетом контейнера
     * @param {HTMLElement} image - Элемент изображения
     * @param {HTMLElement} container - Контейнер изображения
     * @return {Object} Объект с размерами и смещениями
     */
    getDisplayedImageSize(image, container) {
        const containerRect = container.getBoundingClientRect();
        const imageAspect = image.clientWidth / image.clientHeight;
        const containerAspect = containerRect.width / containerRect.height;
        
        let displayWidth, displayHeight, offsetX = 0, offsetY = 0;
        
        // Вычисляем размеры с учетом пропорций
        if (imageAspect > containerAspect) {
            displayWidth = containerRect.width;
            displayHeight = containerRect.width / imageAspect;
            offsetY = (containerRect.height - displayHeight) / 2;
        } else {
            displayHeight = containerRect.height;
            displayWidth = containerRect.height * imageAspect;
            offsetX = (containerRect.width - displayWidth) / 2;
        }
        
        return { width: displayWidth, height: displayHeight, offsetX, offsetY };
    }
    
    /**
     * Обновляет позицию превью зума
     * @param {Event} e - Объект события мыши
     */
    updateZoomPreview(e) {
        if (!this.zoomPreview || this.currentScale >= this.settings.maxScale) {
            if (this.zoomPreview) this.zoomPreview.style.display = 'none';
            return;
        }
        
        const overlay = document.querySelector('.gallery-overlay.active');
        if (!overlay) return;
        
        // Вычисляем позицию превью с учетом границ
        const overlayRect = overlay.getBoundingClientRect();
        const previewX = Math.max(0, Math.min(overlayRect.width - this.settings.previewSize, 
            e.clientX - overlayRect.left - this.settings.previewSize / 2));
        const previewY = Math.max(0, Math.min(overlayRect.height - this.settings.previewSize, 
            e.clientY - overlayRect.top - this.settings.previewSize / 2));
        
        // Позиционируем превью
        this.zoomPreview.style.left = `${previewX}px`;
        this.zoomPreview.style.top = `${previewY}px`;
        this.zoomPreview.style.display = 'block';
    }
    
    /**
     * Обновляет курсор изображения в зависимости от состояния
     */
    updateImageCursor() {
        const image = this.getCurrentImage();
        if (!image) return;
        
        image.classList.remove('zoom-cursor', 'zoom-active');
        
        // Устанавливаем соответствующий курсор
        if (this.currentScale <= this.settings.minScale && this.settings.enableMouseZoom) {
            image.classList.add('zoom-cursor'); // Курсор "зум"
        } else {
            image.classList.add('zoom-active'); // Курсор "перетаскивание"
        }
    }
    
    /**
     * Обновляет позицию изображения при перетаскивании
     * @param {Number} deltaX - Смещение по X
     * @param {Number} deltaY - Смещение по Y
     */
    updatePosition(deltaX, deltaY) {
        const image = this.getCurrentImage();
        const container = document.querySelector('.gallery-content');
        if (!image || !container) return;
        
        const containerRect = container.getBoundingClientRect();
        const displayedSize = this.getDisplayedImageSize(image, container);
        
        // Вычисляем масштабированные размеры
        const scaledWidth = displayedSize.width * this.currentScale;
        const scaledHeight = displayedSize.height * this.currentScale;
        
        // Вычисляем максимальное смещение
        const maxTranslateX = Math.max(0, (scaledWidth - containerRect.width) / 2);
        const maxTranslateY = Math.max(0, (scaledHeight - containerRect.height) / 2);
        
        // Обновляем позицию с учетом границ
        this.translateX = Math.max(-maxTranslateX, Math.min(maxTranslateX, this.translateX + deltaX));
        this.translateY = Math.max(-maxTranslateY, Math.min(maxTranslateY, this.translateY + deltaY));
        
        this.applyTransform(); // Применяем трансформацию
    }
    
    /**
     * Применяет трансформацию к изображению
     */
    applyTransform() {
        const image = this.getCurrentImage();
        if (!image) return;
        
        // Применяем смещение и масштаб
        image.style.transform = `translate(${this.translateX}px, ${this.translateY}px) scale(${this.currentScale})`;
        image.style.transformOrigin = 'center center';
        // Отключаем анимацию при перетаскивании
        image.style.transition = this.isDragging ? 'none' : `transform ${this.settings.animationDuration}ms ease`;
    }
    
    /**
     * Устанавливает режим контейнера (зум/обычный)
     * @param {Boolean} isZoomed - Флаг увеличенного состояния
     */
    setContainerZoomMode(isZoomed) {
        const container = document.querySelector('.gallery-content');
        if (!container) return;
        
        container.style.transition = `width ${this.settings.animationDuration}ms ease, height ${this.settings.animationDuration}ms ease`;
        
        if (isZoomed) {
            // В режиме зума занимаем всю доступную область
            container.style.width = '100%';
            container.style.height = '100%';
        } else {
            // В обычном режиме - размеры изображения
            const imageSize = this.calculateImageSize();
            container.style.width = `${imageSize.width}px`;
            container.style.height = `${imageSize.height}px`;
        }
        
        // Убираем transition после анимации
        setTimeout(() => container.style.transition = '', this.settings.animationDuration + 50);
    }
    
    /**
     * Вычисляет оптимальный размер изображения для контейнера
     * @return {Object} Объект с шириной и высотой
     */
    calculateImageSize() {
        const image = this.getCurrentImage();
        if (!image?.clientWidth) return { width: 400, height: 300 };
        
        const overlay = document.querySelector('.gallery-overlay.active');
        if (!overlay) return { width: image.clientWidth, height: image.clientHeight };
        
        const overlayRect = overlay.getBoundingClientRect();
        const maxWidth = overlayRect.width - 80; // С отступами
        const maxHeight = overlayRect.height - 80;
        
        const imageAspect = image.clientWidth / image.clientHeight;
        const maxAspect = maxWidth / maxHeight;
        
        let displayWidth, displayHeight;
        
        // Вычисляем размеры с учетом пропорций
        if (imageAspect > maxAspect) {
            displayWidth = Math.min(maxWidth, image.clientWidth);
            displayHeight = displayWidth / imageAspect;
        } else {
            displayHeight = Math.min(maxHeight, image.clientHeight);
            displayWidth = displayHeight * imageAspect;
        }
        
        return { width: Math.round(displayWidth), height: Math.round(displayHeight) };
    }
    
    // Публичные методы управления
    
    /**
     * Увеличивает масштаб
     */
    zoomIn() {
        if (this.currentScale < this.settings.maxScale) {
            this.currentScale += this.settings.step;
            this.setContainerZoomMode(this.currentScale > 1);
            this.applyTransform();
        }
        this.bindEvents();
        this.updateControls();
        this.updateImageCursor();
    }
    
    /**
     * Уменьшает масштаб
     */
    zoomOut() {
        if (this.currentScale > this.settings.minScale) {
            this.currentScale -= this.settings.step;
            this.adjustPositionAfterZoom();
            this.setContainerZoomMode(this.currentScale > 1);
            this.applyTransform();
        }
        this.updateControls();
        this.updateImageCursor();
    }
    
    /**
     * Сбрасывает масштаб и позицию
     */
    resetZoom() {
        this.currentScale = 1;
        this.resetPosition();
        this.setContainerZoomMode(false);
        this.updateControls();
        this.updateImageCursor();
    }
    
    /**
     * Увеличивает изображение к указанной точке
     * @param {Number} scale - Новый масштаб
     * @param {Number} clientX - Координата X курсора
     * @param {Number} clientY - Координата Y курсора
     */
    zoomToPoint(scale, clientX, clientY) {
        const image = this.getCurrentImage();
        const container = document.querySelector('.gallery-content');
        if (!image || !container) return;
        
        const containerRect = container.getBoundingClientRect();
        const displayedSize = this.getDisplayedImageSize(image, container);
        
        // Вычисляем центр изображения
        const imageCenterX = containerRect.left + displayedSize.offsetX + displayedSize.width / 2;
        const imageCenterY = containerRect.top + displayedSize.offsetY + displayedSize.height / 2;
        
        // Вычисляем смещение курсора относительно центра
        const cursorX = clientX - imageCenterX;
        const cursorY = clientY - imageCenterY;
        
        // Вычисляем новое смещение с учетом масштаба
        const scaleRatio = scale / this.currentScale;
        const newTranslateX = cursorX - (cursorX - this.translateX) * scaleRatio;
        const newTranslateY = cursorY - (cursorY - this.translateY) * scaleRatio;
        
        // Устанавливаем новый масштаб с учетом ограничений
        this.currentScale = Math.max(this.settings.minScale, Math.min(this.settings.maxScale, scale));
        
        // Вычисляем масштабированные размеры
        const scaledWidth = displayedSize.width * this.currentScale;
        const scaledHeight = displayedSize.height * this.currentScale;
        
        // Вычисляем максимальное смещение
        const maxTranslateX = Math.max(0, (scaledWidth - containerRect.width) / 2);
        const maxTranslateY = Math.max(0, (scaledHeight - containerRect.height) / 2);
        
        // Устанавливаем новую позицию с учетом границ
        this.translateX = Math.max(-maxTranslateX, Math.min(maxTranslateX, newTranslateX));
        this.translateY = Math.max(-maxTranslateY, Math.min(maxTranslateY, newTranslateY));
        
        this.setContainerZoomMode(this.currentScale > 1);
        this.applyTransform();
        this.updateControls();
        this.updateImageCursor();
    }
    
    /**
     * Корректирует позицию после изменения масштаба
     */
    adjustPositionAfterZoom() {
        if (this.currentScale <= 1) {
            this.resetPosition();
            return;
        }
        
        const image = this.getCurrentImage();
        const container = document.querySelector('.gallery-content');
        if (!image || !container) return;
        
        const containerRect = container.getBoundingClientRect();
        const displayedSize = this.getDisplayedImageSize(image, container);
        
        // Вычисляем новые масштабированные размеры
        const newScaledWidth = displayedSize.width * this.currentScale;
        const newScaledHeight = displayedSize.height * this.currentScale;
        
        // Вычисляем максимальное смещение
        const maxTranslateX = Math.max(0, (newScaledWidth - containerRect.width) / 2);
        const maxTranslateY = Math.max(0, (newScaledHeight - containerRect.height) / 2);
        
        // Корректируем позицию с учетом новых границ
        this.translateX = Math.max(-maxTranslateX, Math.min(maxTranslateX, this.translateX));
        this.translateY = Math.max(-maxTranslateY, Math.min(maxTranslateY, this.translateY));
    }
    
    /**
     * Сбрасывает состояние плагина
     */
    reset() {
        this.currentScale = 1;
        this.resetPosition();
    }
    
    /**
     * Сбрасывает позицию изображения
     */
    resetPosition() {
        this.translateX = 0;
        this.translateY = 0;
        if (this.getCurrentImage()) this.applyTransform();
    }
    
    /**
     * Обновляет состояние кнопок управления
     */
    updateControls() {
        if (!this.zoomControls) return;
        
        // Отключаем кнопки, если достигнуты пределы масштабирования
        this.zoomControls.querySelector('.pictura-zoom-in').disabled = this.currentScale >= this.settings.maxScale;
        this.zoomControls.querySelector('.pictura-zoom-out').disabled = this.currentScale <= this.settings.minScale;
    }
    
    /**
     * Обновляет размеры контейнера
     */
    updateContainer() {
        if (!this.isModalOpen || this.currentScale > 1) return;
        
        const imageSize = this.calculateImageSize();
        const container = document.querySelector('.gallery-content');
        
        if (container) {
            container.style.transition = `width ${this.settings.animationDuration}ms ease, height ${this.settings.animationDuration}ms ease`;
            container.style.width = `${imageSize.width}px`;
            container.style.height = `${imageSize.height}px`;
            setTimeout(() => container.style.transition = '', this.settings.animationDuration + 50);
        }
    }
    
    /**
     * Уничтожает плагин, очищая ресурсы
     */
    destroy() {
        this.removeUI();    // Удаляем элементы UI
        this.unbindEvents(); // Отписываемся от событий
        
        // Сбрасываем стили изображения
        const image = this.getCurrentImage();
        if (image) {
            image.style.transform = '';
            image.style.transformOrigin = '';
            image.style.transition = '';
            image.classList.remove('dragging', 'zoom-cursor', 'zoom-active');
        }
        
        this.observer?.disconnect(); // Отключаем observer
        this.isModalOpen = false;
        this.resetPosition();
    }
}

// Экспорт для разных сред
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ZoomPlugin; // Для Node.js/CommonJS
} else if (typeof window !== 'undefined') {
    window.PicturaZoomPlugin = ZoomPlugin; // Для браузера
}