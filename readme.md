# Banner Boilerplate
Camp Jefferson HTML5 banner creation boilerplate.

## Getting Started
`npm install` to download project dependencies.

You can also edit the `package.json` file and fill details about your project.

```javascript
"name": "banner-boilerplate",
"version": "0.0.1",
"description": "New CJ Banner Creation Boilerplate",
"main": "index.js",
"config": {
    "title": "Banner Boilerplate",
    "prefix": "Banner-Boilerplate",
    "client": "Koodo",
    "stagingEndpoint": "https://api.netlify.com/build_hooks/5a00b9120b79b703b93d0c8c",
    "locales": ["en", "fr"]
}
```

- `name` project name.
- `version` current version of the project.
- `description` a brief description of the project.
- `config`
    - `title` the title to be displayed on the staging link.
    - `prefix` the prefix to be used in the naming convention for the packaged banner.
    - `client` the client the banner belongs to.
    - `locales` the different json sources used as data for banners.

## Usage

### CSS

#### Classes

- `.ad-element` used for every element within the banner.
- `.frame` used to group frames of animation.

#### Variables

- `$bannerWidth` returns the width of the banner in pixels.
- `$bannerHeight` returns the height of the banner in pixels.

#### Mixins

- `@include size($width, $height)` to quickly set the width and height of an element.
- `@include position($x, $y)` to quickly set the x, y co-ordinates of an element. Parameters can also accept `center` as a value.
- `@include koodo-legals($width, $position)` to create a Koodo style legal bubble. You can set the width of the bubble as well as it's orientation with either `left`, `center`, or by default, `right`.
- `@include retina{}` a media query for detecting retina displays.

### Javascript
- `getElement("sprite");` to retrieve a sprite element from a spritesheet.

### Build Commands

- `npm start` to start local dev server.
- `npm run spritesheet` to generate spritesheets from images within the `images/spritesheets/` folder.
- `npm run production` to build and package all banner files.
- `npm run backups` to create backup gifs for all banners.
- `npm run all` to both build, package and create backup gifs for all banners.

## Built With
- SASS
- Handlebars
- ES6
- GSAP TweenLite/TweenMax
- Gulp
- Node