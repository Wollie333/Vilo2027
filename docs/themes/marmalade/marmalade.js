/* ============================================================
   Marmalade House — shared behaviour + Tweaks panel
   ============================================================ */
(function () {
  "use strict";
  document.documentElement.classList.add("js");

  /* ---------- nav: solid on scroll (for .over heroes) ---------- */
  var nav = document.querySelector(".nav");
  function onScroll() {
    if (!nav) return;
    var over = nav.classList.contains("over");
    var th = over ? Math.min(window.innerHeight * 0.6, 460) : 8;
    nav.classList.toggle("scrolled", window.scrollY > th);
    if (over) {
      nav.style.background =
        window.scrollY > th
          ? "color-mix(in srgb,var(--site-bg) 92%,transparent)"
          : "transparent";
      nav.style.backdropFilter =
        window.scrollY > th ? "saturate(1.3) blur(12px)" : "none";
      nav.style.borderBottomColor =
        window.scrollY > th ? "var(--site-line)" : "transparent";
    }
  }
  if (nav) {
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
  }

  /* ---------- mobile menu ---------- */
  var mnav = document.querySelector(".mnav");
  function setMenu(o) {
    if (mnav) {
      mnav.classList.toggle("open", o);
      document.body.style.overflow = o ? "hidden" : "";
    }
  }
  document.querySelectorAll("[data-burger]").forEach(function (b) {
    b.addEventListener("click", function () {
      setMenu(true);
    });
  });
  document.querySelectorAll("[data-mclose]").forEach(function (b) {
    b.addEventListener("click", function () {
      setMenu(false);
    });
  });
  if (mnav)
    mnav.querySelectorAll("a").forEach(function (a) {
      a.addEventListener("click", function () {
        setMenu(false);
      });
    });

  /* ---------- reveal on scroll ---------- */
  var reveals = [].slice.call(document.querySelectorAll(".reveal"));
  function check() {
    var vh = window.innerHeight || document.documentElement.clientHeight;
    for (var i = reveals.length - 1; i >= 0; i--) {
      var r = reveals[i].getBoundingClientRect();
      if (r.top < vh * 0.92 && r.bottom > 0) {
        reveals[i].classList.add("in");
        reveals.splice(i, 1);
      }
    }
  }
  if (reveals.length) {
    check();
    window.addEventListener("scroll", check, { passive: true });
    window.addEventListener("resize", check);
    window.addEventListener("load", check);
    setTimeout(function () {
      reveals.forEach(function (e) {
        e.classList.add("in");
      });
      reveals.length = 0;
    }, 2200);
  }

  /* ---------- lightbox ---------- */
  var lb = document.querySelector("[data-lightbox]");
  if (lb) {
    var img = lb.querySelector("img");
    document.querySelectorAll("[data-lb]").forEach(function (el) {
      el.style.cursor = "zoom-in";
      el.addEventListener("click", function () {
        img.src = el.getAttribute("data-lb");
        lb.classList.add("open");
        document.body.style.overflow = "hidden";
      });
    });
    lb.addEventListener("click", function () {
      lb.classList.remove("open");
      document.body.style.overflow = "";
    });
  }

  /* ---------- booking calculator ---------- */
  var bf = document.querySelector("[data-booking]");
  if (bf) {
    var money = function (n) {
      return "R" + Number(n).toLocaleString("en-ZA");
    };
    var rate = function () {
      return parseInt(bf.getAttribute("data-rate"), 10) || 0;
    };
    var cin = bf.querySelector('[name="checkin"]'),
      cout = bf.querySelector('[name="checkout"]'),
      gsel = bf.querySelector('[name="guests"]');
    var el = function (s) {
      return document.querySelector(s);
    };
    function nights() {
      if (!cin || !cout || !cin.value || !cout.value) return 0;
      var d = Math.round(
        (new Date(cout.value) - new Date(cin.value)) / 86400000,
      );
      return d > 0 ? d : 0;
    }
    function recalc() {
      var n = nights(),
        g = gsel ? parseInt(gsel.value, 10) || 2 : 2,
        rt = rate(),
        sub = rt * n;
      if (el("[data-nights]"))
        el("[data-nights]").textContent = n + (n === 1 ? " night" : " nights");
      if (el("[data-ratenights]"))
        el("[data-ratenights]").textContent =
          money(rt) + " × " + n + (n === 1 ? " night" : " nights");
      if (el("[data-sub]")) el("[data-sub]").textContent = money(sub);
      if (el("[data-total]")) el("[data-total]").textContent = money(sub);
      try {
        var st = JSON.parse(localStorage.getItem("mhBooking") || "{}");
        st.checkin = cin && cin.value;
        st.checkout = cout && cout.value;
        st.guests = g;
        st.nights = n;
        st.total = sub;
        localStorage.setItem("mhBooking", JSON.stringify(st));
      } catch (e) {}
    }
    [cin, cout, gsel].forEach(function (x) {
      if (x) x.addEventListener("change", recalc);
    });
    recalc();
  }
  document.querySelectorAll("[data-fill]").forEach(function (el) {
    try {
      var d = JSON.parse(localStorage.getItem("mhBooking") || "{}");
      var k = el.getAttribute("data-fill");
      if (d[k] != null && d[k] !== "") el.textContent = d[k];
    } catch (e) {}
  });
  document.querySelectorAll("[data-go]").forEach(function (f) {
    f.addEventListener("submit", function (e) {
      e.preventDefault();
      window.location.href = f.getAttribute("data-go");
    });
  });
  document.querySelectorAll("[data-avail]").forEach(function (f) {
    f.addEventListener("submit", function (e) {
      e.preventDefault();
      try {
        var ci = f.querySelector('[name="checkin"]'),
          co = f.querySelector('[name="checkout"]'),
          gu = f.querySelector('[name="guests"]');
        var b = JSON.parse(localStorage.getItem("mhBooking") || "{}");
        if (ci) b.checkin = ci.value;
        if (co) b.checkout = co.value;
        if (gu) b.guests = parseInt(gu.value, 10);
        localStorage.setItem("mhBooking", JSON.stringify(b));
      } catch (e2) {}
      window.location.href =
        f.getAttribute("data-avail") || "Search Results.html";
    });
  });

  /* ---------- checkout helpers ---------- */
  window.mhQty = function (btn, d) {
    var s = btn.parentNode.querySelector("span");
    var n = Math.max(0, +s.textContent + d);
    s.textContent = n;
  };
  window.mhAddGuest = function (btn) {
    var box = btn.previousElementSibling;
    var r = box.firstElementChild.cloneNode(true);
    var lbl = r.querySelector("label");
    if (lbl)
      lbl.childNodes[0].textContent =
        "Guest " + (box.children.length + 2) + " — full name";
    r.querySelectorAll("input").forEach(function (i) {
      i.value = "";
    });
    box.appendChild(r);
  };

  /* ---------- Tweaks panel ---------- */
  var root = document.documentElement;
  var OPTS = {
    theme: [
      { v: "marmalade", label: "Marmalade" },
      { v: "damson", label: "Damson" },
      { v: "sage", label: "Sage" },
    ],
    font: [
      { v: "homely", label: "Homely" },
      { v: "classic", label: "Classic" },
    ],
    shape: [
      { v: "soft", label: "Soft" },
      { v: "sharp", label: "Sharp" },
    ],
  };
  var attr = { theme: "data-theme", font: "data-font", shape: "data-shape" };
  var panel = document.createElement("div");
  panel.className = "mtweaks";
  function seg(k) {
    return (
      '<div class="mseg" data-key="' +
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
    '<div class="mtweaks-h"><b>Tweaks</b><button class="mtweaks-x" aria-label="Close"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg></button></div>' +
    '<div class="mtweaks-l">Palette</div>' +
    seg("theme") +
    '<div class="mtweaks-l">Display font</div>' +
    seg("font") +
    '<div class="mtweaks-l">Corners</div>' +
    seg("shape") +
    '<div class="mtweaks-l">Colours</div><div class="msw"><span class="s" style="background:var(--site-accent)"></span><span class="s" style="background:var(--site-secondary)"></span><span class="s" style="background:var(--site-seal)"></span><span class="s" style="background:var(--site-note)"></span></div>';
  document.body.appendChild(panel);
  function sync() {
    panel.querySelectorAll(".mseg").forEach(function (s) {
      var k = s.getAttribute("data-key");
      var cur = root.getAttribute(attr[k]) || OPTS[k][0].v;
      s.querySelectorAll("button").forEach(function (b) {
        b.classList.toggle("on", b.getAttribute("data-v") === cur);
      });
    });
  }
  function setT(k, v) {
    root.setAttribute(attr[k], v);
    var t = {};
    try {
      t = JSON.parse(localStorage.getItem("mhTweaks") || "{}");
    } catch (e) {}
    t[k] = v;
    try {
      localStorage.setItem("mhTweaks", JSON.stringify(t));
    } catch (e) {}
    try {
      window.parent.postMessage(
        { type: "__edit_mode_set_keys", edits: t },
        "*",
      );
    } catch (e) {}
    sync();
  }
  panel.querySelectorAll(".mseg").forEach(function (s) {
    var k = s.getAttribute("data-key");
    s.querySelectorAll("button").forEach(function (b) {
      b.addEventListener("click", function () {
        setT(k, b.getAttribute("data-v"));
      });
    });
  });
  panel.querySelector(".mtweaks-x").addEventListener("click", function () {
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
