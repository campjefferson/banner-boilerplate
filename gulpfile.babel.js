import path from "path";
import del from "del";
import fs from "fs-extra";
import glob from "glob";
import gulp from "gulp";
import _ from "lodash";
import axios from "axios";

const webpack = require("webpack-stream");
const through = require("through2");
const merge = require("merge-stream");
const browserSync = require("browser-sync").create();
const uuid = require("uuid/v1");

const argv = require("yargs").argv;
import * as helpers from "./_helpers";

// all gulp plugins accessed via $.pluginNameCamelized
const $ = require("gulp-load-plugins")();

// dev / production
const PRODUCTION = argv.production === true;

// flags
const MULTI_RES = argv.multires === true;

// external variables
const pkg = require("./package.json");
const { config } = pkg;
const { locales, global, banners } = config;

let templateLocals = { locales: {} };
let stagingJson = { banners: {} };
if (locales) {
  locales.forEach(locale => {
    templateLocals.locales[locale] = fs.readJsonSync(
      `./_locales/${locale}.json`
    );
  });
}

const getSizeFromFileName = file => {
  const filePath = path.relative(__dirname, file.path);
  const sizeStr = filePath.split("/")[2];
  const aSizeStr = sizeStr.split("x");
  return { w: parseInt(aSizeStr[0]), h: parseInt(aSizeStr[1]) };
};

const getLocaleFromFileName = (file, defaultLocale = "en") => {
  let loc = defaultLocale;
  if (locales && locales.length) {
    locales.forEach(locale => {
      if (file.path.indexOf(`/${locale}/`) >= 0) {
        loc = locale;
      }
    });
  }
  return loc;
};

gulp.task("css", done => {
  let sassVars = {};
  let sassHeader;

  return gulp
    .src("./src/**/banner.scss")
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
    .pipe(webpack(options))
    .pipe(gulp.dest("dist"));
});

gulp.task("assets", () => {
  return gulp
    .src([
      "./src/**/img/*.{jpg,png,gif,svg}",
      "./src/**/img/*/*.{jpg,png,gif,svg}"
    ])
    .pipe($.if(PRODUCTION, $.image()))
    .pipe(gulp.dest("./dist"));
});

gulp.task("handlebars", () => {
  const options = {
    ignorePartials: true,
    helpers,
    batch: [
      "./_common/templates",
      "./_common/templates/vendor-js",
      "./_common/templates/clicktag"
    ]
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

gulp.task("dev-index", () => {
  const options = {
    ignorePartials: true,
    helpers
  };

  const banners = glob.sync("./dist/*");
  const bannerLinks = banners.map(dir => {
    let aDir = dir.split("/");
    let lang = aDir[2];
    let bannerName = aDir[3];

    let bannerDirs = glob.sync(`./dist/${lang}/*`);

    const list = bannerDirs.map(dir => {
      let aDir = dir.split("/");
      let bannerName = aDir[3];
      return { title: bannerName, url: dir.replace("./dist", "") };
    });
    return { title: lang, banners: list };
  });

  return gulp
    .src("./_common/templates/dev-index.hbs")
    .pipe(
      $.tap((file, t) => {
        templateLocals.locales = config.locales;
        templateLocals.title = pkg.name;
        templateLocals.bannerLinks = bannerLinks;
      })
    )
    .pipe($.compileHandlebars(templateLocals, options))
    .pipe($.rename(`index.html`))
    .pipe(gulp.dest("dist"));
});

gulp.task("size", done => {
  if (!PRODUCTION) {
    done();
  }
  const banners = glob.sync("./dist/*/*");

  const seq = banners.map(dir => {
    let aDir = dir.split("/");
    let lang = aDir[2];
    let bannerName = aDir[3];
    aDir.splice(0, 2);
    const name = aDir.join("/");

    // create size task
    gulp.task(`Size of ${name}`, () => {
      const s = $.size({ title: `Banner ${name} - size -` });
      const sGzip = $.size({
        title: `Banner ${name} - gzipped size -`,
        gzip: true
      });
      return gulp
        .src([`${dir}/*.html`, `${dir}/img/*.{png,jpg,jpeg,gif,svg}`])
        .pipe(s)
        .pipe(sGzip)
        .pipe(gulp.dest("./dist/tmp"))
        .pipe(
          through.obj(function(chunk, enc, cb) {
            stagingJson.banners[lang] = stagingJson.banners[lang] || {};

            stagingJson.banners[lang][bannerName] =
              stagingJson.banners[lang][bannerName] || {};

            stagingJson.banners[lang][bannerName].sizes = {
              size: { raw: s.size, pretty: s.prettySize },
              gzipSize: { raw: sGzip.size, pretty: sGzip.prettySize }
            };
            cb(null, chunk);
          })
        );
    });

    return `Size of ${name}`;
  });
  return gulp.series(...seq)(done);
});

gulp.task("delete-temp", done => {
  del.sync("./dist/tmp");
  done();
});

gulp.task("publish", done => {
  if (!PRODUCTION) {
    done();
  }
  const gifBanner = config.gifBanner || "en/300x250";
  const aGifBanner = gifBanner.split("/");
  fs.copySync(
    `./dist/${gifBanner}/${aGifBanner[1]}.gif`,
    `./dist/thumbnail.gif`
  );

  stagingJson.thumbnail = "thumbnail.gif";

  const now = new Date();
  stagingJson.lastModified = now;

  let numBanners = 0;

  _.each(stagingJson.banners, (value, lang) => {
    _.each(stagingJson.banners[lang], (value, prop) => {
      if (typeof stagingJson.banners[lang][prop] === "string") {
        return;
      }
      numBanners++;
      const aSizes = prop.split("x");
      stagingJson.banners[lang][prop].name = prop;
      stagingJson.banners[lang][prop].file = `${lang}/${prop}`;
      stagingJson.banners[lang][prop].url = `${prop}`;
      stagingJson.banners[lang][prop].width = parseInt(aSizes[0]);
      stagingJson.banners[lang][prop].height = parseInt(aSizes[1]);
    });
  });

  stagingJson.numBanners = numBanners;
  stagingJson.version = pkg.version;
  stagingJson.name = config.global.title;
  stagingJson.client = config.global.client;

  fs.writeJSONSync("./dist/staging-template.json", stagingJson);
  done();
});

gulp.task("spritesheet", done => {
  const spritesheets = glob.sync("./src/*/*/img/spritesheets/*");

  const seq = spritesheets.map(dir => {
    let aDir = dir.split("/");
    let spriteName = aDir.pop();
    let rootFolder = aDir.join("/");

    let spritesmithFilter = "*.{png,jpg,jpeg}";
    let spritesmithOptions = {
      functions: true,
      variableNameTransforms: ["dasherize"],
      imgName: `${spriteName}.png`,
      cssName: `${spriteName}.scss`,
      cssTemplate: `./_common/css/spritesmith.retina.only.template.handlebars`
    };

    if (MULTI_RES) {
      spritesmithOptions = {
        retinaSrcFilter: `${dir}/*@2x.{png,jpg,jpeg}`,
        retinaImgName: `${spriteName}@2x.png`,
        imgName: `${spriteName}.png`,
        cssName: `${spriteName}.scss`
      };
    }
    spritesmithOptions.imgPath = `img/spritesheets/${spritesmithOptions.imgName}`;

    const task = gulp
      .src(`${dir}/${spritesmithFilter}`)
      .pipe($.spritesmith(spritesmithOptions));

    return {
      imgStream: task.img.pipe(gulp.dest(rootFolder)),
      cssStream: task.css,
      rootFolder
    };
  });

  const listsObj = _.groupBy(seq, "rootFolder");
  let lists = [];

  _.each(listsObj, list => {
    lists.push(list);
  });

  const endSeq = lists.map((dirList, index) => {
    const taskName = `sprite-${index}`;
    const rootDir = dirList[0].rootFolder;
    let imgStreams = [];
    let cssStreams = [];
    dirList.map(streamList => {
      imgStreams.push(streamList.imgStream);
      cssStreams.push(streamList.cssStream);
    });

    const cssStream = () =>
      merge(...cssStreams)
        .pipe(
          $.appendPrepend.appendText(
            MULTI_RES
              ? "@include retina-sprites($retina-groups);"
              : "// nothing"
          )
        )
        .pipe($.concat("sprites.scss"))
        .pipe(gulp.dest(`${rootDir}`));

    gulp.task(
      taskName,
      gulp.parallel(cssStream, ...imgStreams.map(stream => () => stream))
    );

    return taskName;
  });

  return gulp.parallel(...endSeq)(done);
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

gulp.task("zip", done => {
  const date = new Date();
  const dateStr = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;

  const full = gulp
    .src("./dist/**/*")
    .pipe($.zip(`${pkg.name}_${dateStr}.zip`))
    .pipe(gulp.dest("./dist/download"));

  stagingJson.zip = `/download/${pkg.name}_${dateStr}.zip`;

  // const sets = glob.sync("./dist/*");

  // const langSeq = sets.map(dir => {
  //   let aDir = dir.split("/");
  //   let lang = aDir[2];
  //   gulp.task(`Archive ${lang}`, () => {
  //     return gulp
  //       .src([`${dir}/**/*`])
  //       .pipe($.zip(`${pkg.name}_${lang.toUpperCase()}_${dateStr}.zip`))
  //       .pipe(gulp.dest("./dist/download"))
  //       .pipe(
  //         through.obj(function(chunk, enc, cb) {
  //           stagingJson.banners[lang] = stagingJson.banners[lang] || {};
  //           stagingJson.banners[
  //             lang
  //           ].zip = `/download/${pkg.name}_${lang.toUpperCase()}_${dateStr}.zip`;
  //           cb(null, chunk);
  //         })
  //       );
  //   });
  //   return `Archive ${lang}`;
  // });

  const banners = glob.sync("./dist/*/*");
  const seq = banners.map(dir => {
    let aDir = dir.split("/");
    let lang = aDir[2];
    let bannerName = aDir[3];
    aDir.splice(0, 2);
    const name = aDir.join("/");

    gulp.task(`Archive ${name}`, () => {
      return gulp
        .src([`${dir}/**/*`])
        .pipe(
          $.zip(
            `${pkg.name}_${bannerName}_${lang.toUpperCase()}_${dateStr}.zip`
          )
        )
        .pipe(gulp.dest("./dist/download"))
        .pipe(
          through.obj(function(chunk, enc, cb) {
            stagingJson.banners[lang] = stagingJson.banners[lang] || {};

            stagingJson.banners[lang][bannerName] =
              stagingJson.banners[lang][bannerName] || {};

            stagingJson.banners[lang][
              bannerName
            ].zip = `/download/${pkg.name}_${bannerName}_${lang.toUpperCase()}_${dateStr}.zip`;
            cb(null, chunk);
          })
        );
    });

    return `Archive ${name}`;
  });

  return gulp.parallel(() => full, ...seq)(done);
});

gulp.task("call-staging-endpoint", done => {
  if (!config.stagingEndpoint) {
    done();
  }
  return axios.post(config.stagingEndpoint);
});

gulp.task("default", done => {
  if (PRODUCTION) {
    return gulp.series(
      "clean",
      "spritesheet",
      gulp.parallel("js", "css", "assets"),
      "handlebars",
      "inline",
      "backups",
      "prune",
      "size",
      "delete-temp",
      "zip",
      "publish",
      "call-staging-endpoint"
    )(done);
  }
  return gulp.series(
    "clean",
    "spritesheet",
    gulp.parallel("js", "css", "assets"),
    "handlebars",
    "dev-index",
    "server",
    "watch"
  )(done);
});

gulp.task("server", done => {
  browserSync.init({
    server: {
      baseDir: "./dist"
    }
  });
  done();
});

gulp.task("reload", done => {
  browserSync.reload();
  done();
});

gulp.task("watch", done => {
  gulp.watch(["./src/**/*.scss"], gulp.series("css"));
  gulp.watch(["./src/**/*.js"], gulp.series("js", "reload"));
  gulp.watch(
    ["./src/**/spritesheets/**/*.{jpg,png,gif,svg}"],
    gulp.series("spritesheet")
  );
  gulp.watch(
    [
      "./src/**/*.{jpg,png,gif,svg}",
      "!./src/**/spritesheets/**/*.{jpg,png,gif,svg}"
    ],
    gulp.series("assets", "reload")
  );
  gulp.watch(["./src/**/*.{hbs,html}"], gulp.series("handlebars", "reload"));
});
