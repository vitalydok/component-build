document.addEventListener('DOMContentLoaded', () => {
  const gallery = new Pictura({
    gallerySelector: '.gallery-page, [data-gallery-two], .video',
    transitionEffect: 'fade',
    plugins: {
      zoom: {
        maxScale: 4,
        controlsEnabled: true
      },
    },
  });
});