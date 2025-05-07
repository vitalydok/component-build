var gulp = require("gulp"),
    sass = require("gulp-sass")(require("sass")),
    globImporter = require("node-sass-glob-importer"),
    pug = require("gulp-pug"),
    browserSync = require("browser-sync"),
    concat = require("gulp-concat"),
    terser = require("gulp-terser"), // Заменяем gulp-uglifyjs на gulp-terser
    cssnano = require("gulp-cssnano"),
    rename = require("gulp-rename"),
    del = require("del"),
    imagemin = require("gulp-imagemin"),
    cache = require("gulp-cache"),
    autoprefixer = require("gulp-autoprefixer"),
    postcss = require("gulp-postcss"),
    pixelstorem = require("postcss-pixels-to-rem"),
    cached = require("gulp-cached"),
    dependents = require("gulp-dependents"),
    extReplace = require("gulp-ext-replace"),
    babel = require("gulp-babel"),
    webp = require("imagemin-webp"),
    newer = require("gulp-newer");

let pathBuild = "./app/";

// SASS компиляция
gulp.task("sass", function () {
    var plugins = [pixelstorem()];
    return gulp
        .src([
            "app/sass/**/*.sass",
            "app/assets/libs/**/*.sass",
            "app/components/**/*.sass",
            "!app/components/settings.sass",
        ])
        .pipe(cached("sass"))
        .pipe(dependents())
        .pipe(sass({ importer: globImporter() }))
        .pipe(postcss(plugins))
        .pipe(cssnano({ zindex: false }))
        .pipe(rename({ suffix: ".min" }))
        .pipe(autoprefixer(["last 15 versions", "> 1%", "ie 8", "ie 7"], { cascade: true }))
        .pipe(gulp.dest("app/assets/css"))
        .pipe(browserSync.reload({ stream: true }));
});

// Обновление blocks.sass
gulp.task("update-blocks", function () {
    var plugins = [pixelstorem()];
    return gulp
        .src(["app/sass/blocks.sass"])
        .pipe(dependents())
        .pipe(sass({ importer: globImporter() }))
        .pipe(postcss(plugins))
        .pipe(cssnano({ zindex: false }))
        .pipe(rename({ suffix: ".min" }))
        .pipe(autoprefixer(["last 15 versions", "> 1%", "ie 8", "ie 7"], { cascade: true }))
        .pipe(gulp.dest("app/assets/css"))
        .pipe(browserSync.reload({ stream: true }));
});

// BrowserSync
gulp.task("browser-sync", function () {
    browserSync({
        server: pathBuild,
    });
});

// Сборка библиотек
gulp.task("libs", function () {
    return gulp
        .src([
            "app/assets/libs/jquery/jquery.min.js",
            "app/assets/libs/dok-gall/dok-gall.js",
            "node_modules/swiper/swiper-bundle.min.js",
            "app/assets/libs/device/device.js",
            "app/assets/libs/mask/jquery.inputmask.min.js",

        ])
        .pipe(concat("libs.min.js"))
        .pipe(terser()) // Используем terser вместо uglify
        .pipe(gulp.dest("app/assets/js"))
        .pipe(browserSync.reload({ stream: true }));
});

// Обработка JavaScript
gulp.task("scripts", function () {
    return gulp
        .src(["app/assets/js/common.js"])
        .pipe(babel({ presets: ["@babel/preset-env"] }))
        .pipe(concat("scripts.min.js"))
        .pipe(terser()) // Используем terser вместо uglify
        .pipe(gulp.dest("app/assets/js"))
        .pipe(browserSync.reload({ stream: true }));
});

// Очистка папки dist
gulp.task("clean", async function () {
    return del.sync("dist");
});

// Компиляция Pug
gulp.task("pug", function () {
    return gulp
        .src([
            "app/pug/*.+(jade|pug)",
            "!app/pug/layout.pug",
            "!app/pug/include/header.pug",
            "!app/pug/include/footer.pug",
            "app/components/*.+(jade|pug)",
        ])
        .pipe(pug({ pretty: true }))
        .pipe(gulp.dest("app"))
        .pipe(browserSync.reload({ stream: true }));
});

// Оптимизация изображений
gulp.task("img", function () {
  return gulp
    .src("app/assets/upload/**/*.+(jpg|png|jpeg)")
    .pipe(imagemin([
      webp({ quality: 75 })
    ], { verbose: true }))
    .pipe(rename({ extname: ".webp" }))
    .pipe(gulp.dest("app/assets/upload"));
});

// Перенос файлов для production
gulp.task("upload", function () {
    return gulp.src("app/assets/upload/**/*").pipe(gulp.dest("dist/assets/upload"));
});

gulp.task("image", function () {
    return gulp.src("app/assets/image/**/*").pipe(gulp.dest("dist/assets/image"));
});

const through = require('through2');
const path = require('path');
const fs = require('fs');
// const imagesize = require('imagesize');
const sharp = require('sharp');

function addImageAttributes() {
  return through.obj(async function (file, encoding, callback) {
    if (file.isNull()) {
      return callback(null, file);
    }

    const projectRoot = process.cwd();
    const appPath = path.join(projectRoot, 'app');
    let content = file.contents.toString();

    const imgRegex = /<img[^>]+src="([^"]+)"[^>]*?(?:(?!width=|height=))[^>]*?>/gi;

    // console.log(`Обрабатываем файл: ${file.path}`);
    let matchCount = 0;
    let successCount = 0;

    const matches = [...content.matchAll(imgRegex)];
    for (const match of matches) {
      const imgTag = match[0];
      const srcMatch = imgTag.match(/src="([^"]+)"/);
      if (!srcMatch) continue;

      let src = srcMatch[1];
      matchCount++;
      // console.log(`Найдено изображение: ${src}`);

      if (imgTag.includes('width=') || imgTag.includes('height=')) {
        // console.log(`Изображение ${src} уже имеет атрибуты width или height`);
        continue;
      }

      let fullPath = src.startsWith('/') ? path.join(appPath, src.substring(1)) : path.join(path.dirname(file.path), src);

      // console.log(`Полный путь к изображению: ${fullPath}`);

      if (path.extname(fullPath).toLowerCase() === '.svg') {
        // console.log(`Пропускаем SVG: ${fullPath}`);
        continue;
      }

      if (!fs.existsSync(fullPath)) {
        // console.warn(`Файл не найден: ${fullPath}`);
        continue;
      }

      try {
        const metadata = await sharp(fullPath).metadata();
        if (metadata.width && metadata.height) {
          // console.log(`Размеры изображения: ${metadata.width}x${metadata.height}`);
          
          const modifiedImgTag = imgTag.replace(/(\s*?)(\/?>\s*?)$/, ` width="${metadata.width}" height="${metadata.height}"$1$2`);
          content = content.replace(imgTag, modifiedImgTag);
          successCount++;
        } else {
          // console.warn(`Не удалось получить размеры изображения: ${fullPath}`);
        }
      } catch (err) {
        // console.warn(`Ошибка при обработке изображения: ${fullPath}`, err);
      }
    }

    console.log(`Обработано изображений: ${matchCount}, успешно: ${successCount}`);

    file.contents = Buffer.from(content);
    callback(null, file);
  });
}

module.exports = addImageAttributes;

// Добавление атрибутов к изображениям
gulp.task("attr", gulp.series("img", function () {
  return gulp.src("app/*.html")
    .pipe(addImageAttributes())
    .pipe(gulp.dest('app'));
}));

// Подготовка к сборке
gulp.task("prebuild", async function () {
    gulp.src(["app/assets/css/main.min.css"]).pipe(gulp.dest("dist/assets/css"));
    gulp.src("app/assets/fonts/**/*").pipe(gulp.dest("dist/assets/fonts"));
    gulp.src(["app/favicon.ico", "app/robots.txt"]).pipe(gulp.dest("dist"));
    gulp.src(["app/assets/js/libs.min.js", "app/assets/js/scripts.min.js"]).pipe(gulp.dest("dist/assets/js"));
    gulp.src("app/*.html")
        .pipe(addImageAttributes())
        .pipe(gulp.dest('dist'));
});

// Очистка кеша
gulp.task("clear", function (callback) {
    return cache.clearAll();
});

// Наблюдение за изменениями
gulp.task("watch", function () {
  gulp.watch(
    ["app/pug/**/*.pug", "app/components/**/*.pug"],
    gulp.parallel("pug")
  );
  
  gulp.task("attr", function () {
    return gulp.src("app/*.html")
      .pipe(newer("app")) // Проверяет, изменялся ли файл
      .pipe(addImageAttributes())
      .pipe(gulp.dest("app")); // Сохраняем обратно в ту же папку
  });

  gulp.watch(
    ["app/sass/**/*.sass", "app/components/**/*.sass"],
    gulp.parallel("sass", "update-blocks")
  );
  gulp.watch(["app/assets/libs/**/*.js"], gulp.parallel("libs"));
  gulp.watch(["app/assets/js/common.js"], gulp.parallel("scripts"));
});

// Задачи по умолчанию
gulp.task(
    "default",
    gulp.parallel(
        "pug",
        "sass",
        "libs",
        "scripts",
        "img",
        "attr",
        "browser-sync",
        "watch"
    )
);

// Production сборка
gulp.task(
    "build",
    gulp.series(
        "clean",
        gulp.parallel(
            "prebuild",
            "img",
            "attr",
            "upload",
            "image",
            "sass",
            "libs",
            "scripts"
        )
    )
);