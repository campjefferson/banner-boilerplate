import { getElements, getElement } from "common/getElements";

(function() {
  var elements = {};
  var clickarea = document.getElementById("clickarea");
  var cta = document.getElementById("cta");

  var domReady = function(callback) {
    document.readyState === "interactive" || document.readyState === "complete"
      ? callback()
      : document.addEventListener("DOMContentLoaded", callback);
  };

  domReady(function() {
    getElements();
    events();
    animate();
  });

  function events() {
    clickarea.addEventListener("mouseover", rollover);
    clickarea.addEventListener("mouseout", rollout);
  }

  function rollover() {
    TweenLite.to(chevron, 0.25, { x: 2 });
  }

  function rollout() {
    TweenLite.to(chevron, 0.25, { x: 0 });
  }

  function animate() {
    TweenLite.from(getElement("copy1"), 0.5, { alpha: 0 });
    TweenLite.to("#background-1", 5, { x: 20 });
    TweenLite.to(getElement("copy1"), 0.5, { alpha: 0, delay: 2 });

    TweenLite.from(frame2, 0.5, { alpha: 0, delay: 2.5 });
    TweenLite.to("#background-2", 5, { x: -20, delay: 2.5 });

    TweenLite.from(frame3, 0.5, { alpha: 0, delay: 5.5 });
    TweenLite.to("#background-3", 5, { x: 20, delay: 5.5 });

    TweenLite.from(frame4, 0.5, { alpha: 0, delay: 8.5 });
    TweenLite.from("#background-4", 5, { scale: 1.1, delay: 8.5 });
    TweenLite.from(getElement("copy2"), 0.5, { alpha: 0, delay: 9 });
    TweenLite.to(getElement("copy2"), 0.5, { alpha: 0, delay: 11.5 });

    TweenLite.from(frame5, 0.5, { alpha: 0, delay: 12 });
    TweenLite.to("#background-5", 3, { x: -20, delay: 12 });
    TweenLite.from(getElement("copy3"), 0.5, { alpha: 0, delay: 12.5 });
    TweenLite.from(cta, 0.5, { alpha: 0, delay: 12.5 });
    TweenLite.from(logo, 0.5, { y: 100, delay: 13 });
  }
})();
