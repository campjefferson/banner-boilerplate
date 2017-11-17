let bannerElements = {};

export function getElements(
  selector = ".ad-element",
  obj = window.bannerElements || bannerElements
) {
  Array.prototype.slice
    .call(document.querySelectorAll(selector))
    .forEach(element => {
      Array.prototype.slice.call(element.classList).forEach(elClass => {
        if (!obj[elClass]) {
          obj[elClass] = element;
        }
      });
    });
  bannerElements = obj;
  return obj;
}

export function getElement(id) {
  return bannerElements[id];
}
