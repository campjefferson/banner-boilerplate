import fs from "fs-extra";
import gulp from "gulp";
import * as helpers from "./_helpers";

// all gulp plugins accessed via $.pluginNameCamelized
const $ = require("gulp-load-plugins")();

// external variables
const pkg = require("./package.json");
const { config } = pkg;
const { locales } = config;

let templateLocals = { locales: {} };

locales.forEach(locale => {
  templateLocals.locales[locale] = fs.readJsonSync(`./_locales/${locale}.json`);
});

gulp.task("handlebars", () => {
  const options = {
    ignorePartials: true,
    helpers
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

gulp.task("default", function() {});
