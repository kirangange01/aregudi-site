/* =====================================================================
   Aré Guḍi · immersive home — procedural areca grove at dusk
   Three.js scene: instanced trunks + canopy, fireflies, photo panels,
   horizon glow. Exposes window.GROVE for the scroll choreography.
   ===================================================================== */
(function () {
  'use strict';

  var canvas = document.getElementById('grove-canvas');

  /* quiet capability check before involving THREE — avoids console noise */
  function webglAvailable() {
    try {
      var probe = document.createElement('canvas');
      return !!(window.WebGLRenderingContext &&
        (probe.getContext('webgl') || probe.getContext('experimental-webgl')));
    } catch (e) { return false; }
  }
  if (!webglAvailable()) {
    document.body.classList.add('no-3d');
    return;
  }

  var renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true });
  } catch (e) {
    document.body.classList.add('no-3d');
    return;
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.12;

  var scene = new THREE.Scene();
  scene.background = new THREE.Color(0x150e08);
  scene.fog = new THREE.FogExp2(0x1a1009, 0.016);

  var camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 500);
  camera.rotation.order = 'YXZ';

  /* ------------------------------ lights ----------------------------- */
  scene.add(new THREE.AmbientLight(0x2a1d12, 1.1));
  var hemi = new THREE.HemisphereLight(0x352212, 0x0d0805, 0.85);
  scene.add(hemi);
  var dusk = new THREE.DirectionalLight(0xf2a866, 1.15);
  dusk.position.set(-30, 14, -220);
  scene.add(dusk);

  /* --------------------------- canvas textures ----------------------- */
  function makeCanvas(w, h, draw) {
    var c = document.createElement('canvas');
    c.width = w; c.height = h;
    draw(c.getContext('2d'), w, h);
    var t = new THREE.CanvasTexture(c);
    t.anisotropy = 4;
    return t;
  }

  var trunkTex = makeCanvas(128, 512, function (ctx, w, h) {
    ctx.fillStyle = '#4a3a2a'; ctx.fillRect(0, 0, w, h);
    for (var i = 0; i < 900; i++) {
      ctx.fillStyle = 'rgba(' + (20 + Math.random() * 60 | 0) + ',' + (14 + Math.random() * 40 | 0) + ',' + (8 + Math.random() * 24 | 0) + ',' + (0.08 + Math.random() * 0.2) + ')';
      ctx.fillRect(Math.random() * w, Math.random() * h, 2 + Math.random() * 5, 8 + Math.random() * 30);
    }
    for (var y = 18; y < h; y += 34 + Math.random() * 14) {       /* ring nodes */
      ctx.fillStyle = 'rgba(18,11,6,0.55)';
      ctx.fillRect(0, y, w, 4 + Math.random() * 3);
      ctx.fillStyle = 'rgba(216,186,150,0.07)';
      ctx.fillRect(0, y + 5, w, 2);
    }
  });
  trunkTex.wrapS = trunkTex.wrapT = THREE.RepeatWrapping;
  trunkTex.repeat.set(2, 3);

  var frondTex = makeCanvas(256, 256, function (ctx, w, h) {
    var cx = w / 2, cy = h / 2;
    ctx.translate(cx, cy);
    for (var i = 0; i < 11; i++) {
      var a = (i / 11) * Math.PI * 2 + Math.random() * 0.3;
      var len = 95 + Math.random() * 28;
      ctx.save();
      ctx.rotate(a);
      ctx.fillStyle = 'rgba(34,46,26,0.92)';
      ctx.beginPath();
      ctx.moveTo(6, 0);
      ctx.quadraticCurveTo(len * 0.5, -13 - Math.random() * 6, len, -2);
      ctx.quadraticCurveTo(len * 0.5, 11 + Math.random() * 6, 6, 0);
      ctx.fill();
      ctx.strokeStyle = 'rgba(120,130,80,0.25)';
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(6, 0); ctx.lineTo(len, -2); ctx.stroke();
      ctx.restore();
    }
  });

  var groundTex = makeCanvas(256, 256, function (ctx, w, h) {
    ctx.fillStyle = '#1c120a'; ctx.fillRect(0, 0, w, h);
    for (var i = 0; i < 2400; i++) {
      var v = Math.random();
      ctx.fillStyle = v > 0.5
        ? 'rgba(58,38,20,' + (0.1 + Math.random() * 0.25) + ')'
        : 'rgba(10,6,3,' + (0.1 + Math.random() * 0.3) + ')';
      ctx.fillRect(Math.random() * w, Math.random() * h, 1 + Math.random() * 3, 1 + Math.random() * 3);
    }
  });
  groundTex.wrapS = groundTex.wrapT = THREE.RepeatWrapping;
  groundTex.repeat.set(60, 60);

  var glowTex = makeCanvas(512, 256, function (ctx, w, h) {
    var g = ctx.createRadialGradient(w / 2, h, 30, w / 2, h, h * 1.05);
    g.addColorStop(0, 'rgba(244,170,96,0.95)');
    g.addColorStop(0.35, 'rgba(216,120,62,0.5)');
    g.addColorStop(0.7, 'rgba(120,58,30,0.16)');
    g.addColorStop(1, 'rgba(20,12,7,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  });

  /* ------------------------------ ground ----------------------------- */
  var ground = new THREE.Mesh(
    new THREE.PlaneGeometry(700, 700),
    new THREE.MeshLambertMaterial({ map: groundTex })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.z = -180;
  scene.add(ground);

  /* --------------------------- horizon glow -------------------------- */
  var glowMat = new THREE.MeshBasicMaterial({
    map: glowTex, transparent: true, opacity: 0.6,
    blending: THREE.AdditiveBlending, depthWrite: false, fog: false
  });
  var glow = new THREE.Mesh(new THREE.PlaneGeometry(760, 300), glowMat);
  glow.position.set(0, 70, -330);
  scene.add(glow);

  /* ------------------------------ palms ------------------------------ */
  var palms = [];
  function addPalm(x, z) {
    palms.push({ x: x, z: z, h: 9 + Math.random() * 5.5, s: 0.85 + Math.random() * 0.45, r: Math.random() * Math.PI * 2 });
  }
  var z;
  for (z = 10; z > -210; z -= 4.0 + Math.random() * 1.6) {        /* avenue rows */
    addPalm(-4.4 - Math.random() * 1.4, z + Math.random());
    addPalm(4.4 + Math.random() * 1.4, z + Math.random());
  }
  for (var i = 0; i < 150; i++) {                                  /* deep scatter */
    var sx = (7 + Math.random() * 26) * (Math.random() < 0.5 ? -1 : 1);
    addPalm(sx, 8 - Math.random() * 215);
  }

  var trunkGeo = new THREE.CylinderGeometry(0.17, 0.27, 1, 7, 1);
  trunkGeo.translate(0, 0.5, 0);
  var trunkMat = new THREE.MeshLambertMaterial({ map: trunkTex });
  var trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, palms.length);

  var frondGeo = new THREE.PlaneGeometry(8.4, 8.4);
  frondGeo.rotateX(-Math.PI / 2);
  var frondMat = new THREE.MeshLambertMaterial({
    map: frondTex, transparent: true, alphaTest: 0.35, side: THREE.DoubleSide
  });
  var crowns = new THREE.InstancedMesh(frondGeo, frondMat, palms.length * 2);

  var dummy = new THREE.Object3D();
  palms.forEach(function (p, idx) {
    dummy.position.set(p.x, 0, p.z);
    dummy.scale.set(p.s, p.h, p.s);
    dummy.rotation.set(0, p.r, 0);
    dummy.updateMatrix();
    trunks.setMatrixAt(idx, dummy.matrix);

    for (var k = 0; k < 2; k++) {
      dummy.position.set(p.x, p.h - 0.2 - k * 0.7, p.z);
      dummy.scale.set(p.s * (1 - k * 0.18), 1, p.s * (1 - k * 0.18));
      dummy.rotation.set((Math.random() - 0.5) * 0.16, Math.random() * Math.PI * 2, (Math.random() - 0.5) * 0.16);
      dummy.updateMatrix();
      crowns.setMatrixAt(idx * 2 + k, dummy.matrix);
    }
  });
  var canopyGroup = new THREE.Group();
  canopyGroup.add(trunks);
  canopyGroup.add(crowns);
  scene.add(canopyGroup);

  /* ---------------------------- fireflies ---------------------------- */
  var FLY_N = 190;
  var flyGeo = new THREE.BufferGeometry();
  var flyPos = new Float32Array(FLY_N * 3);
  var flyPhase = [];
  for (var f = 0; f < FLY_N; f++) {
    flyPos[f * 3] = (Math.random() - 0.5) * 50;
    flyPos[f * 3 + 1] = 0.6 + Math.random() * 6.5;
    flyPos[f * 3 + 2] = 6 - Math.random() * 175;
    flyPhase.push({ a: Math.random() * Math.PI * 2, b: Math.random() * Math.PI * 2, s: 0.3 + Math.random() * 0.7 });
  }
  flyGeo.setAttribute('position', new THREE.BufferAttribute(flyPos, 3));
  var flies = new THREE.Points(flyGeo, new THREE.PointsMaterial({
    color: 0xffd9a0, size: 0.16, transparent: true, opacity: 0.85,
    blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true
  }));
  scene.add(flies);

  /* --------------------------- photo panels -------------------------- */
  var loader = new THREE.TextureLoader();
  var panelDefs = [
    { src: 'images/avenue-walking.jpg',     x: -5.7, z: -32,  pw: 4.2, ph: 5.9 },
    { src: 'images/pepper-tending.jpg',     x: 5.5,  z: -52,  pw: 4.2, ph: 5.9 },
    { src: 'images/honeycomb-vertical.jpg', x: -5.4, z: -72,  pw: 4.2, ph: 5.4 },
    { src: 'images/manohar-tractor.jpg',    x: 5.6,  z: -92,  pw: 4.2, ph: 5.9 },
    { src: 'images/hibiscus.jpg',           x: -5.6, z: -112, pw: 5.6, ph: 4.2 },
    { src: 'images/beekeeper-frames.jpg',   x: 5.4,  z: -130, pw: 4.4, ph: 5.6 }
  ];
  var panelGroup = new THREE.Group();
  panelDefs.forEach(function (d) {
    loader.load(d.src, function (tex) {
      tex.encoding = THREE.sRGBEncoding;
      var m = new THREE.Mesh(
        new THREE.PlaneGeometry(d.pw, d.ph),
        new THREE.MeshBasicMaterial({ map: tex, color: 0xcdbda9 })
      );
      m.position.set(d.x, 3.4, d.z);
      m.rotation.y = d.x < 0 ? 0.42 : -0.42;
      /* hairline peach frame */
      var frame = new THREE.Mesh(
        new THREE.PlaneGeometry(d.pw + 0.14, d.ph + 0.14),
        new THREE.MeshBasicMaterial({ color: 0xf2cdac, transparent: true, opacity: 0.28 })
      );
      frame.position.set(d.x, 3.4, d.z - 0.02);
      frame.rotation.y = m.rotation.y;
      panelGroup.add(frame);
      panelGroup.add(m);
    });
  });
  scene.add(panelGroup);

  /* ------------------------- state + render loop --------------------- */
  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var G = {
    cam: { x: 0, y: 3.6, z: 16, rx: 0, ry: 0 },
    glowMat: glowMat,
    fliesMat: flies.material,
    reduced: reduced
  };
  G.setPalette = function (p) {
    if (p.bg) scene.background.set(p.bg);
    if (p.fog) scene.fog.color.set(p.fog);
    if (p.glow) glowMat.color.set(p.glow);
    if (p.light) dusk.color.set(p.light);
  };
  window.GROVE = G;

  var mouse = { x: 0, y: 0 }, sm = { x: 0, y: 0 };
  window.addEventListener('pointermove', function (e) {
    mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
    mouse.y = (e.clientY / window.innerHeight) * 2 - 1;
  }, { passive: true });

  var clock = new THREE.Clock();
  function tick() {
    var t = clock.getElapsedTime();
    var sway = reduced ? 0 : 1;
    sm.x += (mouse.x - sm.x) * 0.035;
    sm.y += (mouse.y - sm.y) * 0.035;

    camera.position.set(
      G.cam.x + sm.x * 0.95 * sway,
      G.cam.y + (-sm.y * 0.45 + Math.sin(t * 0.45) * 0.09) * sway,
      G.cam.z
    );
    camera.rotation.x = G.cam.rx + (-sm.y * 0.038) * sway;
    camera.rotation.y = G.cam.ry + (-sm.x * 0.05) * sway;
    camera.rotation.z = 0;

    if (!reduced) {
      canopyGroup.rotation.z = Math.sin(t * 0.35) * 0.004;
      for (var f = 0; f < FLY_N; f++) {
        var ph = flyPhase[f];
        flyPos[f * 3] += Math.sin(t * ph.s + ph.a) * 0.0045 + sm.x * 0.004;
        flyPos[f * 3 + 1] += Math.cos(t * ph.s * 0.8 + ph.b) * 0.003 - sm.y * 0.002;
      }
      flyGeo.attributes.position.needsUpdate = true;
    }

    renderer.render(scene, camera);
    requestAnimationFrame(tick);
  }
  tick();

  window.addEventListener('resize', function () {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });
})();
