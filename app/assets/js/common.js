document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.gallery-view .thumbnail').forEach(thumb => {
    thumb.addEventListener('click', () => {
      const group = thumb.dataset.group;
      const gallery = thumb.closest('.gallery-view'); // Находим ближайший .gallery-view
      const groupImages = Array.from(gallery.querySelectorAll(
        `.thumbnail[data-group="${group}"]`
      ));

      createModal(groupImages, thumb);
    });
  });
});

function createModal(images, initialImage) {
  const overlay = document.createElement('div');
  overlay.className = 'gallery-view-overlay';

  const content = document.createElement('div');
  content.className = 'gallery-view-content';

  const img = document.createElement('img');
  img.className = 'gallery-view-image';
  img.src = initialImage.dataset.full;

  const closeBtn = document.createElement('button');
  closeBtn.innerHTML = '&times;';
  closeBtn.className = 'gallery-view-close';

  const counter = document.createElement('div');
  counter.className = 'gallery-view-counter';
  content.appendChild(counter);

  const prevBtn = document.createElement('button');
  prevBtn.innerHTML = '&lt;';
  prevBtn.className = 'gallery-view-nav gallery-view-nav--left';

  const nextBtn = document.createElement('button');
  nextBtn.innerHTML = '&gt;';
  nextBtn.className = 'gallery-view-nav gallery-view-nav--right';

  content.appendChild(closeBtn);
  content.appendChild(img);
  content.appendChild(prevBtn);
  content.appendChild(nextBtn);
  overlay.appendChild(content);
  document.body.appendChild(overlay);

  let currentIndex = images.indexOf(initialImage);

  function updateImage() {
    img.src = images[currentIndex].dataset.full;
    counter.textContent = `${currentIndex + 1} / ${images.length}`;
  }

  function next() {
    if (currentIndex < images.length - 1) {
      currentIndex++;
      updateImage();
    }
  }

  function prev() {
    if (currentIndex > 0) {
      currentIndex--;
      updateImage();
    }
  }

  setTimeout(() => {
    overlay.classList.add('active');
    updateImage();
  }, 10);

  function close() {
    overlay.classList.remove('active');
    setTimeout(() => {
      overlay.remove();
      document.removeEventListener('keydown', handleKeydown);
      document.removeEventListener('wheel', handleWheel);
    }, 300);
  }

  function handleKeydown(e) {
    if (e.key === 'Escape') close();
    if (e.key === 'ArrowRight') next();
    if (e.key === 'ArrowLeft') prev();
  }

  function handleWheel(e) {
    if (e.deltaY > 0) {
      next();
    } else if (e.deltaY < 0) {
      prev();
    }
  }

  let touchStartX = 0;
  let touchEndX = 0;

  function handleTouchStart(e) {
    touchStartX = e.touches[0].clientX;
  }

  function handleTouchMove(e) {
    touchEndX = e.touches[0].clientX;
  }

  function handleTouchEnd() {
    const swipeDistance = touchEndX - touchStartX;
    const swipeThreshold = 50;

    if (swipeDistance > swipeThreshold) {
      prev();
    } else if (swipeDistance < -swipeThreshold) {
      next();
    }
  }

  nextBtn.addEventListener('click', next);
  prevBtn.addEventListener('click', prev);
  closeBtn.addEventListener('click', close);
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) close();
  });
  document.addEventListener('keydown', handleKeydown);
  document.addEventListener('wheel', handleWheel);
  overlay.addEventListener('touchstart', handleTouchStart);
  overlay.addEventListener('touchmove', handleTouchMove);
  overlay.addEventListener('touchend', handleTouchEnd);
}