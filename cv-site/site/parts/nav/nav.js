// nav — scroll-spy. IntersectionObserver only; no scroll listener anywhere.
// A thin band across the reading area decides which section is "current".
(function () {
  'use strict';
  if (!('IntersectionObserver' in window)) return;

  var links = document.querySelectorAll('.dock-tab[data-spy]');
  var pairs = [];
  for (var i = 0; i < links.length; i++) {
    var href = links[i].getAttribute('href') || '';
    var sec = href.charAt(0) === '#' ? document.getElementById(href.slice(1)) : null;
    if (sec) pairs.push({ link: links[i], el: sec });
  }
  if (!pairs.length) return;

  function activate(link) {
    for (var i = 0; i < pairs.length; i++) {
      if (pairs[i].link === link) pairs[i].link.setAttribute('aria-current', 'page');
      else pairs[i].link.removeAttribute('aria-current');
    }
  }

  var io = new IntersectionObserver(
    function (entries) {
      for (var i = 0; i < entries.length; i++) {
        if (!entries[i].isIntersecting) continue;
        for (var j = 0; j < pairs.length; j++) {
          if (pairs[j].el === entries[i].target) activate(pairs[j].link);
        }
      }
    },
    // Only a ~10% band around 45% of the viewport counts, so at most one
    // section is current and scrubbing backwards reverses it exactly.
    { rootMargin: '-42% 0px -48% 0px', threshold: 0 }
  );

  for (var k = 0; k < pairs.length; k++) io.observe(pairs[k].el);
})();
