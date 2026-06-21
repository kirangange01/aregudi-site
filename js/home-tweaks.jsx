/* =====================================================================
   Aré Guḍi · immersive home — Tweaks (design variations)
   Renders the Tweaks panel and applies values to the vanilla page +
   the Three.js scene (via window.GROVE.setPalette).
   ===================================================================== */

const HOME_TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "heroImage": "canopy & undergrowth",
  "palette": ["#150e08", "#241910", "#d98a5e"],
  "heroLayout": "low left",
  "headline": "Aré Guḍi",
  "photoBrightness": 0.38,
  "displayFont": "Cormorant Garamond",
  "bodyFont": "Georgia"
}/*EDITMODE-END*/;

const HOME_HERO_IMAGES = {
  'canopy & undergrowth':  'images/areca-canopy-ground.jpg',
  'avenue walk':           'images/avenue-walking.jpg',
  'tractor in the avenue': 'images/areca-avenue-tractor.jpg',
  'tilling, low angle':    'images/tractor-lowangle.jpg'
};

/* keyed by the first colour of the palette swatch */
const HOME_PALETTES = {
  '#150e08': { name: 'dusk',     night: '#150e08', n2: '#211710', panel: '#241910', acc: '#d98a5e', fog: '#1a1009', glow: '#ffffff', light: '#f2a866' },
  '#1c0d05': { name: 'ember',    night: '#1c0d05', n2: '#2a150a', panel: '#2c160a', acc: '#e0764a', fog: '#241107', glow: '#ff9a55', light: '#ffa05c' },
  '#0e120c': { name: 'moss night', night: '#0e120c', n2: '#161c12', panel: '#181f14', acc: '#c9a35a', fog: '#121710', glow: '#e8c277', light: '#d8b87a' }
};

function applyHomeTweaks(t) {
  const root = document.documentElement.style;
  const pal = HOME_PALETTES[(t.palette && t.palette[0]) || '#150e08'] || HOME_PALETTES['#150e08'];

  root.setProperty('--night', pal.night);
  root.setProperty('--night-2', pal.n2);
  root.setProperty('--panel', pal.panel);
  root.setProperty('--terracotta', pal.acc);
  document.body.style.background = pal.night;

  const img = document.querySelector('.fallback-bg img');
  if (img) {
    const src = HOME_HERO_IMAGES[t.heroImage] || HOME_HERO_IMAGES['canopy & undergrowth'];
    if (!img.getAttribute('src').endsWith(src)) img.setAttribute('src', src);
    img.style.filter = 'brightness(' + t.photoBrightness + ') saturate(.85)';
  }

  document.body.classList.toggle('hero-center', t.heroLayout === 'centered');

  const h1 = document.getElementById('hero-title');
  const kn = document.querySelector('.kn-big');
  if (h1) h1.textContent = t.headline;
  document.body.classList.toggle('alt-headline', t.headline !== 'Aré Guḍi');
  if (kn) kn.style.display = (t.headline === 'Aré Guḍi') ? '' : 'none';

  root.setProperty('--display', "'" + t.displayFont + "',Georgia,serif");
  root.setProperty('--body', "'" + t.bodyFont + "','Noto Sans Kannada',system-ui,sans-serif");

  if (window.GROVE && window.GROVE.setPalette) {
    window.GROVE.setPalette({ bg: pal.night, fog: pal.fog, glow: pal.glow, light: pal.light });
  }
}

function HomeTweaks() {
  const [t, setTweak] = useTweaks(HOME_TWEAK_DEFAULTS);
  React.useEffect(() => { applyHomeTweaks(t); }, [t]);

  return (
    <TweaksPanel>
      <TweakSection label="Hero" />
      <TweakSelect label="Backdrop photo" value={t.heroImage}
                   options={Object.keys(HOME_HERO_IMAGES)}
                   onChange={(v) => setTweak('heroImage', v)} />
      <TweakSlider label="Photo darkness" value={t.photoBrightness} min={0.22} max={0.65} step={0.01}
                   onChange={(v) => setTweak('photoBrightness', v)} />
      <TweakRadio  label="Layout" value={t.heroLayout}
                   options={['low left', 'centered']}
                   onChange={(v) => setTweak('heroLayout', v)} />
      <TweakSelect label="Headline" value={t.headline}
                   options={['Aré Guḍi', 'The grove at dusk', 'Fifty acres, listening.']}
                   onChange={(v) => setTweak('headline', v)} />
      <TweakSection label="Type" />
      <TweakSelect label="Display face" value={t.displayFont}
                   options={['Cormorant Garamond', 'EB Garamond', 'Playfair Display', 'Spectral']}
                   onChange={(v) => setTweak('displayFont', v)} />
      <TweakSelect label="Body face" value={t.bodyFont}
                   options={['Georgia', 'Noto Sans', 'Work Sans', 'Source Sans 3']}
                   onChange={(v) => setTweak('bodyFont', v)} />
      <TweakSection label="Atmosphere" />
      <TweakColor  label="Palette" value={t.palette}
                   options={[
                     ['#150e08', '#241910', '#d98a5e'],
                     ['#1c0d05', '#2c160a', '#e0764a'],
                     ['#0e120c', '#181f14', '#c9a35a']
                   ]}
                   onChange={(v) => setTweak('palette', v)} />
    </TweaksPanel>
  );
}

(function mountHomeTweaks() {
  /* apply persisted/default values immediately, even before panel opens */
  const host = document.createElement('div');
  host.id = 'home-tweaks-root';
  document.body.appendChild(host);
  ReactDOM.createRoot(host).render(<HomeTweaks />);
})();
