/* live.js — Live-proof strip, field readings, and trail-camera
   Reads farm data from a JSON feed that the Pi / n8n pipeline updates.
   NO API token in the browser: the pipeline writes data/live.json (or a
   remote endpoint set via window.AREGUDI_LIVE_URL). Falls back to the
   baked-in values in the markup if the feed is unavailable. */
(function () {
  if (!document.querySelector('[data-live], [data-trailcam], [data-r-moist]')) return;

  var SRC = window.AREGUDI_LIVE_URL || 'data/live.json';

  function rel(iso) {
    try {
      var then = new Date(iso).getTime();
      var mins = Math.round((Date.now() - then) / 60000);
      if (isNaN(mins)) return '';
      if (mins < 1) return 'just now';
      if (mins < 60) return mins + ' min ago';
      var hrs = Math.round(mins / 60);
      if (hrs < 24) return hrs + ' hr ago';
      return Math.round(hrs / 24) + ' d ago';
    } catch (e) { return ''; }
  }

  function timeIST(iso) {
    try {
      return new Date(iso).toLocaleTimeString('en-IN', {
        hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata'
      });
    } catch (e) { return ''; }
  }

  /* set EVERY matching node (a page can show the same datum twice) */
  function set(sel, val) {
    if (val == null || val === '') return;
    document.querySelectorAll(sel).forEach(function (el) { el.textContent = val; });
  }

  function trailcam(t) {
    var frame = document.querySelector('[data-tc-frame]');
    if (!frame) return;
    var hasFrame = t && t.image && !t.has_human;
    if (hasFrame) {
      var img = frame.querySelector('[data-tc-img]');
      if (img) img.style.backgroundImage = 'url("' + t.image + '")';
      frame.classList.add('has-img');
      set('[data-tc-cap]', (t.label ? t.label + ' · ' : 'Latest frame · ') + (t.time ? rel(t.time) : 'just now'));
    } else {
      set('[data-tc-cap]', 'No capture yet — camera installs on the next visit');
    }
  }

  fetch(SRC, { cache: 'no-store' })
    .then(function (r) { if (!r.ok) throw new Error('feed'); return r.json(); })
    .then(function (d) {
      if (d.weather) {
        set('[data-weather-v]', (d.weather.temp_c != null ? d.weather.temp_c + '°C' : '—'));
        var ws = [];
        if (d.weather.condition) ws.push(d.weather.condition);
        if (d.weather.rain_today_mm != null) ws.push(d.weather.rain_today_mm + ' mm today');
        if (d.weather.wind_kph != null) ws.push(d.weather.wind_kph + ' km/h wind');
        set('[data-weather-s]', ws.join(' · '));
        set('[data-r-airtemp]', (d.weather.temp_c != null ? d.weather.temp_c + '°C' : '—'));
        set('[data-r-rain]', (d.weather.rain_today_mm != null ? d.weather.rain_today_mm + ' mm' : '—'));
        set('[data-r-wind]', (d.weather.wind_kph != null ? d.weather.wind_kph + ' km/h' : '—'));
      }
      if (d.bird) {
        set('[data-bird-v]', d.bird.species || '—');
        var bs = [];
        if (d.bird.kannada) bs.push(d.bird.kannada);
        if (d.bird.time) bs.push('heard ' + rel(d.bird.time));
        set('[data-bird-s]', bs.join(' · '));
      }
      if (d.sensors) {
        set('[data-sensor-v]', (d.sensors.online != null ? d.sensors.online + '/' + (d.sensors.total || '?') + ' live' : '—'));
        var ss = [];
        if (d.sensors.last_soil_pct != null) ss.push('soil ' + d.sensors.last_soil_pct + '%');
        if (d.sensors.last_soil_time) ss.push(rel(d.sensors.last_soil_time));
        set('[data-sensor-s]', ss.join(' · '));
        set('[data-r-moist]', (d.sensors.soil_moist_pct != null ? d.sensors.soil_moist_pct + '%' : '—'));
        set('[data-r-ph]', (d.sensors.soil_ph != null ? d.sensors.soil_ph : '—'));
        set('[data-r-soiltemp]', (d.sensors.soil_temp_c != null ? d.sensors.soil_temp_c + '°C' : '—'));
      }
      trailcam(d.trailcam);
      if (d.updated) set('[data-stamp]', 'updated ' + timeIST(d.updated) + ' IST');
    })
    .catch(function () {
      // keep the baked-in fallback values; mark as sample
      set('[data-stamp]', 'sample data — feed connects at deploy');
      set('[data-tc-cap]', 'Camera not yet installed — placeholder');
    });
})();
