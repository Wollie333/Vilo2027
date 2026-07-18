/* ATELIER (Hotel v2) — Tweaks panel */
(function () {
  "use strict";
  var root = document.documentElement;
  var OPTS = {
    theme: [
      { v: "persimmon", label: "Sand" },
      { v: "cobalt", label: "Slate" },
      { v: "olive", label: "Sage" },
    ],
    font: [
      { v: "grotesk", label: "Clean" },
      { v: "syne", label: "Editorial" },
    ],
    shape: [
      { v: "round", label: "Round" },
      { v: "edge", label: "Edge" },
    ],
  };
  var attr = { theme: "data-theme", font: "data-font", shape: "data-shape" };
  var panel = document.createElement("div");
  panel.className = "atweaks";
  function seg(k) {
    return (
      '<div class="aseg" data-key="' +
      k +
      '">' +
      OPTS[k]
        .map(function (o) {
          return '<button data-v="' + o.v + '">' + o.label + "</button>";
        })
        .join("") +
      "</div>"
    );
  }
  panel.innerHTML =
    '<div class="atweaks-h"><b>Tweaks</b><button class="atweaks-x" aria-label="Close"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg></button></div>' +
    '<div class="atweaks-l">Palette</div>' +
    seg("theme") +
    '<div class="atweaks-l">Display</div>' +
    seg("font") +
    '<div class="atweaks-l">Shape</div>' +
    seg("shape") +
    '<div class="atweaks-l">Colours</div><div class="asw"><span class="s" style="background:var(--site-accent)"></span><span class="s" style="background:var(--site-secondary)"></span><span class="s" style="background:var(--site-pop)"></span><span class="s" style="background:var(--site-ink)"></span></div>';
  document.body.appendChild(panel);
  function sync() {
    panel.querySelectorAll(".aseg").forEach(function (s) {
      var k = s.getAttribute("data-key"),
        cur = root.getAttribute(attr[k]) || OPTS[k][0].v;
      s.querySelectorAll("button").forEach(function (b) {
        b.classList.toggle("on", b.getAttribute("data-v") === cur);
      });
    });
  }
  function setT(k, v) {
    root.setAttribute(attr[k], v);
    var t = {};
    try {
      t = JSON.parse(localStorage.getItem("merTweaks") || "{}");
    } catch (e) {}
    t[k] = v;
    try {
      localStorage.setItem("merTweaks", JSON.stringify(t));
    } catch (e) {}
    try {
      window.parent.postMessage(
        { type: "__edit_mode_set_keys", edits: t },
        "*",
      );
    } catch (e) {}
    sync();
  }
  panel.querySelectorAll(".aseg").forEach(function (s) {
    var k = s.getAttribute("data-key");
    s.querySelectorAll("button").forEach(function (b) {
      b.addEventListener("click", function () {
        setT(k, b.getAttribute("data-v"));
      });
    });
  });
  panel.querySelector(".atweaks-x").addEventListener("click", function () {
    panel.classList.remove("show");
    try {
      window.parent.postMessage({ type: "__edit_mode_dismissed" }, "*");
    } catch (e) {}
  });
  window.addEventListener("message", function (ev) {
    var d = ev.data || {};
    if (d.type === "__activate_edit_mode") {
      panel.classList.add("show");
      sync();
    } else if (d.type === "__deactivate_edit_mode")
      panel.classList.remove("show");
  });
  try {
    window.parent.postMessage({ type: "__edit_mode_available" }, "*");
  } catch (e) {}
  sync();
})();
