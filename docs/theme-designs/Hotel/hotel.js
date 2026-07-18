/* ATELIER (Hotel v2) — interactions */
(function () {
  "use strict";
  var nav =
      document.querySelector(".tb-nav") || document.querySelector(".sb-nav"),
    burger = document.querySelector(".burger");
  function toggle() {
    if (nav) {
      var o = nav.classList.toggle("open");
      document.body.style.overflow = o ? "hidden" : "";
    }
  }
  if (burger) burger.addEventListener("click", toggle);
  if (nav)
    nav.querySelectorAll("a").forEach(function (a) {
      a.addEventListener("click", function () {
        nav.classList.remove("open");
        document.body.style.overflow = "";
      });
    });

  var reveals = [].slice.call(document.querySelectorAll(".reveal"));
  function check() {
    var vh = window.innerHeight || document.documentElement.clientHeight;
    for (var i = reveals.length - 1; i >= 0; i--) {
      var r = reveals[i].getBoundingClientRect();
      if (r.top < vh * 0.93 && r.bottom > 0) {
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
    }, 2300);
  }

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
        var st = JSON.parse(localStorage.getItem("merBooking") || "{}");
        st.checkin = cin && cin.value;
        st.checkout = cout && cout.value;
        st.guests = g;
        st.nights = n;
        st.total = sub;
        localStorage.setItem("merBooking", JSON.stringify(st));
      } catch (e) {}
    }
    [cin, cout, gsel].forEach(function (x) {
      if (x) x.addEventListener("change", recalc);
    });
    recalc();
  }

  document.querySelectorAll("[data-fill]").forEach(function (el) {
    try {
      var d = JSON.parse(localStorage.getItem("merBooking") || "{}");
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
        var b = JSON.parse(localStorage.getItem("merBooking") || "{}");
        if (ci) b.checkin = ci.value;
        if (co) b.checkout = co.value;
        if (gu) b.guests = parseInt(gu.value, 10);
        localStorage.setItem("merBooking", JSON.stringify(b));
      } catch (e2) {}
      window.location.href = f.getAttribute("data-avail") || "Rooms.html";
    });
  });
})();
