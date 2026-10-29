// three.js ile 3B sahneler (lib/three.min.js). Her sahne ayrı bir WebGL tuvaline çizilir ve
// üst panelin 2B tuvaline (ctx) kopyalanır; böylece sahne geçişleri ve saydamlık 2B ile aynı çalışır.
// Tüm hareketler t'ye bağlıdır (kare kare çizimde aynı kare hep aynı görüntüyü verir).
const G3 = {};
function g3init() {
  if (G3.r) return;
  G3.cv = document.createElement('canvas'); G3.cv.width = 1080; G3.cv.height = 960;
  G3.r = new THREE.WebGLRenderer({ canvas: G3.cv, alpha: true, antialias: true, preserveDrawingBuffer: true });
  G3.r.setPixelRatio(1);
  G3.r.setClearColor(0x000000, 0);
  G3.r.outputColorSpace = THREE.SRGBColorSpace;
  G3.r.toneMapping = THREE.ACESFilmicToneMapping;
  G3.r.toneMappingExposure = 1.1;
}

function g3scene(fov = 40) {
  const s = new THREE.Scene();
  const cam = new THREE.PerspectiveCamera(fov, 1080 / 960, 0.1, 100);
  s.add(new THREE.HemisphereLight(0xffffff, 0x3a3060, 1.2));
  const key = new THREE.DirectionalLight(0xffffff, 2.4); key.position.set(4, 8, 6); s.add(key);
  const rim = new THREE.DirectionalLight(0x9fd0ff, 1.0); rim.position.set(-6, 3, -4); s.add(rim);
  return { s, cam };
}

// Sahneyi çizip ctx'e kopyalar; crop verilirse WebGL tuvalinin o bölümünü hedef dikdörtgene çizer
function g3draw(sc, a = 1, crop) {
  g3init();
  G3.r.clear();
  G3.r.render(sc.s, sc.cam);
  ctx.save();
  ctx.globalAlpha *= a;
  if (crop) ctx.drawImage(G3.cv, crop.sx, crop.sy, crop.sw, crop.sh, crop.dx, crop.dy, crop.dw, crop.dh);
  else ctx.drawImage(G3.cv, 0, 0);
  ctx.restore();
}

function m3(color, o = {}) { return new THREE.MeshStandardMaterial(Object.assign({ color, roughness: 0.45, metalness: 0.05 }, o)); }
function canvasTex(w, h, draw) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const tx = new THREE.CanvasTexture(c); tx.colorSpace = THREE.SRGBColorSpace; tx.anisotropy = 4;
  return tx;
}

// Tabak + yemekler + çizgi film oynayan tablet
function buildPlate() {
  const sc = g3scene(40);
  const g = new THREE.Group(); sc.s.add(g);
  g.add(new THREE.Mesh(new THREE.CylinderGeometry(2.3, 1.7, 0.22, 72), m3(0xffffff, { roughness: 0.3 })));
  const rim = new THREE.Mesh(new THREE.TorusGeometry(2.17, 0.12, 16, 90), m3(0xf1f0f7, { roughness: 0.25 }));
  rim.rotation.x = Math.PI / 2; rim.position.y = 0.13; g.add(rim);
  const foods = []; const add = (mesh, x, y, z) => { mesh.position.set(x, y, z); mesh.userData.base = mesh.position.clone(); g.add(mesh); foods.push(mesh); return mesh; };
  // pilav tepeciği
  const mound = new THREE.Mesh(new THREE.SphereGeometry(0.95, 40, 20, 0, Math.PI * 2, 0, Math.PI / 2), m3(0xffe2a0, { roughness: 0.8 }));
  mound.scale.y = 0.7; add(mound, -0.55, 0.11, 0.25);
  // bezelyeler
  for (let i = 0; i < 9; i++) {
    const a = i * 0.72, rr = 0.25 + (i % 3) * 0.13;
    add(new THREE.Mesh(new THREE.SphereGeometry(0.16, 20, 12), m3(0x5cc05a, { roughness: 0.35 })), 0.95 + rr * Math.cos(a), 0.26, -0.55 + rr * Math.sin(a));
  }
  // havuç dilimleri
  for (let i = 0; i < 5; i++) {
    const c = new THREE.Mesh(new THREE.CylinderGeometry(0.27, 0.27, 0.1, 28), m3(0xff8a2a, { roughness: 0.5 }));
    c.rotation.z = 0.25; add(c, 0.55 + i * 0.16, 0.18, 0.95 - i * 0.12);
  }
  // brokoli
  const br = new THREE.Group();
  const st = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.15, 0.45, 14), m3(0x9bd36b)); st.position.y = 0.25; br.add(st);
  for (let i = 0; i < 6; i++) {
    const b = new THREE.Mesh(new THREE.SphereGeometry(0.24, 18, 12), m3(0x2f9e4a, { roughness: 0.9 }));
    b.position.set(Math.cos(i * 1.1) * 0.2, 0.58 + (i % 2) * 0.1, Math.sin(i * 1.1) * 0.2); br.add(b);
  }
  add(br, -0.95, 0.05, -0.85);
  // tablet (çizgi film ekranı)
  const tab = new THREE.Group();
  tab.add(new THREE.Mesh(new THREE.BoxGeometry(2.3, 1.5, 0.1), m3(0x1b1d2a, { roughness: 0.3, metalness: 0.3 })));
  const scrTex = canvasTex(512, 330, (x, w, h) => {
    const gr = x.createLinearGradient(0, 0, w, h); gr.addColorStop(0, '#7CC4FF'); gr.addColorStop(1, '#B08CFF');
    x.fillStyle = gr; x.fillRect(0, 0, w, h);
    x.fillStyle = '#7BE495'; x.fillRect(0, 250, w, 80);
    x.fillStyle = '#FFC93C'; x.beginPath(); x.arc(160, 175, 72, 0, 7); x.fill();
    x.fillStyle = '#1b1d2a'; x.beginPath(); x.arc(135, 160, 12, 0, 7); x.arc(185, 160, 12, 0, 7); x.fill();
    x.strokeStyle = '#1b1d2a'; x.lineWidth = 8; x.beginPath(); x.arc(160, 185, 32, 0.2, Math.PI - 0.2); x.stroke();
    x.fillStyle = 'rgba(255,255,255,0.9)'; x.beginPath(); x.arc(380, 150, 60, 0, 7); x.fill();
    x.fillStyle = '#FF5E6C'; x.beginPath(); x.moveTo(360, 120); x.lineTo(360, 180); x.lineTo(410, 150); x.closePath(); x.fill();
  });
  const scr = new THREE.Mesh(new THREE.PlaneGeometry(2.12, 1.34), new THREE.MeshBasicMaterial({ map: scrTex, toneMapped: false }));
  scr.position.z = 0.056; tab.add(scr);
  sc.s.add(tab);
  // ekran ışığı
  const glow = new THREE.PointLight(0x9fc8ff, 0, 6); sc.s.add(glow);
  Object.assign(sc, { g, foods, tab, glow });
  return sc;
}

// o: { pop, spin, tab (0..1 görünürlük), tabOut (0..1 uçup gitme), hop (yemek zıplatma başlangıç zamanı), camY }
function plate3d(t, o = {}) {
  if (!G3.plate) G3.plate = buildPlate();
  const sc = G3.plate, p = o.pop === undefined ? 1 : o.pop;
  sc.cam.position.set(0, o.camY || 4.4, 7.6); sc.cam.lookAt(0, 0.4, 0);
  sc.cam.setViewOffset(1080, 960, 0, -(o.offY || 70), 1080, 960);
  sc.g.scale.setScalar(0.001 + 0.999 * eBack(p));
  sc.g.rotation.y = (o.spin === undefined ? 0.15 : o.spin) * t;
  sc.foods.forEach((f, i) => {
    f.position.copy(f.userData.base);
    if (o.hop !== undefined) { const u = clamp((t - o.hop - i * 0.08) / 0.6); f.position.y += 0.9 * Math.sin(Math.PI * u); }
  });
  const tv = o.tab || 0, out = o.tabOut || 0;
  sc.tab.visible = tv > 0.001;
  sc.tab.position.set(1.85 + 4 * out * out, 1.15 + Math.sin(t * 1.6) * 0.06 + 3.5 * out, 0.9);
  sc.tab.rotation.set(-0.15, -0.45 + 1.5 * out, 0.05 + 0.6 * out);
  sc.tab.scale.setScalar(0.001 + 0.8 * eBack(tv) * (1 - 0.4 * out));
  sc.glow.position.copy(sc.tab.position); sc.glow.intensity = 8 * tv * (1 - out);
  g3draw(sc, o.a === undefined ? 1 : o.a);
}

// Numaralı 3B madalyon: önden dönerek gelir
function coin3d(n, color, x, y, size, t, t0) {
  if (!G3.coins) {
    G3.coins = {}; const sc = g3scene(30); sc.cam.position.set(0, 0, 8); sc.cam.lookAt(0, 0, 0); G3.coinSc = sc;
  }
  const key = n + color;
  if (!G3.coins[key]) {
    const face = canvasTex(256, 256, (x2, w, h) => {
      x2.fillStyle = color; x2.fillRect(0, 0, w, h);
      x2.fillStyle = 'rgba(255,255,255,0.25)'; x2.beginPath(); x2.arc(128, 128, 112, 0, 7); x2.fill();
      x2.fillStyle = '#141A3A'; x2.font = '900 150px RD'; x2.textAlign = 'center'; x2.textBaseline = 'middle'; x2.fillText(String(n), 128, 140);
    });
    face.center.set(0.5, 0.5); face.rotation = Math.PI / 2;
    const side = m3(new THREE.Color(color).multiplyScalar(0.75), { metalness: 0.5, roughness: 0.3 });
    const capM = new THREE.MeshStandardMaterial({ map: face, metalness: 0.2, roughness: 0.35 });
    const coin = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.6, 0.35, 64), [side, capM, capM]);
    coin.rotation.x = Math.PI / 2;
    const holder = new THREE.Group(); holder.add(coin);
    G3.coins[key] = holder;
  }
  const sc = G3.coinSc, h = G3.coins[key];
  sc.s.children.filter(c => c.isGroup).forEach(c => sc.s.remove(c));
  sc.s.add(h);
  const p = clamp((t - t0) / 0.9);
  if (p <= 0) return;
  h.rotation.y = (1 - eOut(p)) * Math.PI * 2 + Math.sin(t * 1.4) * 0.25;
  h.rotation.x = Math.sin(t * 1.1) * 0.12;
  h.scale.setScalar(0.001 + 0.999 * eBack(clamp(p * 1.6)));
  g3draw(sc, popA(t, t0, 0.3), { sx: 140, sy: 80, sw: 800, sh: 800, dx: x - size / 2, dy: y - size / 2, dw: size, dh: size });
}
