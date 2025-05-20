class GalleryDok {
    constructor(options = {}) {
        // Настройки по умолчанию
        this.defaults = {
            gallerySelector: '[data-gallery]',
            thumbnailSelector: '.thumbnail',
            viewAllSelector: '[data-gallery-all]',
            imageURLAttribute: 'data-full', // Добавляем новую настройку
            animationDuration: 300,
            swipeThreshold: 50,
            keyboardNavigation: true,
            wheelNavigation: true,
            touchNavigation: true,
            counter: true,
            preload: true,
            // сломанные эффекты перехода
            transitionEffect: 'fade', // fade, slide, zoom
            // настройки
            effects: {
                fade: {
                    duration: 300
                },
                slide: {
                    direction: 'horizontal', // horizontal или vertical
                    duration: 400
                },
                zoom: {
                    scale: 0.8,
                    duration: 350
                }
            },
            // YouTube настройки
            youtube: {
                width: 853,
                height: 480,
                playerVars: {
                    autoplay: 1,
                    rel: 0,
                    modestbranding: 1
                }
            }
        };

        // в собираю все настройки в кучу
        this.settings = {...this.defaults, ...options};

        // Инициализация
        this.init();
    }

    init() {
        // Используем стандартный querySelectorAll, он уже поддерживает несколько селекторов через запятую
        this.galleries = document.querySelectorAll(this.settings.gallerySelector);
        
        if (!this.galleries.length) return;

        this.setupEventListeners();
    }
    
    // Новый метод для получения URL изображения из элемента
    getImageUrl(element) {
        // Сначала проверяем настроенный атрибут
        if (element.dataset[this.settings.imageURLAttribute]) {
            return element.dataset[this.settings.imageURLAttribute];
        }
        
        // Затем проверяем data-full
        if (element.dataset.full) {
            return element.dataset.full;
        }
        
        // Другие возможные источники
        if (element.href) {
            return element.href;
        }
        
        if (element.src) {
            return element.src;
        }
        
        // Для изображений проверяем атрибут src
        const imgElement = element.querySelector('img');
        if (imgElement && imgElement.src) {
            return imgElement.src;
        }
        
        console.error('Не удалось найти URL изображения для элемента:', element);
        return null;
    }
    
    // Проверка, является ли URL YouTube видео
    isYouTubeUrl(url) {
        return url && (
            url.includes('youtube.com/watch') || 
            url.includes('youtu.be/') ||
            url.includes('youtube.com/embed/')
        );
    }
    
    // Получение ID видео из URL YouTube
    getYouTubeVideoId(url) {
        if (!url) return null;
        
        // Паттерны для разных форматов URL YouTube
        const patterns = [
            /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^?&]+)/i,
            /youtube\.com\/watch\?.*v=([^&]+)/i
        ];
        
        for (const pattern of patterns) {
            const match = url.match(pattern);
            if (match && match[1]) {
                return match[1];
            }
        }
        
        return null;
    }
    
    // Создание iframe для YouTube видео
    createYouTubeEmbed(videoId) {
        const { width, height, playerVars } = this.settings.youtube;
        
        // Создаем параметры для URL
        const params = new URLSearchParams();
        for (const [key, value] of Object.entries(playerVars)) {
            params.append(key, value);
        }
        
        const embedUrl = `https://www.youtube.com/embed/${videoId}?${params.toString()}`;
        
        const iframe = document.createElement('iframe');
        iframe.className = 'gallery-video';
        iframe.width = width;
        iframe.height = height;
        iframe.src = embedUrl;
        iframe.frameBorder = '0';
        iframe.allowFullscreen = true;
        
        // Добавляем важные разрешения для автовоспроизведения со звуком
        iframe.allow = "autoplay; encrypted-media";
        
        return iframe;
    }

    setupEventListeners() {
        this.galleries.forEach((gallery, index) => {
            console.log(`Настройка галереи #${index}:`, gallery);
            
            // клик на маленькие картинки
            const thumbnails = gallery.querySelectorAll(this.settings.thumbnailSelector);
            console.log(`- Найдено ${thumbnails.length} миниатюр`);
            
            thumbnails.forEach(thumb => {
                // Добавляем атрибут для отладки, чтобы видеть, что мы добавили обработчик
                thumb.setAttribute('data-gallery-initialized', 'true');
                
                thumb.addEventListener('click', (e) => {
                    console.log('Клик по миниатюре:', thumb);
                    e.preventDefault(); // Предотвращаем стандартное поведение ссылки
                    const group = thumb.dataset.group || 'default';
                    const groupImages = this.getGroupImages(gallery, group);
                    console.log(`- Найдено ${groupImages.length} изображений в группе '${group}'`);
                    this.createModal(groupImages, thumb);
                });
            });

            // кнопка если показать все
            const viewAllBtn = gallery.querySelector(this.settings.viewAllSelector);
            console.log(`- Кнопка "показать все": ${viewAllBtn ? 'найдена' : 'не найдена'}`);
            
            if (viewAllBtn) {
                viewAllBtn.addEventListener('click', (e) => {
                    console.log('Клик по кнопке "показать все":', viewAllBtn);
                    e.preventDefault(); // Предотвращаем стандартное поведение ссылки
                    // Важно: теперь мы используем текущую галерею (gallery) вместо поиска через closest
                    let allImages;
                    const firstThumb = gallery.querySelector(this.settings.thumbnailSelector);

                    if (firstThumb && firstThumb.dataset.group) {
                        const group = firstThumb.dataset.group;
                        allImages = this.getGroupImages(gallery, group);
                    } else {
                        allImages = Array.from(gallery.querySelectorAll(this.settings.thumbnailSelector));
                    }

                    console.log(`- В галерее найдено ${allImages.length} изображений`);
                    if (allImages.length) {
                        this.createModal(allImages, allImages[0]);
                    }
                });
            }
        });
    }



    getGroupImages(gallery, group) {
        if (group === 'all') {
            return Array.from(gallery.querySelectorAll(this.settings.thumbnailSelector));
        }
        return Array.from(gallery.querySelectorAll(`${this.settings.thumbnailSelector}[data-group="${group}"]`));
    }

    createModal(images, initialImage) {
        if (!images.length) {
            console.error('Нет изображений для отображения в галерее');
            return;
        }

        const currentIndex = images.indexOf(initialImage);
        if (currentIndex === -1) {
            console.error('Начальное изображение не найдено в списке', initialImage);
            return;
        }

        console.log('Создание модального окна:', {
            total: images.length,
            currentIndex,
            initialImage
        });

        const overlay = document.createElement('div');
        overlay.className = 'gallery-overlay';

        const content = document.createElement('div');
        content.className = 'gallery-content';

        // Получаем URL изображения/видео
        const mediaUrl = this.getImageUrl(initialImage);
        if (!mediaUrl) {
            console.error('Невозможно получить URL медиа');
            return;
        }
        
        // Проверяем, является ли это YouTube видео
        if (this.isYouTubeUrl(mediaUrl)) {
            const videoId = this.getYouTubeVideoId(mediaUrl);
            if (videoId) {
                const iframe = this.createYouTubeEmbed(videoId);
                content.appendChild(iframe);
            } else {
                console.error('Не удалось получить ID видео YouTube из:', mediaUrl);
                return;
            }
        } else {
            // Обычное изображение
            const img = document.createElement('img');
            img.className = 'gallery-image';
            img.src = mediaUrl;
            content.appendChild(img);
        }

        overlay.appendChild(content);
        document.body.appendChild(overlay);

        if (images.length > 1) {
            this.addNavigation(overlay, content, images.length);
        }

        this.addCloseButton(overlay);

        if (this.settings.counter && images.length > 1) {
            this.addCounter(overlay, currentIndex + 1, images.length);
        }

        document.body.classList.add('no-scroll');

        setTimeout(() => {
            overlay.classList.add('active');
            content.classList.add('active');
        }, 10);

        this.setupModalEvents(overlay, content, content.firstChild, images, currentIndex);
    }

    addNavigation(overlay, content, totalImages) {
        const prevBtn = document.createElement('button');
        prevBtn.innerHTML = '&lt;';
        prevBtn.className = 'gallery-nav gallery-nav--left';
        overlay.appendChild(prevBtn);

        const nextBtn = document.createElement('button');
        nextBtn.innerHTML = '&gt;';
        nextBtn.className = 'gallery-nav gallery-nav--right';
        overlay.appendChild(nextBtn);
    }

    addCloseButton(overlay) {
        const closeBtn = document.createElement('button');
        closeBtn.innerHTML = '&times;';
        closeBtn.className = 'gallery-close';
        overlay.appendChild(closeBtn);
    }

    addCounter(overlay, current, total) {
        const counter = document.createElement('div');
        counter.className = 'gallery-counter';
        counter.textContent = `${current} / ${total}`;
        overlay.appendChild(counter);
    }

    setupModalEvents(overlay, content, mediaElement, images, initialIndex) {
        let currentIndex = initialIndex;
        const totalImages = images.length;

        const next = () => {
            if (currentIndex < totalImages - 1) {
                currentIndex++;
                this.changeMedia(content, mediaElement, images[currentIndex], 'next');
                this.updateCounter(overlay, currentIndex + 1, totalImages);
            }
        };

        const prev = () => {
            if (currentIndex > 0) {
                currentIndex--;
                this.changeMedia(content, mediaElement, images[currentIndex], 'prev');
                this.updateCounter(overlay, currentIndex + 1, totalImages);
            }
        };

        const close = () => {
            overlay.classList.remove('active');
            content.classList.remove('active');

            setTimeout(() => {
                overlay.remove();
                document.body.classList.remove('no-scroll');
                this.removeEventListeners();
            }, this.settings.animationDuration);
        };

        const nextBtn = overlay.querySelector('.gallery-nav--right');
        const prevBtn = overlay.querySelector('.gallery-nav--left');
        const closeBtn = overlay.querySelector('.gallery-close');

        if (nextBtn) nextBtn.addEventListener('click', next);
        if (prevBtn) prevBtn.addEventListener('click', prev);
        if (closeBtn) closeBtn.addEventListener('click', close);

        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) close();
        });

        const handleKeydown = (e) => {
            if (e.key === 'Escape') close();
            if (e.key === 'ArrowRight') next();
            if (e.key === 'ArrowLeft') prev();
        };

        if (this.settings.keyboardNavigation) {
            document.addEventListener('keydown', handleKeydown);
        }

        // Колесо мыши
        const handleWheel = (e) => {
            e.preventDefault();
            if (e.deltaY > 0) next();
            else if (e.deltaY < 0) prev();
        };

        if (this.settings.wheelNavigation) {
            document.addEventListener('wheel', handleWheel, { passive: false });
        }

        let touchStartX = 0;
        let touchEndX = 0;

        const handleTouchStart = (e) => {
            touchStartX = e.touches[0].clientX;
        };

        const handleTouchMove = (e) => {
            touchEndX = e.touches[0].clientX;
        };

        const handleTouchEnd = () => {
            const swipeDistance = touchEndX - touchStartX;

            if (swipeDistance > this.settings.swipeThreshold) {
                prev();
            } else if (swipeDistance < -this.settings.swipeThreshold) {
                next();
            }
        };

        if (this.settings.touchNavigation) {
            overlay.addEventListener('touchstart', handleTouchStart);
            overlay.addEventListener('touchmove', handleTouchMove);
            overlay.addEventListener('touchend', handleTouchEnd);
        }

        this.eventHandlers = {
            handleKeydown,
            handleWheel,
            handleTouchStart,
            handleTouchMove,
            handleTouchEnd,
            nextBtn,
            prevBtn,
            closeBtn
        };
    }

    removeEventListeners() {
        if (this.eventHandlers) {
            document.removeEventListener('keydown', this.eventHandlers.handleKeydown);
            document.removeEventListener('wheel', this.eventHandlers.handleWheel);
        }
    }

    updateCounter(overlay, current, total) {
        const counter = overlay.querySelector('.gallery-counter');
        if (counter) {
            counter.textContent = `${current} / ${total}`;
        }
    }

    changeMedia(contentContainer, currentElement, newElement, direction) {
        console.log('Смена медиа:', newElement);
        
        // Получаем URL медиа
        const mediaUrl = this.getImageUrl(newElement);
        if (!mediaUrl) {
            console.error('Невозможно получить URL медиа для', newElement);
            return;
        }
        
        // Проверяем, YouTube это или изображение
        const isYouTube = this.isYouTubeUrl(mediaUrl);
        
        // Очищаем контейнер
        this.clearContent(contentContainer);
        
        if (isYouTube) {
            // Для YouTube создаем iframe
            const videoId = this.getYouTubeVideoId(mediaUrl);
            if (videoId) {
                const iframe = this.createYouTubeEmbed(videoId);
                contentContainer.appendChild(iframe);
            }
        } else {
            // Для изображений
            this.loadImage(contentContainer, mediaUrl, direction);
        }
    }
    
    // Очистка содержимого контейнера
    clearContent(container) {
        while (container.firstChild) {
            container.removeChild(container.firstChild);
        }
    }
    
    // Загрузка изображения с эффектами
    loadImage(container, imageSrc, direction) {
        const img = document.createElement('img');
        img.className = 'gallery-image';
        
        const preload = new Image();
        preload.src = imageSrc;

        preload.onload = () => {
            switch (this.settings.transitionEffect) {
                case 'fade':
                    this.applyFadeEffect(container, preload.src);
                    break;
                case 'slide':
                    this.applySlideEffect(container, preload.src, direction);
                    break;
                case 'zoom':
                    this.applyZoomEffect(container, preload.src);
                    break;
                default:
                    img.src = preload.src;
                    container.appendChild(img);
            }
        };
        
        preload.onerror = () => {
            console.error('Ошибка загрузки изображения:', imageSrc);
            img.src = imageSrc;
            container.appendChild(img);
        };
    }

    applyFadeEffect(container, newSrc) {
        const img = document.createElement('img');
        img.className = 'gallery-image';
        img.src = newSrc;
        img.style.opacity = '0';
        img.style.transition = `opacity ${this.settings.effects.fade.duration}ms ease-out`;
        
        container.appendChild(img);

        setTimeout(() => {
            img.style.opacity = '1';
        }, 10);
    }

    applySlideEffect(container, newSrc, direction) {
        container.style.position = 'relative';
        container.style.overflow = 'hidden';

        const img = document.createElement('img');
        img.className = 'gallery-image';
        img.src = newSrc;
        img.style.position = 'absolute';
        img.style.top = '0';
        img.style.left = direction === 'next' ? '100%' : '-100%';
        img.style.transition = `transform ${this.settings.effects.slide.duration}ms ease-out`;

        container.appendChild(img);

        setTimeout(() => {
            img.style.transform = 'translateX(0)';
        }, 10);

        setTimeout(() => {
            img.style.position = '';
            img.style.top = '';
            img.style.left = '';
            img.style.transition = '';
            img.style.transform = '';
            container.style.overflow = '';
        }, this.settings.effects.slide.duration);
    }

    applyZoomEffect(container, newSrc) {
        const img = document.createElement('img');
        img.className = 'gallery-image';
        img.src = newSrc;
        img.style.transform = 'scale(0.8)';
        img.style.opacity = '0';
        img.style.transition = `
            transform ${this.settings.effects.zoom.duration}ms ease-out,
            opacity ${this.settings.effects.zoom.duration}ms ease-out
        `;

        container.appendChild(img);

        setTimeout(() => {
            img.style.transform = 'scale(1)';
            img.style.opacity = '1';
        }, 10);
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = GalleryDok;
} else if (typeof window !== 'undefined') {
    window.GalleryDok = GalleryDok;
}