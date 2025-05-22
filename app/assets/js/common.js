
// Функция для проверки необходимости загрузки плагина зума
function checkAndLoadZoomPlugin() {
  // Проверяем, есть ли на странице элементы галереи, которым нужен плагин зума
  const galleryElements = document.querySelectorAll('.gallery-element'); // замените на реальный селектор
  
  if (galleryElements.length >= 0) {
    // Если есть элементы галереи, загружаем плагин
    loadZoomPlugin().then(() => {
      // После загрузки скрипта инициализируем плагин для каждой галереи
      galleryElements.forEach((gallery, index) => {
        const galleryInstance = gallery._galleryInstance; // предполагается, что у элемента есть такое свойство
        
        // Если у нас есть доступ к экземпляру галереи, инициализируем для неё плагин зума
        if (galleryInstance) {
          const zoomPlugin = new GalleryDokZoomPlugin(galleryInstance, {
            maxScale: 4,
            controlsEnabled: true
          });
          console.log(`Плагин зума инициализирован для галереи ${index + 1}`);
        }
      });
    }).catch(error => {
      console.error('Ошибка при загрузке плагина зума:', error);
    });
  } else {
    console.log('Элементы галереи не обнаружены, плагин зума не будет загружен');
  }
}

// Функция для динамической загрузки скрипта с плагином зума
function loadZoomPlugin() {
  return new Promise((resolve, reject) => {
    // Проверяем, был ли уже загружен скрипт
    if (window.GalleryDokZoomPlugin) {
      resolve();
      return;
    }
    
    // Создаем элемент скрипта
    const script = document.createElement('script');
    script.src = '/assets/js/plugins/zoom/index.js'; // Укажите правильный путь к файлу
    script.async = true;
    
    // Обработчики загрузки скрипта
    script.onload = () => {
      console.log('Плагин зума успешно загружен');
      resolve();
    };
    
    script.onerror = () => {
      reject(new Error('Не удалось загрузить плагин зума'));
    };
    
    // Добавляем скрипт в DOM
    document.head.appendChild(script);
  });
}

// Запускаем проверку после полной загрузки DOM
document.addEventListener('DOMContentLoaded', checkAndLoadZoomPlugin);

document.addEventListener('DOMContentLoaded', () => {
  const gallery = new GalleryDok({
    gallerySelector: '[data-gallery-one]',
    transitionEffect: 'fade',
    effects: {
      fade: {
        duration: 500
      }
    },
    keyboardNavigation: true,
    wheelNavigation: true,
    touchNavigation: true,
    counter: true
  });

  const gallery2 = new GalleryDok({
    gallerySelector: '.gallery-page, [data-gallery-two], .video',
    transitionEffect: 'zoom',
    plugins: {
      zoom: {
        maxScale: 4,
        controlsEnabled: true
      },
    },
  });
  if (gallery2.zoomPlugin) {
    gallery2.zoomPlugin.init();
  }
});