class GalleryDok {
    constructor(options = {}) {
        // Настройки по умолчанию
        this.defaults = {
            gallerySelector: '[data-gallery]',
            thumbnailSelector: '.thumbnail',
            viewAllSelector: '[data-gallery] [data-gallery-all]',
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
            }
        };

        // в собираю все настройки в кучу
        this.settings = {...this.defaults, ...options};

        // Инициализация
        this.init();
    }

    init() {
        this.galleries = document.querySelectorAll(this.settings.gallerySelector);
        if (!this.galleries.length) return;

        this.setupEventListeners();
    }

    setupEventListeners() {
        this.galleries.forEach(gallery => {
            // клик на маленькие картинки
            const thumbnails = gallery.querySelectorAll(this.settings.thumbnailSelector);
            thumbnails.forEach(thumb => {
                thumb.addEventListener('click', (e) => {
                    const group = thumb.dataset.group || 'default';
                    const groupImages = this.getGroupImages(gallery, group);
                    this.createModal(groupImages, thumb);
                });
            });

            // кнопка если показать все
            const viewAllBtn = gallery.querySelector(this.settings.viewAllSelector);
            if (viewAllBtn) {
                viewAllBtn.addEventListener('click', () => {
                    const galleryContainer = viewAllBtn.closest(this.settings.gallerySelector);
                    let allImages;
                    const firstThumb = galleryContainer.querySelector(this.settings.thumbnailSelector);

                    if (firstThumb && firstThumb.dataset.group) {
                        const group = firstThumb.dataset.group;
                        allImages = this.getGroupImages(galleryContainer, group);
                    } else {
                        allImages = Array.from(galleryContainer.querySelectorAll(this.settings.thumbnailSelector));
                    }

                    if (allImages.length) {
                        this.createModal(allImages, allImages[0]);
                    }
                });
            }
        });
    }

    // выбрать группу или все группы в 1
    getGroupImages(gallery, group) {
        if (group === 'all') {
            return Array.from(gallery.querySelectorAll(this.settings.thumbnailSelector));
        }
        return Array.from(gallery.querySelectorAll(`${this.settings.thumbnailSelector}[data-group="${group}"]`));
    }

    //создание модалки и всех элементов внутри закрыть, счетчик, стрелки
    createModal(images, initialImage) {
        if (!images.length) return;

        const currentIndex = images.indexOf(initialImage);
        if (currentIndex === -1) return;

        const overlay = document.createElement('div');
        overlay.className = 'gallery-overlay';

        const content = document.createElement('div');
        content.className = 'gallery-content';

        const img = document.createElement('img');
        img.className = 'gallery-image';
        img.src = initialImage.dataset.full;

        overlay.appendChild(content);
        content.appendChild(img);
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

        this.setupModalEvents(overlay, content, img, images, currentIndex);
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

    setupModalEvents(overlay, content, img, images, initialIndex) {
        let currentIndex = initialIndex;
        const totalImages = images.length;

        const next = () => {
            if (currentIndex < totalImages - 1) {
                currentIndex++;
                this.changeImage(img, images[currentIndex], 'next');
                this.updateCounter(overlay, currentIndex + 1, totalImages);
            }
        };

        const prev = () => {
            if (currentIndex > 0) {
                currentIndex--;
                this.changeImage(img, images[currentIndex], 'prev');
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

    changeImage(img, newImage, direction) {
        const preload = new Image();
        preload.src = newImage.dataset.full;

        preload.onload = () => {
            switch (this.settings.transitionEffect) {
                case 'fade':
                    this.applyFadeEffect(img, preload.src);
                    break;
                case 'slide':
                    this.applySlideEffect(img, preload.src, direction);
                    break;
                case 'zoom':
                    this.applyZoomEffect(img, preload.src);
                    break;
                default:
                    img.src = preload.src;
            }
        };
    }

    applyFadeEffect(img, newSrc) {
        const container = img.parentNode;
        container.style.position = 'relative';

        const tempImg = img.cloneNode();
        tempImg.src = newSrc;
        tempImg.style.position = 'absolute';
        tempImg.style.top = '0';
        tempImg.style.left = '0';
        tempImg.style.opacity = '0';
        tempImg.style.transition = `opacity ${this.settings.effects.fade.duration}ms ease-out`;

        container.appendChild(tempImg);

        setTimeout(() => {
            tempImg.style.opacity = '1';
        }, 10);

        setTimeout(() => {
            img.src = newSrc;
            tempImg.remove();
        }, this.settings.effects.fade.duration);
    }

    applySlideEffect(img, newSrc, direction) {
        const container = img.parentNode;
        container.style.position = 'relative';
        container.style.overflow = 'hidden';

        const fromPos = direction === 'next' ? '100%' : '-100%';
        const toPos = direction === 'next' ? '-100%' : '100%';

        const newImg = img.cloneNode();
        newImg.src = newSrc;
        newImg.style.position = 'absolute';
        newImg.style.top = '0';
        newImg.style.left = fromPos;
        newImg.style.transition = `transform ${this.settings.effects.slide.duration}ms ease-out`;

        container.appendChild(newImg);

        setTimeout(() => {
            newImg.style.transform = `translateX(0)`;

            img.style.transition = `transform ${this.settings.effects.slide.duration}ms ease-out`;
            img.style.transform = `translateX(${toPos})`;
        }, 10);

        setTimeout(() => {
            img.src = newSrc;
            img.style.transition = '';
            img.style.transform = '';
            newImg.remove();
            container.style.overflow = '';
        }, this.settings.effects.slide.duration);
    }

    applyZoomEffect(img, newSrc) {
        const container = img.parentNode;
        container.style.position = 'relative';

        const tempImg = img.cloneNode();
        tempImg.src = newSrc;
        tempImg.style.position = 'absolute';
        tempImg.style.top = '0';
        tempImg.style.left = '0';
        tempImg.style.transform = 'scale(0.8)';
        tempImg.style.opacity = '0';
        tempImg.style.transition = `
      transform ${this.settings.effects.zoom.duration}ms ease-out,
      opacity ${this.settings.effects.zoom.duration}ms ease-out
    `;

        container.appendChild(tempImg);

        setTimeout(() => {
            tempImg.style.transform = 'scale(1)';
            tempImg.style.opacity = '1';
        }, 10);

        setTimeout(() => {
            img.src = newSrc;
            tempImg.remove();
        }, this.settings.effects.zoom.duration);
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = GalleryLightbox;
} else if (typeof window !== 'undefined') {
    window.GalleryLightbox = GalleryLightbox;
}