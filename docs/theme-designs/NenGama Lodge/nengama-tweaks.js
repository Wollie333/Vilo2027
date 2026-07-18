/* ============================================================
   NenGama Lodge — Tweaks panel (vanilla, host-protocol aware)
   ============================================================ */
(function () {
  "use strict";
  var root = document.documentElement;

  var OPTIONS = {
    theme: [
      { v: "savanna", label: "Savanna" },
      { v: "ember", label: "Ember" },
      { v: "twilight", label: "Twilight" },
    ],
    font: [
      { v: "classic", label: "Classic" },
      { v: "grand", label: "Grand" },
    ],
  };

  function current(key, fallback) {
    var a = root.getAttribute("key" === "theme" ? "data-theme" : "data-font");
    a = root.getAttribute(key === "theme" ? "data-theme" : "data-font");
    return a || fallback;
  }

  // ---- styles ----
  var css = document.createElement("style");
  css.textContent =
    ".ntweaks{position:fixed;right:22px;bottom:22px;z-index:120;width:264px;background:var(--surface);" +
    "border:1px solid var(--line);border-radius:12px;box-shadow:0 30px 70px -28px rgba(20,16,10,.5);" +
    "padding:18px;font-family:var(--sans);color:var(--ink);transform:translateY(16px) scale(.98);opacity:0;" +
    "pointer-events:none;transition:opacity .3s,transform .3s}" +
    ".ntweaks.show{opacity:1;transform:none;pointer-events:auto}" +
    ".ntweaks-h{display:flex;align-items:center;justify-content:space-between;margin-bottom:16px}" +
    ".ntweaks-h b{font-family:var(--serif);font-weight:600;font-size:1.3rem}" +
    ".ntweaks-x{background:none;border:none;color:var(--ink-soft);cursor:pointer;padding:4px;border-radius:6px;line-height:0}" +
    ".ntweaks-x:hover{background:var(--bg-2);color:var(--ink)}" +
    ".ntweaks-l{font-size:10px;font-weight:500;letter-spacing:.18em;text-transform:uppercase;color:var(--ink-soft);margin:14px 0 8px}" +
    ".ntweaks-seg{display:flex;gap:6px;background:var(--bg-2);padding:4px;border-radius:8px}" +
    ".ntweaks-seg button{flex:1;border:none;background:none;cursor:pointer;font-family:var(--sans);font-size:12px;font-weight:500;" +
    "color:var(--ink-soft);padding:8px 4px;border-radius:6px;transition:background .2s,color .2s;letter-spacing:.02em}" +
    ".ntweaks-seg button.on{background:var(--surface);color:var(--ink);box-shadow:0 2px 8px -3px rgba(20,16,10,.3)}" +
    ".ntweaks-sw{display:flex;gap:8px}.ntweaks-sw .s{width:30px;height:30px;border-radius:50%;border:1px solid var(--line);cursor:default}";
  document.head.appendChild(css);

  // ---- panel ----
  var panel = document.createElement("div");
  panel.className = "ntweaks";
  panel.setAttribute("aria-label", "Tweaks");
  function seg(key) {
    return (
      '<div class="ntweaks-seg" data-key="' +
      key +
      '">' +
      OPTIONS[key]
        .map(function (o) {
          return '<button data-v="' + o.v + '">' + o.label + "</button>";
        })
        .join("") +
      "</div>"
    );
  }
  panel.innerHTML =
    '<div class="ntweaks-h"><b>Tweaks</b>' +
    '<button class="ntweaks-x" aria-label="Close">' +
    '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg></button></div>' +
    '<div class="ntweaks-l">Palette</div>' +
    seg("theme") +
    '<div class="ntweaks-l">Typeface</div>' +
    seg("font") +
    '<div class="ntweaks-l">Accent preview</div>' +
    '<div class="ntweaks-sw"><span class="s" style="background:var(--accent)"></span><span class="s" style="background:var(--gold)"></span><span class="s" style="background:var(--green)"></span><span class="s" style="background:var(--ink)"></span></div>';
  document.body.appendChild(panel);

  function sync() {
    panel.querySelectorAll(".ntweaks-seg").forEach(function (seg) {
      var key = seg.getAttribute("data-key");
      var cur =
        root.getAttribute(key === "theme" ? "data-theme" : "data-font") ||
        OPTIONS[key][0].v;
      seg.querySelectorAll("button").forEach(function (b) {
        b.classList.toggle("on", b.getAttribute("data-v") === cur);
      });
    });
  }

  function setTweak(key, value) {
    root.setAttribute(key === "theme" ? "data-theme" : "data-font", value);
    var t = {};
    try {
      t = JSON.parse(localStorage.getItem("nengamaTweaks") || "{}");
    } catch (e) {}
    t[key] = value;
    try {
      localStorage.setItem("nengamaTweaks", JSON.stringify(t));
    } catch (e) {}
    try {
      window.parent.postMessage(
        { type: "__edit_mode_set_keys", edits: t },
        "*",
      );
    } catch (e) {}
    sync();
  }

  panel.querySelectorAll(".ntweaks-seg").forEach(function (seg) {
    var key = seg.getAttribute("data-key");
    seg.querySelectorAll("button").forEach(function (b) {
      b.addEventListener("click", function () {
        setTweak(key, b.getAttribute("data-v"));
      });
    });
  });

  function show() {
    panel.classList.add("show");
    sync();
  }
  function hide() {
    panel.classList.remove("show");
  }

  panel.querySelector(".ntweaks-x").addEventListener("click", function () {
    hide();
    try {
      window.parent.postMessage({ type: "__edit_mode_dismissed" }, "*");
    } catch (e) {}
  });

  // ---- host protocol: listener BEFORE announce ----
  window.addEventListener("message", function (ev) {
    var d = ev.data || {};
    if (d.type === "__activate_edit_mode") show();
    else if (d.type === "__deactivate_edit_mode") hide();
  });
  try {
    window.parent.postMessage({ type: "__edit_mode_available" }, "*");
  } catch (e) {}

  sync();
})();
