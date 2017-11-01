import path from "path";
import del from "del";
import fs from "fs-extra";
import glob from "glob";
import gulp from "gulp";

const browserSync = require("browser-sync").create();

const argv = require("yargs").argv;
import * as helpers from "./_helpers";

// all gulp plugins accessed via $.pluginNameCamelized
const $ = require("gulp-load-plugins")();

// dev / production
const PRODUCTION = argv.production === true;

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
    .pipe(gulp.dest("./dist"))
    .pipe($.if(!PRODUCTION, browserSync.stream()));
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

gulp.task("handlebars", () => {
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

gulp.task("handlebars-watch", ["handlebars"], done => {
  browserSync.reload();
  done();
});

gulp.task("js-watch", ["js"], done => {
  browserSync.reload();
  done();
});

gulp.task("img-watch", done => {
  browserSync.reload();
  done();
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

gulp.task("backups", done => {
  let filepath;
  return gulp
    .src(`./src/*/*/*.png`)
    .pipe(
      $.gm(function(gmfile) {
        return gmfile.setFormat("gif");
      })
    )
    .pipe(gulp.dest(`./dist`));
});

gulp.task("default", done => {
  if (PRODUCTION) {
    return $.sequence(
      "clean",
      ["js", "css"],
      "handlebars",
      "inline",
      "backups",
      "prune",
      "size",
      done
    );
  }
  return $.sequence(
    "clean",
    ["js", "css"],
    "handlebars",
    "server",
    "watch",
    done
  );
});

gulp.task("server", function() {
  browserSync.init({
    server: {
      baseDir: "./dist"
    }
  });
});

gulp.task("watch", done => {
  gulp.watch(["./src/**/*.scss"], ["css"]);
  gulp.watch(["./src/**/*.js"], ["js-watch"]);
  gulp.watch(["./src/**/*.{jpg,png,gif,svg}"], ["img-watch"]);
  gulp.watch(["./src/**/*.{hbs,html}"], ["handlebars-watch"]);
});
