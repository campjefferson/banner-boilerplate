import path from "path";
import del from "del";
import fs from "fs-extra";
import glob from "glob";
import gulp from "gulp";
const argv = require("yargs").argv;

import * as helpers from "./_helpers";

// all gulp plugins accessed via $.pluginNameCamelized
const $ = require("gulp-load-plugins")();

// dev / production
const PRODUCTION = argv.production === true;

// flags
const RETINA_ONLY = argv.retinaonly === true;

// external variables
const pkg = require("./package.json");
const config = require("./config.json");
const { locales, global, banners } = config;

let templateLocals = { locales: {} };
locales.forEach(locale => {
  templateLocals.locales[locale] = fs.readJsonSync(`./_locales/${locale}.json`);
});

const getSizeFromFileName = file => {
  const filePath = path.relative(__dirname, file.path);
  const sizeStr = filePath.split("/")[2];
  const aSizeStr = sizeStr.split("x");
  return { w: parseInt(aSizeStr[0]), h: parseInt(aSizeStr[1]) };
};

const getLocaleFromFileName = (file, defaultLocale = "en") => {
  let loc = defaultLocale;
  locales.forEach(locale => {
    if (file.path.indexOf(`/${locale}/`) >= 0) {
      loc = locale;
    }
  });
  return loc;
};

gulp.task("css", done => {
  let sassVars = {};
  let sassHeader;

  return gulp
    .src("./src/**/*.scss")
    .pipe(
      $.tap((file, t) => {
        const size = getSizeFromFileName(file);
        sassVars.$bannerWidth = size.w;
        sassVars.$bannerHeight = size.h;
      })
    )
    .pipe($.sassVariables(sassVars))
    .pipe($.if(!PRODUCTION, $.sourcemaps.init()))
    .pipe(
      $.sass({ includePaths: [path.resolve(__dirname, "./_common/css")] }).on(
        "error",
        $.sass.logError
      )
    )
    .pipe($.if(!PRODUCTION, $.sourcemaps.write()))
    .pipe(gulp.dest("./dist"));
});

gulp.task("js", done => {
  let options = require(PRODUCTION
    ? "./webpack.production.config.babel.js"
    : "./webpack.config.babel.js");

  options.entry = {};
  options.output = {
    path: path.join(__dirname, "dist"),
    filename: `[name]/banner.js`
  };

  let jsFiles = glob.sync("./src/**/banner.js");

  jsFiles.forEach((file, index) => {
    let name = file.split("/");
    name.pop();
    name.splice(1, 1);
    name = name.join("/");
    options.entry[name] = file;
  });

  return gulp
    .src("./src/*/*")
    .pipe($.webpack(options))
    .pipe(gulp.dest("dist"));
});

gulp.task("handlebars", ["js", "css"], () => {
  const options = {
    ignorePartials: true,
    helpers,
    batch: ["./_common/templates"]
  };

  return gulp
    .src("./src/**/*.hbs")
    .pipe(
      $.tap((file, t) => {
        templateLocals.currentLocale = getLocaleFromFileName(file);
        templateLocals.size = getSizeFromFileName(file);
      })
    )
    .pipe($.compileHandlebars(templateLocals, options))
    .pipe(
      $.rename(path => {
        path.extname = ".html";
      })
    )
    .pipe(gulp.dest("dist"));
});

gulp.task("size", done => {
  if (!PRODUCTION) {
    done();
  }
  const banners = glob.sync("./dist/*/*");

  const seq = banners.map(dir => {
    let aDir = dir.split("/");
    aDir.splice(0, 2);
    const name = aDir.join("/");
    // create size task
    gulp.task(`Size of ${name}`, () => {
      return gulp
        .src([`${dir}/*.html`, `${dir}/img/*.{png,jpg,jpeg,gif,svg}}`])
        .pipe($.size({ title: `Banner ${name} - gzipped size -`, gzip: true }))
        .pipe($.size({ title: `Banner ${name} - size -` }))
        .pipe(gulp.dest(`${dir}`));
    });

    return `Size of ${name}`;
  });
  return $.sequence(...seq, done);
});

gulp.task("spritesheet", done => {
  const spritesheets = glob.sync("./src/*/*/spritesheets/*");

  const seq = spritesheets.map(dir => {
    let aDir = dir.split('/');
    let spriteName = aDir.pop();
    let rootFolder = aDir.join('/');

    let spritesmithFilter = "*.{png,jpg,jpeg}";
    let spritesmithOptions = {
      retinaSrcFilter: `${dir}/*@2x.{png,jpg,jpeg}`,
      retinaImgName: `${spriteName}@2x.png`,
      imgName: `${spriteName}.png`,
      cssName: `${spriteName}.scss`
    };
    
    if (RETINA_ONLY) {
      spritesmithFilter = "*@2x.{png,jpg,jpeg}";
      spritesmithOptions = {
        imgName: `${spriteName}@2x.png`,
        cssName: `${spriteName}.scss`
      };
    }
    
    gulp.task(`Spritesheet ${dir}`, () => {
      return gulp
      .src(`${dir}/${spritesmithFilter}`)
      .pipe($.spritesmith(spritesmithOptions))
      .pipe(gulp.dest(`${rootFolder}`));
    });

    return `Spritesheet ${dir}`;
  });

  return $.sequence(...seq, done);
});

gulp.task("inline", done => {
  if (PRODUCTION) {
    return gulp
      .src("./dist/**/*.html")
      .pipe($.inlineSource())
      .pipe($.htmlmin({ collapseWhitespace: true }))
      .pipe(gulp.dest("dist"));
  } else {
    done();
  }
});

gulp.task("clean", done => {
  del.sync("./dist");
  done();
});

gulp.task("prune", done => {
  if (PRODUCTION) {
    del.sync("./dist/**/*.{js,css,map}");
    done();
  } else {
    done();
  }
});

gulp.task("default", done => {
  if (PRODUCTION) {
    return $.sequence("clean", "handlebars", "inline", "prune", "size", done);
  }
  return $.sequence("clean", "handlebars", "watch", done);
});

gulp.task("watch", done => {
  done();
});
