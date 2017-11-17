import path from "path";
import phantom from "phantom";
import glob from "glob";
const fs = require("fs-extra");
const gm = require("gm").subClass({ imageMagick: true });

const ORIGINAL_FORMAT = "jpg";

const removeDir = dirPath => {
  try {
    var files = fs.readdirSync(dirPath);
  } catch (e) {
    return;
  }
  if (files.length > 0)
    for (var i = 0; i < files.length; i++) {
      var filePath = dirPath + "/" + files[i];
      if (fs.statSync(filePath).isFile()) fs.unlinkSync(filePath);
      else rmDir(filePath);
    }
  fs.rmdirSync(dirPath);
};
function timeout(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function capture(page, targetFile, clipRect) {
  let width, height;
  const fileName = path.basename(targetFile);
  const aFileName = fileName.split("_");
  const aSize = aFileName[1].split("x");
  width = parseInt(aSize[0]);
  height = parseInt(aSize[1]);
  await page.property("viewportSize", { width: width, height: height });
  var clipRect = { top: 0, left: 0, width: width, height: height };
  console.log("Capturing page to " + targetFile);
  await page.render(targetFile, { format: ORIGINAL_FORMAT, quality: "100" });
  return new Promise(resolve => resolve());
}

async function captureSelector(page, targetFile, selector) {
  const clipRect = await page.evaluate(
    function(selector) {
      try {
        var clipRect = document.querySelector(selector).getBoundingClientRect();
        return {
          top: clipRect.top,
          left: clipRect.left,
          width: clipRect.width,
          height: clipRect.height
        };
      } catch (e) {
        console.log(
          "Unable to fetch bounds for element " + selector,
          "warning"
        );
      }
    },
    { selector: selector }
  );
  await capture(page, targetFile, clipRect);
  return Promise.resolve();
}

async function convertImage(fileName) {
  const dirName = path.dirname(fileName);
  let newFileName = path.basename(fileName);
  const aFileName = newFileName.split(".");
  newFileName = aFileName[0];

  gm(fileName).setFormat("gif");

  fs.move(fileName, path.resolve("./_backups/" + newFileName + ".gif"), err => {
    if (err) console.error(err);
  });
  return Promise.resolve();
}

async function captureBanner(page, link, bannerDelay = 15000) {
  const fileName =
    path.resolve("./dist/" + link.split("/").pop()) + "." + ORIGINAL_FORMAT;
  await page.open(link + "/index.html");
  await page.includeJs(path.resolve("./_common/js/jquery.min.js"));
  await timeout(15000);
  await captureSelector(page, fileName, "#ad");
  await convertImage(fileName);
  return Promise.resolve();
}

async function captureAllBanners(page, list, bannerDelay = 15000) {
  console.log("capture all");
  for (let i = 0; i < list.length; i++) {
    await captureBanner(page, list[i], bannerDelay);
  }
  return Promise.resolve();
}

(async function() {
  removeDir(path.resolve("./_backups"));
  const banners = glob.sync("./dist/{EN,FR}");
  if (banners.length > 2) {
    banners.shift();
  }
  let links = [];

  const bannerLinks = banners.map(dir => {
    let aDir = dir.split("/");
    let lang = aDir[2];
    let bannerName = aDir[3];

    let bannerDirs = glob.sync(`./dist/${lang}/*`);

    links = links.concat(
      bannerDirs.map(dir => {
        let aDir = dir.split("/");
        let bannerName = aDir[3];
        return `${dir}`;
      })
    );
  });

  const instance = await phantom.create();
  const page = await instance.createPage();

  await page.on("onResourceRequested", function(requestData) {
    console.info("Requesting", requestData.url);
  });

  //await captureBanner(page, links[0]);
  await captureAllBanners(page, links);
  await instance.exit();
})();
