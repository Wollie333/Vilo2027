/* ============================================================
   NenGama Lodge — shared interactions
   ============================================================ */
(function () {
  "use strict";

  /* ---- NAV: solid on scroll ---- */
  var nav = document.querySelector(".nav");
  function onScroll() {
    if (!nav) return;
    var over = nav.classList.contains("over-hero");
    var threshold = over ? Math.min(window.innerHeight * 0.7, 560) : 20;
    nav.classList.toggle("solid", window.scrollY > threshold);
  }
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  /* ---- MOBILE NAV ---- */
  var mnav = document.querySelector(".mnav");
  function openM() {
    if (mnav) {
      mnav.classList.add("open");
      document.body.style.overflow = "hidden";
    }
  }
  function closeM() {
    if (mnav) {
      mnav.classList.remove("open");
      document.body.style.overflow = "";
    }
  }
  document.querySelectorAll("[data-burger]").forEach(function (b) {
    b.addEventListener("click", openM);
  });
  document.querySelectorAll("[data-mclose]").forEach(function (b) {
    b.addEventListener("click", closeM);
  });
  if (mnav)
    mnav.querySelectorAll("a").forEach(function (a) {
      a.addEventListener("click", closeM);
    });

  /* ---- SCROLL REVEAL (rect-based; robust without paint/IO) ---- */
  var reveals = [].slice.call(
    document.querySelectorAll(".reveal, .reveal-img"),
  );
  function checkReveals() {
    var vh = window.innerHeight || document.documentElement.clientHeight;
    for (var i = reveals.length - 1; i >= 0; i--) {
      var r = reveals[i].getBoundingClientRect();
      if (r.top < vh * 0.9 && r.bottom > 0) {
        reveals[i].classList.add("in");
        reveals.splice(i, 1);
      }
    }
  }
  if (reveals.length) {
    checkReveals();
    window.addEventListener("scroll", checkReveals, { passive: true });
    window.addEventListener("resize", checkReveals);
    window.addEventListener("load", checkReveals);
    // safety: content must never stay hidden (backgrounded tab, print, IO gaps)
    setTimeout(function () {
      reveals.forEach(function (el) {
        el.classList.add("in");
      });
      reveals.length = 0;
    }, 2400);
  }

  /* ---- HERO / HEADER PARALLAX ---- */
  var parallax = document.querySelectorAll("[data-parallax]");
  if (
    parallax.length &&
    window.matchMedia("(prefers-reduced-motion: no-preference)").matches
  ) {
    var ticking = false;
    function px() {
      var y = window.scrollY;
      parallax.forEach(function (el) {
        var speed = parseFloat(el.getAttribute("data-parallax")) || 0.18;
        el.style.transform = "translate3d(0," + y * speed + "px,0)";
      });
      ticking = false;
    }
    window.addEventListener(
      "scroll",
      function () {
        if (!ticking) {
          window.requestAnimationFrame(px);
          ticking = true;
        }
      },
      { passive: true },
    );
    px();
  }

  /* ---- LIGHTBOX (gallery) ---- */
  var lb = document.querySelector("[data-lightbox]");
  if (lb) {
    var lbImg = lb.querySelector("img");
    document.querySelectorAll("[data-lb-src]").forEach(function (el) {
      el.style.cursor = "zoom-in";
      el.addEventListener("click", function () {
        lbImg.src = el.getAttribute("data-lb-src");
        lb.classList.add("open");
        document.body.style.overflow = "hidden";
      });
    });
    lb.addEventListener("click", function () {
      lb.classList.remove("open");
      document.body.style.overflow = "";
    });
  }

  /* ---- BOOKING CALCULATOR ---- */
  var bf = document.querySelector("[data-booking]");
  if (bf) {
    var fmt = function (n) {
      return "R" + n.toLocaleString("en-ZA");
    };
    var rate = parseInt(bf.getAttribute("data-rate"), 10) || 0;
    var cin = bf.querySelector('[name="checkin"]');
    var cout = bf.querySelector('[name="checkout"]');
    var guestsSel = bf.querySelector('[name="guests"]');
    var nightsEl = document.querySelector("[data-nights]");
    var subEl = document.querySelector("[data-subtotal]");
    var totalEl = document.querySelector("[data-total]");
    var rateNightsEl = document.querySelector("[data-rate-nights]");
    var levyEl = document.querySelector("[data-levy]");
    var LEVY = 280; // per person per night conservation levy (shown, not a Wielo fee)

    function nights() {
      if (!cin || !cout || !cin.value || !cout.value) return 0;
      var a = new Date(cin.value),
        b = new Date(cout.value);
      var d = Math.round((b - a) / 86400000);
      return d > 0 ? d : 0;
    }
    function guests() {
      return guestsSel ? parseInt(guestsSel.value, 10) || 2 : 2;
    }
    function recalc() {
      var n = nights(),
        g = guests();
      var sub = rate * n;
      var levy = LEVY * g * n;
      var total = sub + levy;
      if (nightsEl) nightsEl.textContent = n + (n === 1 ? " night" : " nights");
      if (rateNightsEl)
        rateNightsEl.textContent =
          fmt(rate) + " × " + n + (n === 1 ? " night" : " nights");
      if (subEl) subEl.textContent = fmt(sub);
      if (levyEl) levyEl.textContent = fmt(levy);
      if (totalEl) totalEl.textContent = fmt(total);
      try {
        localStorage.setItem(
          "nengamaBooking",
          JSON.stringify({
            checkin: cin && cin.value,
            checkout: cout && cout.value,
            guests: g,
            nights: n,
            total: total,
          }),
        );
      } catch (e) {}
    }
    [cin, cout, guestsSel].forEach(function (el) {
      if (el) el.addEventListener("change", recalc);
    });
    recalc();
  }

  /* ---- prefill thank-you / checkout from storage ---- */
  document.querySelectorAll("[data-fill]").forEach(function (el) {
    try {
      var d = JSON.parse(localStorage.getItem("nengamaBooking") || "{}");
      var key = el.getAttribute("data-fill");
      if (d[key] != null && d[key] !== "") el.textContent = d[key];
    } catch (e) {}
  });

  /* ---- form -> navigate (demo) ---- */
  document.querySelectorAll("[data-go]").forEach(function (form) {
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      window.location.href = form.getAttribute("data-go");
    });
  });

  /* ---- TWEAKS PANEL (lightweight, host-protocol aware) ---- */
  var root = document.documentElement;
  try {
    var saved = JSON.parse(localStorage.getItem("nengamaTweaks") || "{}");
    if (saved.theme) root.setAttribute("data-theme", saved.theme);
    if (saved.font) root.setAttribute("data-font", saved.font);
  } catch (e) {}

  window.addEventListener("message", function (ev) {
    var d = ev.data || {};
    if (d.type === "tweaks:set") {
      if (d.key === "theme") root.setAttribute("data-theme", d.value);
      if (d.key === "font") root.setAttribute("data-font", d.value);
      var t = {};
      try {
        t = JSON.parse(localStorage.getItem("nengamaTweaks") || "{}");
      } catch (e) {}
      t[d.key] = d.value;
      try {
        localStorage.setItem("nengamaTweaks", JSON.stringify(t));
      } catch (e) {}
    }
  });
})();
