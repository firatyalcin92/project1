// Shared animation for the Part 1 outro / Part 2 intro cards.
const $ = id => document.getElementById(id);
const cl = x => Math.max(0, Math.min(1, x));
const ease = x => 1 - Math.pow(1 - cl(x), 3);
const io = (t, a, d = .5) => ease((t - a) / d);
function rise(el, t, a, d = .55, dist = 40) { const p = io(t, a, d); el.style.opacity = p; el.style.transform = `translateY(${(1 - p) * dist}px)`; }
window.seek = t => {
  $('ring1').style.strokeDashoffset = 1 - io(t, .1, .8); $('ring2').style.strokeDashoffset = 1 - io(t, .35, .8);
  document.querySelectorAll('[data-at]').forEach(el => rise(el, t, +el.dataset.at));
  const ar = $('arrow'); if (ar) ar.style.transform = `translateX(${Math.sin(t * 5) * 14}px)`;
  [1, 2, 3].forEach(i => { const g = $('gl' + i); g.style.left = (540 + Math.sin(t * .4 + i * 2) * 200) + 'px'; g.style.top = (800 + Math.cos(t * .3 + i * 2) * 260) + 'px'; });
  document.body.style.opacity = 1 - io(t, window.DURATION - .35, .35) * (window.FADE_OUT ? 1 : 0);
};
