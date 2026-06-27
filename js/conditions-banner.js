/* conditions-banner.js — Live conditions panel for Aré Guḍi
   Calls /api/conditions (Netlify Function) and populates the banner.
   Falls back gracefully if the fetch fails. */
(function(){
  var ENDPOINT = '/api/conditions';
  var REFRESH_MS = 120000; // 2 min

  /* --- compass needle --- */
  var needle = document.getElementById('ag-needle');
  var currentRot = 0, targetRot = 0;
  var lastUpdatedMs = null;
  function easeNeedle(){
    currentRot += (targetRot - currentRot) * 0.06;
    if(needle) needle.style.transform = 'rotate('+currentRot.toFixed(2)+'deg)';
    requestAnimationFrame(easeNeedle);
  }
  easeNeedle();

  /* --- relative "updated X ago" --- */
  function relTime(ms){
    if(ms==null) return 'connecting…';
    var s=Math.max(0,Math.floor((Date.now()-ms)/1000));
    if(s<5)  return 'updated just now';
    if(s<60) return 'updated '+s+' second'+(s===1?'':'s')+' ago';
    var m=Math.floor(s/60);
    if(m<60) return 'updated '+m+' minute'+(m===1?'':'s')+' ago';
    var h=Math.floor(m/60);
    return 'updated '+h+' hour'+(h===1?'':'s')+' ago';
  }

  /* --- clock + freshness stamp --- */
  function tick(){
    var el = document.getElementById('ag-clock');
    if(el) el.textContent = new Date().toLocaleTimeString('en-GB');
    var st = document.getElementById('ag-stamp');
    if(st) st.textContent = relTime(lastUpdatedMs);
  }
  tick(); setInterval(tick, 1000);

  /* --- populate helpers --- */
  function set(id, val){ var e=document.getElementById(id); if(e&&val!=null) e.textContent=val; }
  function src(id, url){ var e=document.getElementById(id); if(e&&url) e.src=url; }
  function show(id){ var e=document.getElementById(id); if(e) e.style.display=''; }
  function hide(id){ var e=document.getElementById(id); if(e) e.style.display='none'; }
  function cls(id, c){ var e=document.getElementById(id); if(e){ e.className=e.className.replace(/ ?ag-good| ?ag-warn| ?ag-bad/g,''); e.classList.add(c); } }

  function aqiColor(v){
    if(v===null) return 'ag-good';
    if(v<=40) return 'ag-good'; if(v<=60) return 'ag-warn'; return 'ag-bad';
  }
  function sprayColor(open){ return open?'ag-good':'ag-warn'; }

  /* --- main populate --- */
  function populate(d){
    /* wind */
    targetRot = d.wind.dir_deg;
    set('ag-wind-dir',   d.wind.dir_label);
    set('ag-wind-deg',   d.wind.dir_deg+'°');
    set('ag-wind-spd',   d.wind.speed_kmh);
    set('ag-wind-gust',  d.wind.gust_kmh);
    set('ag-wind-bft',   d.wind.beaufort+' · '+d.wind.dir_label);

    /* weather */
    set('ag-feels',    d.weather.feels_like_c+'°C');
    set('ag-humidity', d.weather.humidity_pct+'%');
    set('ag-uv',       d.weather.uv_index+' · '+d.weather.uv_level);
    set('ag-sun',      '↑ '+d.weather.sunrise+' · ↓ '+d.weather.sunset);
    set('ag-work',     d.weather.work_condition);
    cls('ag-work-pill', d.weather.work_condition.startsWith('good')?'ag-good':'ag-warn');

    /* rain */
    set('ag-rain-today', d.rain.today_mm+' mm');
    set('ag-rain-sub',   d.rain.today_mm>0?'rain today':'dry today');
    set('ag-rain-next',  d.rain.next_rain);
    if(d.rain.monsoon_pct!=null){
      var mp = d.rain.monsoon_pct;            // 100 = exactly the normal-to-date
      var arrow = mp > 105 ? '\u2191 ' : (mp < 95 ? '\u2193 ' : '\u2192 ');
      var band  = mp >= 90 ? 'ag-good' : (mp >= 75 ? 'ag-warn' : 'ag-bad');
      set('ag-monsoon', arrow + mp + '% of normal');
      cls('ag-monsoon', band);
    }
    /* one-line monsoon status — live override; keeps the baked-in IMD line if the feed omits it */
    set('ag-monsoon-note', d.rain.monsoon_note);
    /* spray status is an internal field-ops signal — only render where a pill exists */
    if(d.rain.spray){
      set('ag-spray',  d.rain.spray.label);
      cls('ag-spray-pill', sprayColor(d.rain.spray.open));
    }

    /* AQI */
    set('ag-aqi-val', d.aqi.value!==null ? d.aqi.value : '—');
    set('ag-aqi-cat', d.aqi.category);
    cls('ag-aqi-val', aqiColor(d.aqi.value));

    /* moon */
    if(d.moon.image_url){
      src('ag-moon-img', d.moon.image_url);
      show('ag-moon-photo'); hide('ag-moon-svg');
    }
    set('ag-moon-phase', d.moon.phase||'—');
    set('ag-moon-illum', d.moon.illumination_pct!=null ? d.moon.illumination_pct+'% lit' : '');

    /* sky */
    set('ag-planet',  d.sky.planet);
    set('ag-shower',  d.sky.shower);

    /* today / tonight suggestion */
    var sg=document.getElementById('ag-suggest');
    if(sg && d.sky && d.sky.suggestion){
      sg.innerHTML='<b>'+(d.sky.suggestion_label||'Tonight')+' \u2014</b> '+d.sky.suggestion;
    }

    /* freshness — drives the ticking "updated X ago" in tick() */
    lastUpdatedMs = new Date(d.updated).getTime();

    /* home-page strip (only present on index.html) */
    set('ag-h-temp', d.weather.temp_c+'°C');
    set('ag-h-tsub', 'feels '+d.weather.feels_like_c+'° · '+d.weather.humidity_pct+'% humidity');
    set('ag-h-wind', d.wind.dir_label);
    set('ag-h-wsub', d.wind.speed_kmh+' km/h · gust '+d.wind.gust_kmh);
    set('ag-h-rain', d.rain.today_mm+' mm');
    set('ag-h-rsub', d.rain.spray ? d.rain.spray.label : 'spray window');
    set('ag-h-stamp', 'updated '+new Date(d.updated).toLocaleTimeString('en-GB')+' IST');
  }

  /* --- fetch loop --- */
  function load(){
    fetch(ENDPOINT)
      .then(function(r){ if(!r.ok) throw new Error(r.status); return r.json(); })
      .then(function(d){ populate(d); })
      .catch(function(e){ console.warn('conditions-banner:', e); });
  }
  load();
  setInterval(load, REFRESH_MS);
})();
