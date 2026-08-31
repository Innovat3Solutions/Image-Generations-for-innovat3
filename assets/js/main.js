(function () {
  "use strict";

  /* Solid nav once the page scrolls past the top sentinel */
  var nav = document.getElementById("site-nav");
  var sentinel = document.getElementById("nav-sentinel");
  if (nav && sentinel && "IntersectionObserver" in window) {
    new IntersectionObserver(function (entries) {
      nav.classList.toggle("is-solid", !entries[0].isIntersecting);
    }).observe(sentinel);
  } else if (nav) {
    nav.classList.add("is-solid");
  }

  /* Mobile menu */
  var toggle = document.getElementById("nav-toggle");
  var menu = document.getElementById("mobile-menu");
  if (toggle && menu) {
    toggle.addEventListener("click", function () {
      var open = toggle.getAttribute("aria-expanded") === "true";
      toggle.setAttribute("aria-expanded", String(!open));
      toggle.setAttribute("aria-label", open ? "Open menu" : "Close menu");
      menu.hidden = open;
    });
    menu.addEventListener("click", function (event) {
      if (event.target.closest("a")) {
        toggle.setAttribute("aria-expanded", "false");
        toggle.setAttribute("aria-label", "Open menu");
        menu.hidden = true;
      }
    });
  }

  /* Lazy-load video player iframes as they approach the viewport */
  var frames = document.querySelectorAll("iframe[data-src]");
  function loadFrame(frame) {
    frame.src = frame.getAttribute("data-src");
    frame.removeAttribute("data-src");
  }
  if ("IntersectionObserver" in window) {
    var frameObserver = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            loadFrame(entry.target);
            frameObserver.unobserve(entry.target);
          }
        });
      },
      { rootMargin: "400px 0px" }
    );
    frames.forEach(function (frame) { frameObserver.observe(frame); });
  } else {
    frames.forEach(loadFrame);
  }

  /* Scroll reveal (CSS handles reduced motion by never hiding .reveal) */
  var revealTargets = document.querySelectorAll(".reveal");
  if ("IntersectionObserver" in window) {
    var revealObserver = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            revealObserver.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.15, rootMargin: "0px 0px -40px" }
    );
    revealTargets.forEach(function (el) { revealObserver.observe(el); });
  } else {
    revealTargets.forEach(function (el) { el.classList.add("is-visible"); });
  }

  /* Contact form: validate, then hand off to the visitor's email app */
  var form = document.getElementById("contact-form");
  if (form) {
    form.addEventListener("submit", function (event) {
      event.preventDefault();
      var valid = true;
      ["cf-name", "cf-email", "cf-message"].forEach(function (id) {
        var input = document.getElementById(id);
        var field = input.closest(".field");
        var error = field.querySelector(".field-error");
        var ok = input.checkValidity() && input.value.trim() !== "";
        field.classList.toggle("has-error", !ok);
        error.hidden = ok;
        if (!ok) valid = false;
      });
      if (!valid) return;

      var name = document.getElementById("cf-name").value.trim();
      var email = document.getElementById("cf-email").value.trim();
      var message = document.getElementById("cf-message").value.trim();
      var subject = "Project request from " + name;
      var body = message + "\n\n" + name + "\n" + email;
      window.location.href =
        "mailto:innovat3solutions@gmail.com?subject=" +
        encodeURIComponent(subject) +
        "&body=" +
        encodeURIComponent(body);
    });
  }

  /* Footer year */
  var year = document.getElementById("year");
  if (year) year.textContent = String(new Date().getFullYear());
})();
