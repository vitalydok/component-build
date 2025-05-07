

document.addEventListener('DOMContentLoaded', () => {
  const gallery = new GalleryDok({
    gallerySelector: '[data-gallery-one]',
    transitionEffect: 'fade',
    effects: {
      fade: {
        direction: 'vertical',
        duration: 500
      }
    },
    keyboardNavigation: true,
    wheelNavigation: true,
    touchNavigation: true,
    counter: true
  });
  const gallery2 = new GalleryDok({
    gallerySelector: '[data-gallery-two]',
  });
});