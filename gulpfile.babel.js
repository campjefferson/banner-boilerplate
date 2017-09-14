import path from "path";
import fs from "fs-extra";
import glob from "glob";
import gulp from "gulp";
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

gulp.task("css", done => {
  return gulp
    .src("./src/**/*.scss")
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
        let currentLocale = "en";
        locales.forEach(locale => {
          if (file.path.indexOf(`/${locale}/`) >= 0) {
            currentLocale = locale;
          }
        });
        templateLocals.currentLocale = currentLocale;
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

gulp.task("size", () => {
  let banners = glob.sync("./dist/*/*");

  return banners.forEach(dir => {
    const name = dir.split("/").pop();
    return gulp
      .src(`${dir}/*.{html,js,css}`)
      .pipe($.size({ title: `${name}:: gzipped size`, gzip: true }))
      .pipe($.size({ title: `${name}:: size` }))
      .pipe(gulp.dest("dist"));
  });
});

gulp.task("default", ["handlebars"], function(done) {
  if (PRODUCTION) {
    return gulp
      .src("./dist/**/*.html")
      .pipe($.inlineSource())
      .pipe(gulp.dest("dist"));
  } else {
    return done();
  }
});
