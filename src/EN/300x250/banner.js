import { getElements, getElement } from "common/getElements";

(function() {
  var elements = {};
  var clickarea = document.getElementById("clickarea");

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
  }

  function rollout() {
  }

  function animate() {
  }
})();
