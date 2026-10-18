// Flat-illustration living room + a seated couple, rendered as an SVG string per frame.
// room({...}) returns the whole <svg> inner markup. Coordinates are in the 1080x1920 frame.

const PAL = {
  w: { skin: '#eab894', skinD: '#d79d78', hair: '#4a2f27', top: '#b4646e', topD: '#9c525c', legs: '#e3d2bd', shoe: '#6b4a3a' },
  m: { skin: '#d8a07c', skinD: '#c08560', hair: '#2b211d', top: '#7f8c70', topD: '#6c785e', legs: '#3f4a5c', shoe: '#2b2320' },
};

// o: { kind 'w'|'m', x, look:[lx,ly] (-1..1), tilt deg, talk 0..1, mood 'n'|'s'|'h'|'t'(talk), brows 'n'|'s'|'u',
//      arms 'lap'|'phone'|'gesture'|'mug'|'laptop'|'remote', gest 0..1, glow 0..1, blink 0..1, lean px, t }
function person(o) {
  const c = PAL[o.kind], x = o.x, s = o.kind === 'w' ? 1 : -1;   // s: direction toward the partner
  const lean = o.lean || 0, hx = x + lean, hy = 600 + (o.down || 0);
  let g = '';
  if (o.stand) {
    const sw = o.walk ? Math.sin((o.t || 0) * 9) * 16 : 0;
    const leg = (hx0, a) => `<g transform="rotate(${a} ${hx0} 742)"><rect x="${hx0 - 23}" y="736" width="46" height="350" rx="20" fill="${c.legs}"/>
      <ellipse cx="${hx0 + s * 8}" cy="1088" rx="38" ry="16" fill="${c.shoe}"/></g>`;
    g += `<ellipse cx="${x}" cy="1100" rx="80" ry="12" fill="#6b4a3a" opacity=".16"/>` + leg(x - 30, sw) + leg(x + 30, -sw);
    return g + `<g transform="translate(0 -150)">${person({ ...o, stand: false, _upper: true })}</g>`;
  }
  // legs
  if (!o._upper) g += `<ellipse cx="${x}" cy="968" rx="86" ry="14" fill="#6b4a3a" opacity=".18"/>
        <rect x="${x - 56}" y="930" width="46" height="150" rx="20" fill="${c.legs}"/>
        <rect x="${x + 10}" y="930" width="46" height="150" rx="20" fill="${c.legs}"/>
        <rect x="${x - 70}" y="872" width="140" height="80" rx="36" fill="${c.legs}"/>
        <path d="M${x - 2} 900 L${x - 2} 948" stroke="#000" stroke-opacity=".12" stroke-width="4"/>
        <ellipse cx="${x - 36}" cy="1084" rx="38" ry="16" fill="${c.shoe}"/>
        <ellipse cx="${x + 36}" cy="1084" rx="38" ry="16" fill="${c.shoe}"/>`;
  if (o._upper) g += `<path d="M${x - 70} 880 L${x + 70} 880 L${x + 66} 900 L${x - 66} 900 Z" fill="${c.legs}"/>`;
  // long hair sits behind the shoulders
  if (o.kind === 'w') g += `<path d="M${hx - 70} 600 Q${hx - 82} 512 ${hx} 512 Q${hx + 82} 512 ${hx + 70} 600 L${hx + 80} 742 Q${hx + 44} 764 ${hx + 30} 704 L${hx - 30} 704 Q${hx - 44} 764 ${hx - 80} 742 Z" fill="${c.hair}"/>`;
  // torso + neck
  g += `<rect x="${x + lean * .4 - 16}" y="650" width="32" height="56" fill="${c.skinD}"/>
        <path d="M${x - 80} 722 Q${x - 84} 700 ${x - 58} 694 L${x + 58} 694 Q${x + 84} 700 ${x + 80} 722 L${x + 70} 892 L${x - 70} 892 Z" fill="${c.top}"/>
        <path d="M${x - 24} 694 Q${x} 716 ${x + 24} 694" fill="none" stroke="${c.topD}" stroke-width="5"/>`;
  // head
  const [lx, ly] = o.look || [0, 0];
  const tilt = o.tilt || 0;
  g += `<g transform="rotate(${tilt} ${hx} 668)">`;
  if (o.kind === 'm') g += `<circle cx="${hx - 60}" cy="${hy + 10}" r="13" fill="${c.skinD}"/><circle cx="${hx + 60}" cy="${hy + 10}" r="13" fill="${c.skinD}"/>`;
  g += `<ellipse cx="${hx}" cy="${hy}" rx="60" ry="68" fill="${c.skin}"/>`;
  if (o.kind === 'm') g += `<path d="M${hx - 52} ${hy + 20} Q${hx} ${hy + 92} ${hx + 52} ${hy + 20} Q${hx + 40} ${hy + 66} ${hx} ${hy + 70} Q${hx - 40} ${hy + 66} ${hx - 52} ${hy + 20} Z" fill="${c.skinD}" opacity=".55"/>
        <path d="M${hx - 62} ${hy + 2} Q${hx - 68} ${hy - 78} ${hx} ${hy - 80} Q${hx + 68} ${hy - 78} ${hx + 62} ${hy + 2} Q${hx + 52} ${hy - 36} ${hx + 8} ${hy - 40} Q${hx - 42} ${hy - 42} ${hx - 62} ${hy + 2} Z" fill="${c.hair}"/>`;
  else g += `<path d="M${hx - 62} ${hy - 6} Q${hx - 52} ${hy - 74} ${hx} ${hy - 74} Q${hx + 62} ${hy - 72} ${hx + 64} ${hy - 2} Q${hx + 26} ${hy - 44} ${hx - 14} ${hy - 36} Q${hx - 42} ${hy - 30} ${hx - 62} ${hy - 6} Z" fill="${c.hair}"/>`;
  // face
  const ey = hy + 5, bl = 1 - (o.blink || 0);
  [-1, 1].forEach(k => {
    const ex = hx + k * 22;
    g += `<ellipse cx="${ex + lx * 5}" cy="${ey + ly * 5}" rx="6.5" ry="${Math.max(.8, 8 * bl)}" fill="#2b2320"/>`;
    const inner = ex - k * 12, outer = ex + k * 12, by = ey - 21 + (o.brows === 'u' ? -6 : 0);
    const iy = by + (o.brows === 's' ? -7 : o.brows === 'a' ? 5 : 0);
    g += `<path d="M${inner} ${iy} L${outer} ${by}" stroke="${c.hair}" stroke-width="5" stroke-linecap="round"/>`;
  });
  g += `<path d="M${hx + 2} ${hy + 12} q7 14 -4 18" fill="none" stroke="${c.skinD}" stroke-width="4" stroke-linecap="round"/>`;
  g += `<circle cx="${hx - 38}" cy="${hy + 28}" r="10" fill="#e98a7a" opacity=".32"/><circle cx="${hx + 38}" cy="${hy + 28}" r="10" fill="#e98a7a" opacity=".32"/>`;
  const my = hy + 42;
  if ((o.talk || 0) > .04) g += `<ellipse cx="${hx}" cy="${my}" rx="11" ry="${2 + 9 * o.talk}" fill="#7a2e35"/>`;
  else if (o.mood === 's') g += `<path d="M${hx - 12} ${my + 4} Q${hx} ${my - 4} ${hx + 12} ${my + 4}" fill="none" stroke="#7a2e35" stroke-width="4" stroke-linecap="round"/>`;
  else if (o.mood === 'h') g += `<path d="M${hx - 16} ${my - 3} Q${hx} ${my + 14} ${hx + 16} ${my - 3}" fill="none" stroke="#7a2e35" stroke-width="4.5" stroke-linecap="round"/>`;
  else g += `<path d="M${hx - 11} ${my} Q${hx} ${my + 4} ${hx + 11} ${my}" fill="none" stroke="#7a2e35" stroke-width="4" stroke-linecap="round"/>`;
  if (o.red) g += `<ellipse cx="${hx}" cy="${hy + 8}" rx="58" ry="62" fill="#e0453a" opacity="${.28 * o.red}"/>`;
  if (o.glow) g += `<ellipse cx="${hx}" cy="${hy + 52}" rx="34" ry="16" fill="#dfe9ff" opacity="${.12 * o.glow}"/>`;
  g += `</g>`;
  // arms
  const sh = [x - 74, 716], sh2 = [x + 74, 716];
  const arm = (a, e, h) => `<path d="M${a[0]} ${a[1]} Q${e[0]} ${e[1]} ${h[0]} ${h[1]}" fill="none" stroke="${c.top}" stroke-width="34" stroke-linecap="round"/><circle cx="${h[0]}" cy="${h[1]}" r="17" fill="${c.skin}"/>`;
  const gp = o.gest || 0;
  switch (o.arms) {
    case 'phone':
      g += arm(sh, [x - 96, 850], [x - 20, 812]) + arm(sh2, [x + 96, 850], [x + 20, 812]);
      g += `<rect x="${x - 27}" y="752" width="54" height="88" rx="9" fill="#2b2320"/>
            <rect x="${x - 22}" y="758" width="44" height="76" rx="5" fill="#bcd6ff" opacity="${.45 + .5 * (o.glow || 0)}"/>
            <circle cx="${x - 20}" cy="812" r="17" fill="${c.skin}"/><circle cx="${x + 20}" cy="812" r="17" fill="${c.skin}"/>`;
      break;
    case 'gesture': {
      const a = s > 0 ? sh2 : sh, b = s > 0 ? sh : sh2;
      g += arm(b, [x - s * 84, 840], [x - s * 28, 878]);
      g += arm(a, [x + s * 104, 830], [x + s * (118 + 12 * gp), 760 - 34 * gp]);
      break;
    }
    case 'mug':
      g += arm(sh, [x - 96, 850], [x - 22, 818]) + arm(sh2, [x + 96, 850], [x + 22, 818]);
      g += `<rect x="${x - 26}" y="778" width="52" height="58" rx="10" fill="#f4ede3"/><path d="M${x + 26} 790 q22 4 0 30" fill="none" stroke="#f4ede3" stroke-width="7"/>
            <rect x="${x - 26}" y="778" width="52" height="12" rx="6" fill="#c08560" opacity=".5"/>
            <circle cx="${x - 22}" cy="818" r="17" fill="${c.skin}"/><circle cx="${x + 22}" cy="818" r="17" fill="${c.skin}"/>`;
      [0, 1].forEach(k => { const ph = ((o.t || 0) * .6 + k * .5) % 1;
        g += `<path d="M${x - 8 + k * 16} ${770 - ph * 50} q-8 -12 0 -24 q8 -12 0 -24" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round" opacity="${.7 * Math.sin(ph * Math.PI)}"/>`; });
      break;
    case 'laptop':
      g += arm(sh, [x - 100, 850], [x - 52, 858]) + arm(sh2, [x + 100, 850], [x + 52, 858]);
      g += `<rect x="${x - 92}" y="756" width="184" height="104" rx="9" fill="#cfc6bb"/><circle cx="${x}" cy="806" r="9" fill="#e8e0d6"/>
            <rect x="${x - 98}" y="856" width="196" height="12" rx="5" fill="#b8ada0"/>`;
      break;
    case 'cross':
      g += arm(sh2, [x + 96, 806], [x - 46, 790]) + arm(sh, [x - 96, 806], [x + 46, 770]);
      break;
    case 'point': {
      const a = s > 0 ? sh2 : sh, b = s > 0 ? sh : sh2;
      g += arm(b, [x - s * 84, 840], [x - s * 28, 878]);
      g += arm(a, [x + s * 120, 740 + 6 * Math.sin((o.t || 0) * 14) * gp], [x + s * 170, 700]);
      g += `<path d="M${x + s * 182} 700 l${s * 28} -4" stroke="${c.skin}" stroke-width="12" stroke-linecap="round"/>`;
      break;
    }
    case 'open':
      g += arm(sh, [x - 100, 830], [x - 62, 780 - 10 * gp]) + arm(sh2, [x + 100, 830], [x + 62, 780 - 10 * gp]);
      break;
    default:
      g += arm(sh, [x - 88, 840], [x - 30, 880]) + arm(sh2, [x + 88, 840], [x + 30, 880]);
  }
  return g;
}

// room options: { w, m (person opts or null), dim 0..1, tv 0..1, crack 0..1, t }
function room(r) {
  let g = `<rect width="1080" height="1920" fill="#efe3d3"/>
    <rect y="1040" width="1080" height="880" fill="#dccab3"/>
    <ellipse cx="540" cy="1110" rx="440" ry="62" fill="#c9a98f" opacity=".55"/>
    ${r.clock != null ? clockSvg(r.clock) : r.noframe ? '' : `<rect x="430" y="300" width="220" height="170" rx="8" fill="#f8f1e7" stroke="#a7836a" stroke-width="10"/>
    <circle cx="510" cy="390" r="36" fill="#e9a979" opacity=".8"/><path d="M450 450 Q520 380 630 450 Z" fill="#7f8c70" opacity=".85"/>`}
    <ellipse cx="1000" cy="560" rx="${170 + 10 * Math.sin((r.t || 0) * 1.3)}" ry="170" fill="#f6c98f" opacity="${.30 * (1 - (r.dim || 0) * .3)}"/>
    <rect x="994" y="560" width="10" height="500" fill="#5b4d46"/><path d="M948 600 L962 512 L1036 512 L1050 600 Z" fill="#f2d3a6"/>
    <ellipse cx="999" cy="1062" rx="50" ry="12" fill="#5b4d46"/>
    <rect x="40" y="960" width="90" height="84" rx="14" fill="#b4646e"/>
    ${[[-30, -60, 30], [10, -80, -10], [-50, -10, 60], [30, -30, -40], [0, -120, 5]].map(([dx, dy, a]) => `<ellipse cx="${85 + dx}" cy="${950 + dy}" rx="22" ry="54" transform="rotate(${a} ${85 + dx} ${950 + dy})" fill="#7f8c70"/>`).join('')}
    <rect x="130" y="690" width="820" height="250" rx="54" fill="#a7836a"/>
    <rect x="150" y="868" width="780" height="100" rx="32" fill="#bb977c"/>
    <rect x="170" y="960" width="18" height="70" rx="6" fill="#6b4a3a"/><rect x="892" y="960" width="18" height="70" rx="6" fill="#6b4a3a"/>`;
  if (r.tv) g += `<rect width="1080" height="1920" fill="#4a6fa5" opacity="${.12 * r.tv * (.85 + .15 * Math.sin((r.t || 0) * 7))}"/>`;
  // seated people sit between the couch back and its arms; standing people are in front of the couch
  const ppl = [['w', r.w], ['m', r.m]].filter(([, o]) => o);
  ppl.filter(([, o]) => !o.stand).forEach(([k, o]) => g += person({ kind: k, t: r.t, ...o }));
  g += `<rect x="96" y="800" width="112" height="210" rx="52" fill="#9a7660"/><rect x="872" y="800" width="112" height="210" rx="52" fill="#9a7660"/>`;
  ppl.filter(([, o]) => o.stand).forEach(([k, o]) => g += person({ kind: k, t: r.t, ...o }));
  if (r.crack) g += `<path d="M540 ${640 - 20} l-14 70 l22 50 l-20 70 l18 60 l-12 70" fill="none" stroke="#7d2a35" stroke-width="7" stroke-linecap="round" stroke-linejoin="round" pathLength="1" stroke-dasharray="1 1" stroke-dashoffset="${1 - r.crack}"/>`;
  if (r.dim) g += `<rect width="1080" height="1920" fill="#2a1d24" opacity="${.38 * r.dim}"/>`;
  return g;
}

// blink helper: natural irregular blinks
function blinkAt(t, seed = 0) {
  const period = 3.1 + (seed % 3) * .7, ph = (t + seed * 1.37) % period;
  return ph < .14 ? Math.sin(ph / .14 * Math.PI) : 0;
}
// talking mouth: syllable-like open/close
function talkAt(t, on = 1) { return on ? Math.max(0, .5 + .5 * Math.sin(t * 17) * Math.sin(t * 5.3 + 1)) : 0; }

function clockSvg(h) {
  const ha = (h % 12) * 30, ma = (h % 1) * 360;
  return `<circle cx="540" cy="385" r="88" fill="#fffaf3" stroke="#6b4a3a" stroke-width="10"/>
    ${Array.from({ length: 12 }, (_, i) => `<line x1="540" y1="309" x2="540" y2="${i % 3 ? 318 : 324}" stroke="#6b4a3a" stroke-width="${i % 3 ? 3 : 6}" transform="rotate(${i * 30} 540 385)"/>`).join('')}
    <line x1="540" y1="385" x2="540" y2="337" stroke="#2b2320" stroke-width="9" stroke-linecap="round" transform="rotate(${ha} 540 385)"/>
    <line x1="540" y1="385" x2="540" y2="318" stroke="#7d2a35" stroke-width="5" stroke-linecap="round" transform="rotate(${ma} 540 385)"/>
    <circle cx="540" cy="385" r="8" fill="#2b2320"/>`;
}

// Standing couple dancing a tango (side-facing, simplified). p: { x, t, sync 0..1 (1 = in step), sep px }
function tango(p) {
  const t = p.t || 0, sync = p.sync == null ? 1 : p.sync;
  const beat = Math.sin(t * 2.4), off = Math.sin(t * 2.4 + (1 - sync) * 2.6);
  const cx = p.x + beat * 50, sep = (p.sep || 0);
  const mx = cx - 92 - sep / 2, wx = cx + 92 + sep / 2 + (1 - sync) * off * 30;
  const M = PAL.m, W = PAL.w;
  const legs = (x, col, shoe, ph, dress) => {
    const a = Math.sin(ph) * 22, b = -Math.sin(ph) * 14;
    let g = '';
    [[a, -12], [b, 12]].forEach(([ang, dx]) => g += `<g transform="rotate(${ang} ${x + dx} 880)"><rect x="${x + dx - 20}" y="870" width="40" height="300" rx="18" fill="${dress ? W.skin : col}"/>
      <ellipse cx="${x + dx + 10}" cy="1170" rx="34" ry="13" fill="${shoe}"/></g>`);
    return g;
  };
  const head = (x, y, kind, dir) => {
    const c = PAL[kind];
    let g = '';
    if (kind === 'w') g += `<path d="M${x - 58} ${y} Q${x - 70} ${y - 88} ${x} ${y - 88} Q${x + 70} ${y - 88} ${x + 58} ${y} Q${x - 10} ${y + 30} ${x - 80} ${y + 90} Q${x - 70} ${y + 40} ${x - 58} ${y} Z" fill="${c.hair}"/>`;
    g += `<ellipse cx="${x}" cy="${y}" rx="54" ry="62" fill="${c.skin}"/>`;
    if (kind === 'm') g += `<path d="M${x - 56} ${y + 2} Q${x - 60} ${y - 72} ${x} ${y - 74} Q${x + 60} ${y - 72} ${x + 56} ${y + 2} Q${x + 44} ${y - 34} ${x + 6} ${y - 38} Q${x - 38} ${y - 38} ${x - 56} ${y + 2} Z" fill="${c.hair}"/>`;
    else g += `<path d="M${x - 56} ${y - 6} Q${x - 46} ${y - 68} ${x} ${y - 68} Q${x + 56} ${y - 66} ${x + 58} ${y - 2} Q${x + 24} ${y - 40} ${x - 12} ${y - 34} Q${x - 38} ${y - 28} ${x - 56} ${y - 6} Z" fill="${c.hair}"/>`;
    const lx = dir * 5;
    g += `<ellipse cx="${x - 18 + lx}" cy="${y + 4}" rx="6" ry="7.5" fill="#2b2320"/><ellipse cx="${x + 18 + lx}" cy="${y + 4}" rx="6" ry="7.5" fill="#2b2320"/>
      <path d="M${x - 12} ${y + 36} Q${x} ${y + (sync > .5 ? 46 : 32)} ${x + 12} ${y + 36}" fill="none" stroke="#7a2e35" stroke-width="4" stroke-linecap="round"/>
      <circle cx="${x - 34}" cy="${y + 24}" r="9" fill="#e98a7a" opacity=".3"/><circle cx="${x + 34}" cy="${y + 24}" r="9" fill="#e98a7a" opacity=".3"/>`;
    return g;
  };
  let g = `<ellipse cx="${cx}" cy="1180" rx="260" ry="22" fill="#6b4a3a" opacity=".14"/>`;
  g += legs(mx, M.legs, M.shoe, t * 2.4, false) + legs(wx, W.legs, W.shoe, t * 2.4 + (1 - sync) * 2.6 + Math.PI, true);
  // dress
  g += `<path d="M${wx - 62} 690 L${wx + 62} 690 L${wx + 120 + off * 20} 960 Q${wx} 990 ${wx - 110 + off * 20} 960 Z" fill="${W.top}"/>`;
  // man torso
  g += `<path d="M${mx - 72} 712 Q${mx - 76} 690 ${mx - 52} 684 L${mx + 52} 684 Q${mx + 76} 690 ${mx + 72} 712 L${mx + 62} 890 L${mx - 62} 890 Z" fill="${M.top}"/>
        <rect x="${mx - 64}" y="870" width="128" height="30" rx="10" fill="${M.legs}"/>`;
  // joined hands (raised, pointing away from the man) and his arm around her back
  const hx = mx - 180, hy = 680 + beat * 8;
  g += `<path d="M${mx - 66} 712 Q${mx - 150} 700 ${hx} ${hy}" fill="none" stroke="${M.top}" stroke-width="30" stroke-linecap="round"/>`;
  g += `<path d="M${wx - 60} 716 Q${(wx + hx) / 2} 700 ${hx + 14} ${hy - 2}" fill="none" stroke="${W.skin}" stroke-width="24" stroke-linecap="round"/>`;
  g += `<circle cx="${hx}" cy="${hy}" r="17" fill="${M.skin}"/>`;
  g += `<path d="M${mx + 66} 712 Q${wx} 770 ${wx + 40} 750" fill="none" stroke="${M.top}" stroke-width="30" stroke-linecap="round"/><circle cx="${wx + 42}" cy="750" r="16" fill="${M.skin}"/>`;
  g += `<rect x="${mx - 15}" y="640" width="30" height="50" fill="${M.skinD}"/><rect x="${wx - 14}" y="640" width="28" height="50" fill="${W.skinD}"/>`;
  g += head(mx, 580, 'm', 1) + head(wx + 6, 590 + (sync > .5 ? 10 : 0), 'w', -1);
  if (sync < .5) g += `<text x="${cx}" y="470" text-anchor="middle" font-family="Playfair Display" font-weight="700" font-size="${110 + 10 * Math.sin(t * 8)}" fill="#7d2a35">!</text>`;
  return g;
}
