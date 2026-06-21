/* site.js — header scroll state + subtle hero parallax (reduced-motion safe).
   nav.js (reveals, mobile nav, year) and live.js (live feed) are untouched. */
(function () {
  var head = document.querySelector('.site-head');
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function onScroll() {
    if (head) head.classList.toggle('scrolled', window.scrollY > 24);
  }
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });

  if (reduce) return;

  // Subtle parallax: elements with [data-parallax] shift their <img> slowly.
  var items = [].slice.call(document.querySelectorAll('[data-parallax]'));
  if (!items.length) return;
  var ticking = false;

  function frame() {
    var vh = window.innerHeight;
    items.forEach(function (el) {
      var img = el.querySelector('img');
      if (!img) return;
      var r = el.getBoundingClientRect();
      if (r.bottom < -200 || r.top > vh + 200) return;
      var speed = parseFloat(el.getAttribute('data-parallax')) || 0.14;
      var center = r.top + r.height / 2;
      var shift = (center - vh / 2) * -speed;
      img.style.transform = 'translate3d(0,' + shift.toFixed(1) + 'px,0) scale(1.12)';
    });
    ticking = false;
  }
  function req() { if (!ticking) { ticking = true; requestAnimationFrame(frame); } }
  window.addEventListener('scroll', req, { passive: true });
  window.addEventListener('resize', req, { passive: true });
  req();
})();
