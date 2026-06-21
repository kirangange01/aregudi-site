/* =====================================================================
   Aré Guḍi · immersive home — scroll choreography (GSAP ScrollTrigger)
   Drives the grove camera, the journey moments, the horizontal
   showcase, and the finale glow.
   ===================================================================== */
(function () {
  'use strict';
  if (!window.gsap || !window.ScrollTrigger) return;
  gsap.registerPlugin(ScrollTrigger);

  var G = window.GROVE;                       /* may be missing if no WebGL */
  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* hero entrance is pure CSS (see .ihero .rise keyframes) so the page
     never depends on JS to become readable */

  /* hero text recedes as the camera starts moving */
  gsap.to('.ihero .hero-inner', {
    autoAlpha: 0, y: -70, ease: 'none',
    scrollTrigger: { trigger: '.journey', start: 'top bottom', end: 'top 45%', scrub: true }
  });

  /* ----------------------- the push into the grove ------------------- */
  if (G) {
    gsap.to(G.cam, {
      z: -146, y: 3.1, ease: 'none',
      scrollTrigger: { trigger: '.journey', start: 'top bottom', end: 'bottom top', scrub: 1.2 }
    });
  }

  /* journey statements fade through */
  document.querySelectorAll('.moment').forEach(function (m) {
    var inner = m.querySelector('.m-inner');
    gsap.fromTo(inner, { autoAlpha: 0, y: 50 }, {
      autoAlpha: 1, y: 0, ease: 'none',
      scrollTrigger: { trigger: m, start: 'top 75%', end: 'top 40%', scrub: true }
    });
    gsap.to(inner, {
      autoAlpha: 0, y: -50, ease: 'none',
      scrollTrigger: { trigger: m, start: 'bottom 60%', end: 'bottom 25%', scrub: true }
    });
  });

  /* ----------------------- horizontal showcase ----------------------- */
  var track = document.querySelector('.track');
  var showcase = document.querySelector('.showcase');
  function travel() {
    return Math.max(0, track.scrollWidth - window.innerWidth);
  }
  var horiz = gsap.to(track, {
    x: function () { return -travel(); },
    ease: 'none',
    scrollTrigger: {
      trigger: showcase,
      start: 'top top',
      end: function () { return '+=' + (travel() + window.innerHeight * 0.5); },
      pin: true,
      scrub: 1.1,
      invalidateOnRefresh: true
    }
  });

  /* cards rise in sequentially as they enter from the right */
  if (!reduced) {
    document.querySelectorAll('.fcard').forEach(function (c) {
      gsap.from(c, {
        y: 120, autoAlpha: 0, duration: 0.85, ease: 'power3.out',
        scrollTrigger: { trigger: c, containerAnimation: horiz, start: 'left 95%' }
      });
    });
  }

  /* camera keeps a slow drift while pinned */
  if (G) {
    gsap.to(G.cam, {
      z: '-=6', ease: 'none',
      scrollTrigger: { trigger: showcase, start: 'top top', end: 'bottom top', scrub: 1.4 }
    });
  }

  /* ------------------------------ finale ------------------------------ */
  if (G) {
    gsap.to(G.cam, {
      rx: 0.20, y: 4.6, ease: 'none',
      scrollTrigger: { trigger: '.finale', start: 'top bottom', end: 'bottom bottom', scrub: 1.2 }
    });
    gsap.to(G.glowMat, {
      opacity: 1, ease: 'none',
      scrollTrigger: { trigger: '.finale', start: 'top bottom', end: 'bottom bottom', scrub: true }
    });
  }
  if (!reduced) {
    gsap.from('.finale .rise', {
      y: 50, autoAlpha: 0, duration: 1, stagger: 0.12, ease: 'power3.out',
      scrollTrigger: { trigger: '.finale', start: 'top 60%' }
    });
  }
})();
