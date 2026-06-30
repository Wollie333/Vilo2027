/* ============================================================
   OCEANS VIEW — shared interactions
   ============================================================ */
(function () {
  "use strict";

  /* nav solid on scroll */
  var nav = document.querySelector(".nav");
  function onScroll() {
    if (!nav) return;
    var over = nav.classList.contains("over");
    var th = over ? Math.min(window.innerHeight * 0.65, 520) : 16;
    nav.classList.toggle("solid", window.scrollY > th);
    nav.classList.toggle("float", window.scrollY <= th);
  }
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  /* mobile nav */
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

  /* reveal on scroll (rect-based + safety) */
  var reveals = [].slice.call(document.querySelectorAll(".reveal"));
  function checkReveals() {
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
    checkReveals();
    window.addEventListener("scroll", checkReveals, { passive: true });
    window.addEventListener("resize", checkReveals);
    window.addEventListener("load", checkReveals);
    setTimeout(function () {
      reveals.forEach(function (el) {
        el.classList.add("in");
      });
      reveals.length = 0;
    }, 2300);
  }

  /* hero parallax */
  var px = document.querySelectorAll("[data-parallax]");
  if (
    px.length &&
    matchMedia("(prefers-reduced-motion: no-preference)").matches
  ) {
    var ticking = false;
    function run() {
      var y = window.scrollY;
      px.forEach(function (el) {
        el.style.transform =
          "translate3d(0," +
          y * (parseFloat(el.getAttribute("data-parallax")) || 0.16) +
          "px,0)";
      });
      ticking = false;
    }
    window.addEventListener(
      "scroll",
      function () {
        if (!ticking) {
          requestAnimationFrame(run);
          ticking = true;
        }
      },
      { passive: true },
    );
    run();
  }

  /* lightbox */
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

  /* booking calculator */
  var bf = document.querySelector("[data-booking]");
  if (bf) {
    var money = function (n) {
      return "R" + n.toLocaleString("en-ZA");
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
    var RESORT_FEE = 0; // Oceans View charges no resort fee
    function nights() {
      if (!cin || !cout || !cin.value || !cout.value) return 0;
      var d = Math.round(
        (new Date(cout.value) - new Date(cin.value)) / 86400000,
      );
      return d > 0 ? d : 0;
    }
    function guests() {
      return gsel ? parseInt(gsel.value, 10) || 2 : 2;
    }
    function recalc() {
      var n = nights(),
        g = guests(),
        rt = rate(),
        sub = rt * n,
        total = sub;
      if (el("[data-nights]"))
        el("[data-nights]").textContent = n + (n === 1 ? " night" : " nights");
      if (el("[data-ratenights]"))
        el("[data-ratenights]").textContent =
          money(rt) + " × " + n + (n === 1 ? " night" : " nights");
      if (el("[data-sub]")) el("[data-sub]").textContent = money(sub);
      if (el("[data-total]")) el("[data-total]").textContent = money(total);
      try {
        var st = JSON.parse(localStorage.getItem("ovBooking") || "{}");
        st.checkin = cin && cin.value;
        st.checkout = cout && cout.value;
        st.guests = g;
        st.nights = n;
        st.total = total;
        localStorage.setItem("ovBooking", JSON.stringify(st));
      } catch (e) {}
    }
    [cin, cout, gsel].forEach(function (x) {
      if (x) x.addEventListener("change", recalc);
    });
    recalc();
  }

  /* fill from storage */
  document.querySelectorAll("[data-fill]").forEach(function (el) {
    try {
      var d = JSON.parse(localStorage.getItem("ovBooking") || "{}");
      var k = el.getAttribute("data-fill");
      if (d[k] != null && d[k] !== "") el.textContent = d[k];
    } catch (e) {}
  });

  /* form -> navigate */
  document.querySelectorAll("[data-go]").forEach(function (f) {
    f.addEventListener("submit", function (e) {
      e.preventDefault();
      window.location.href = f.getAttribute("data-go");
    });
  });

  /* availability bar -> rooms */
  document.querySelectorAll("[data-avail]").forEach(function (f) {
    f.addEventListener("submit", function (e) {
      e.preventDefault();
      try {
        var ci = f.querySelector('[name="checkin"]'),
          co = f.querySelector('[name="checkout"]'),
          gu = f.querySelector('[name="guests"]');
        var b = JSON.parse(localStorage.getItem("ovBooking") || "{}");
        if (ci) b.checkin = ci.value;
        if (co) b.checkout = co.value;
        if (gu) b.guests = parseInt(gu.value, 10);
        localStorage.setItem("ovBooking", JSON.stringify(b));
      } catch (e2) {}
      window.location.href = f.getAttribute("data-avail") || "Rooms.html";
    });
  });
})();
