/* conditions-banner.js — Live conditions panel for Aré Guḍi
   Calls /api/conditions (Netlify Function) and populates the banner.
   Falls back gracefully if the fetch fails. */
(function(){
  var ENDPOINT = '/api/conditions';
  var REFRESH_MS = 120000; // 2 min

  /* --- compass needle --- */
  var needle = document.getElementById('ag-needle');
  var currentRot = 0, targetRot = 0;
  function easeNeedle(){
    currentRot += (targetRot - currentRot) * 0.06;
    if(needle) needle.style.transform = 'rotate('+currentRot.toFixed(2)+'deg)';
    requestAnimationFrame(easeNeedle);
  }
  easeNeedle();

  /* --- clock --- */
  function tick(){
    var el = document.getElementById('ag-clock');
    if(el) el.textContent = new Date().toLocaleTimeString('en-GB');
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
    if(d.rain.monsoon_pct!==null){
      set('ag-monsoon', '↓ '+d.rain.monsoon_pct+'% of normal');
      cls('ag-monsoon', 'ag-bad');
    }
    set('ag-spray',  d.rain.spray.label);
    cls('ag-spray-pill', sprayColor(d.rain.spray.open));

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

    /* stamp */
    set('ag-stamp', 'data '+new Date(d.updated).toLocaleTimeString('en-GB'));

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
