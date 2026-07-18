/* ============================================================
   OCEANS VIEW — Tweaks panel (vanilla, host-protocol aware)
   ============================================================ */
(function () {
  "use strict";
  var root = document.documentElement;
  var OPTS = {
    theme: [
      { v: "lagoon", label: "Lagoon" },
      { v: "riviera", label: "Riviera" },
      { v: "seaglass", label: "Sea Glass" },
    ],
    font: [
      { v: "grotesk", label: "Bricolage" },
      { v: "archivo", label: "Archivo" },
    ],
    shape: [
      { v: "rounded", label: "Rounded" },
      { v: "sharp", label: "Sharp" },
    ],
  };
  var attr = { theme: "data-theme", font: "data-font", shape: "data-shape" };

  var css = document.createElement("style");
  css.textContent = "";
  document.head.appendChild(css);

  var panel = document.createElement("div");
  panel.className = "ovtweaks";
  function seg(key) {
    return (
      '<div class="ovseg" data-key="' +
      key +
      '">' +
      OPTS[key]
        .map(function (o) {
          return '<button data-v="' + o.v + '">' + o.label + "</button>";
        })
        .join("") +
      "</div>"
    );
  }
  panel.innerHTML =
    '<div class="ovtweaks-h"><b>Tweaks</b><button class="ovtweaks-x" aria-label="Close">' +
    '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg></button></div>' +
    '<div class="ovtweaks-l">Palette</div>' +
    seg("theme") +
    '<div class="ovtweaks-l">Display font</div>' +
    seg("font") +
    '<div class="ovtweaks-l">Shape</div>' +
    seg("shape") +
    '<div class="ovtweaks-l">Colours</div>' +
    '<div class="ovsw"><span class="s" style="background:var(--site-accent)"></span><span class="s" style="background:var(--site-secondary)"></span><span class="s" style="background:var(--site-navy)"></span><span class="s" style="background:var(--site-soft-2)"></span></div>';
  document.body.appendChild(panel);

  function sync() {
    panel.querySelectorAll(".ovseg").forEach(function (s) {
      var key = s.getAttribute("data-key");
      var cur = root.getAttribute(attr[key]) || OPTS[key][0].v;
      s.querySelectorAll("button").forEach(function (b) {
        b.classList.toggle("on", b.getAttribute("data-v") === cur);
      });
    });
  }
  function setT(key, val) {
    root.setAttribute(attr[key], val);
    var t = {};
    try {
      t = JSON.parse(localStorage.getItem("ovTweaks") || "{}");
    } catch (e) {}
    t[key] = val;
    try {
      localStorage.setItem("ovTweaks", JSON.stringify(t));
    } catch (e) {}
    try {
      window.parent.postMessage(
        { type: "__edit_mode_set_keys", edits: t },
        "*",
      );
    } catch (e) {}
    sync();
  }
  panel.querySelectorAll(".ovseg").forEach(function (s) {
    var key = s.getAttribute("data-key");
    s.querySelectorAll("button").forEach(function (b) {
      b.addEventListener("click", function () {
        setT(key, b.getAttribute("data-v"));
      });
    });
  });
  panel.querySelector(".ovtweaks-x").addEventListener("click", function () {
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
