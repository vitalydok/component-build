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
        // iframe.width = width;
        // iframe.height = height;
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
        this.addSwipeHint(overlay);

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

    addSwipeHint(overlay) {
        if (window.innerWidth >= 592) {
            return;
        }
        const swipeHint = document.createElement('div')
        swipeHint.className = 'menu-indicator'
        swipeHint.innerHTML = '<div class="indicator-wrapper"><div class="box-wrapper"><div class="box-outer"><div class="box"></div><div class="box"></div><div class="box"></div><div class="box"></div></div></div><div class="indicator-cursor"><svg id="Layer_1" data-name="Layer 1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 47.619 68.23"><title>noun_692985</title><path d="M59.773,79.1l0.033-.176c2.062-9.136,9.688-20.832,8.023-31.685-0.45-2.583-.877-3.861-1.383-4.527-0.33-.435-0.807-0.769-2.285-0.769a4.6,4.6,0,0,0-1.063.116L63.041,47.7a1.875,1.875,0,0,1-3.749-.035l0.061-6.554c0.071-2.036-.252-2.656-0.443-2.862-0.169-.181-0.651-0.485-2.388-0.485a2.962,2.962,0,0,0-2.436.915l-0.07,5.843a1.875,1.875,0,1,1-3.749-.035l0.062-6.553c0.071-2.036-.252-2.657-0.443-2.864-0.169-.181-0.653-0.485-2.389-0.485a3.423,3.423,0,0,0-2.054.551l-0.177.17-0.025,9.4a1.875,1.875,0,0,1-3.749-.011L41.554,21.73c0.071-2.042-.25-2.66-0.443-2.869-0.169-.181-0.652-0.485-2.389-0.485a3.225,3.225,0,0,0-2.223.688,2.533,2.533,0,0,0-.654,2.17l0,0.116V54.614a1.875,1.875,0,0,1-3.75,0V47.837l-0.875.232a4.476,4.476,0,0,0-3.115,3.319A10.042,10.042,0,0,0,29.864,58.8c3.487,5.315,8.108,11.265,9.58,18.686l0.251,1.521Z" transform="translate(-24.187 -14.626)" style="fill:#fff"/><path d="M61.32,82.856l-23.33-.1a1.875,1.875,0,0,1-1.863-1.759c-0.476-7.733-5.126-13.62-9.4-20.132-2.013-3.068-3.083-6.96-2.266-10.351,0.766-3.185,3.113-5.585,7-6.378l0.64-.087V21.35l-0.011-.659a6.017,6.017,0,0,1,1.865-4.38,6.923,6.923,0,0,1,4.769-1.685c1.871,0,3.817.263,5.136,1.683,1.293,1.391,1.519,3.4,1.445,5.492l-0.026,9.37,0.724-.2a8.546,8.546,0,0,1,1.5-.129,10.564,10.564,0,0,1,2.776.309,4.92,4.92,0,0,1,2.36,1.374,4.7,4.7,0,0,1,.782,1.153L53.7,34.519l1.325-.374a8.535,8.535,0,0,1,1.495-.129,10.564,10.564,0,0,1,2.776.309A4.922,4.922,0,0,1,61.657,35.7a5.227,5.227,0,0,1,1.235,2.486l0.015,0.11,0.288-.049a8.892,8.892,0,0,1,.966-0.052,6.109,6.109,0,0,1,5.272,2.251c1.127,1.485,1.653,3.64,2.1,6.188,1.965,12.813-7.146,26.223-8.345,34.614A1.875,1.875,0,0,1,61.32,82.856ZM59.773,79.1l0.033-.176c2.062-9.136,9.688-20.832,8.023-31.685-0.45-2.583-.877-3.861-1.383-4.527-0.33-.435-0.807-0.769-2.285-0.769a4.6,4.6,0,0,0-1.063.116L63.041,47.7a1.875,1.875,0,0,1-3.749-.035l0.061-6.554c0.071-2.036-.252-2.656-0.443-2.862-0.169-.181-0.651-0.485-2.388-0.485a2.962,2.962,0,0,0-2.436.915l-0.07,5.843a1.875,1.875,0,1,1-3.749-.035l0.062-6.553c0.071-2.036-.252-2.657-0.443-2.864-0.169-.181-0.653-0.485-2.389-0.485a3.423,3.423,0,0,0-2.054.551l-0.177.17-0.025,9.4a1.875,1.875,0,0,1-3.749-.011L41.554,21.73c0.071-2.042-.25-2.66-0.443-2.869-0.169-.181-0.652-0.485-2.389-0.485a3.225,3.225,0,0,0-2.223.688,2.533,2.533,0,0,0-.654,2.17l0,0.116V54.614a1.875,1.875,0,0,1-3.75,0V47.837l-0.875.232a4.476,4.476,0,0,0-3.115,3.319A10.042,10.042,0,0,0,29.864,58.8c3.487,5.315,8.108,11.265,9.58,18.686l0.251,1.521Z" transform="translate(-24.187 -14.626)"/></svg></div></div>'
        overlay.appendChild(swipeHint);
        setTimeout(() => {
            if (swipeHint.parentNode === overlay) {
                swipeHint.style.opacity = '0';
                setTimeout(() => overlay.removeChild(swipeHint), 300); // Удалить после завершения анимации
            }
        }, 5700);
    }

    setupModalEvents(overlay, content, mediaElement, images, initialIndex) {
        let currentIndex = initialIndex;
        const totalImages = images.length;

        const next = () => {
            if (currentIndex < totalImages - 1) {
                currentIndex++;
                this.changeMedia(content, images[currentIndex - 1], images[currentIndex], 'next');
                this.updateCounter(overlay, currentIndex + 1, totalImages);
            }
        };

        const prev = () => {
            if (currentIndex > 0) {
                currentIndex--;
                this.changeMedia(content, images[currentIndex + 1], images[currentIndex], 'prev');
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
            touchEndX = touchStartX;
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
        console.log('Смена медиа:', currentElement);
        
        // Получаем URL медиа
        const mediaUrl = this.getImageUrl(newElement);
        if (!mediaUrl) {
            console.error('Невозможно получить URL медиа для', newElement);
            return;
        }
        
        // Проверяем, YouTube это или изображение
        const isYouTube = this.isYouTubeUrl(mediaUrl);

        const currentUrl = this.getImageUrl(currentElement);
        if (!currentUrl) {
            console.error('Невозможно получить URL медиа для', currentElement);
            return;
        }
        // Проверяем, YouTube это или изображение
        const isCurrentYouTube = this.isYouTubeUrl(currentUrl);
        
        // Очищаем контейнер
        if (isYouTube || isCurrentYouTube) {
            this.clearContent(contentContainer);
        }
        
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
        const duration = this.settings.effects.fade.duration;

        container.style.transition = `opacity ${duration}ms ease-out`;
        container.style.opacity = '0';
        
        const img = document.createElement('img');
        img.className = 'gallery-image';
        img.src = newSrc;

        // Ждём завершения анимации ухода
        setTimeout(() => {
            // Меняем изображение, очищаем контейнер
            this.clearContent(container);
            container.appendChild(img);
        }, duration);

        setTimeout(() => {
            container.style.opacity = '1';
        }, duration);
    }

    // applySlideEffect(container, newSrc, direction) {
    //     container.style.position = 'relative';
    //     container.style.overflow = 'hidden';

    //     const img = document.createElement('img');
    //     img.className = 'gallery-image';
    //     img.src = newSrc;
    //     img.style.position = 'absolute';
    //     img.style.top = '0';
    //     img.style.left = direction === 'next' ? '100%' : '-100%';
    //     img.style.transition = `transform ${this.settings.effects.slide.duration}ms ease-out`;

    //     container.appendChild(img);

    //     setTimeout(() => {
    //         img.style.transform = 'translateX(0)';
    //     }, 10);

    //     setTimeout(() => {
    //         img.style.position = '';
    //         img.style.top = '';
    //         img.style.left = '';
    //         img.style.transition = '';
    //         img.style.transform = '';
    //         container.style.overflow = '';
    //     }, this.settings.effects.slide.duration);
    // }
    applySlideEffect(container, newSrc, direction) {
        const duration = this.settings.effects.slide.duration;

        // Установка базовых стилей контейнера
        container.style.position = 'relative';
        container.style.overflow = 'hidden';
        container.style.width = '100%';
        container.style.transition = `transform ${duration}ms ease-out`;
        container.style.willChange = 'transform';

        // Смещение контейнера в нужную сторону
        const offset = direction === 'next' ? '-100vw' : '100vw';
        container.style.transition = `transform ${duration}ms ease-out`;
        container.style.transform = `translateX(${offset})`;

        // Ждём завершения анимации ухода
        setTimeout(() => {
            // Меняем изображение, очищаем контейнер
            this.clearContent(container);

            const newImg = document.createElement('img');
            newImg.className = 'gallery-image';
            newImg.src = newSrc;
            // newImg.style.width = '100%';
            // newImg.style.height = '100%';
            newImg.style.display = 'block';
            newImg.style.margin = '0 auto';
            // newImg.style.objectFit = 'contain';

            container.appendChild(newImg);

            // Устанавливаем контейнер в противоположную сторону мгновенно
            container.style.transition = 'none';
            container.style.transform = `translateX(${direction === 'next' ? '100vw' : '-100vw'})`;

            // Позволяем браузеру отрисовать
            setTimeout(() => {
                requestAnimationFrame(() => {
                    // Возвращаем контейнер в центр с анимацией
                    container.style.transition = `transform ${duration}ms ease-out`;
                    container.style.transform = 'translateX(0)';
                });
            }, 10);
        }, duration);

        // Очищаем временные стили после завершения второй анимации
        setTimeout(() => {
            container.style.transition = '';
            container.style.transform = '';
            container.style.minHeight = '';
        }, duration * 2 + 50);
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