// Shared runtime. Deliberately tiny: an IntersectionObserver and nothing else.
// No scroll listener anywhere — a scroll handler that reads layout is the most
// likely cause of a 60fps failure (SPEC §4).
(function () {
  'use strict';

  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function revealAll() {
    var els = document.querySelectorAll('.reveal');
    for (var i = 0; i < els.length; i++) els[i].classList.add('is-in');
  }

  if (reduced || !('IntersectionObserver' in window)) {
    revealAll();
    return;
  }

  // Stagger is assigned per group so siblings cascade (SPEC §1.3).
  var groups = document.querySelectorAll('[data-stagger]');
  for (var g = 0; g < groups.length; g++) {
    var kids = groups[g].querySelectorAll(':scope > .reveal');
    var step = parseInt(groups[g].getAttribute('data-stagger'), 10) || 72;
    for (var k = 0; k < kids.length; k++) {
      kids[k].style.setProperty('--reveal-delay', k * step + 'ms');
    }
  }

  var io = new IntersectionObserver(
    function (entries) {
      for (var i = 0; i < entries.length; i++) {
        if (entries[i].isIntersecting) {
          entries[i].target.classList.add('is-in');
          io.unobserve(entries[i].target); // nothing animates twice
        }
      }
    },
    // Fire slightly before the element reaches the fold so the reveal reads as
    // a consequence of scrolling, not as a pop-in after arrival.
    { rootMargin: '0px 0px -12% 0px', threshold: 0.01 }
  );

  var targets = document.querySelectorAll('.reveal');
  for (var t = 0; t < targets.length; t++) {
    // Anything already on screen at load reveals immediately — no entrance
    // animation may delay the LCP paint (SPEC §4).
    var r = targets[t].getBoundingClientRect();
    if (r.top < window.innerHeight * 0.9) targets[t].classList.add('is-in');
    else io.observe(targets[t]);
  }
})();
