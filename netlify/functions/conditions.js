// conditions.js — Netlify Function
// Live current conditions (Tempest obs) + forecast (Tempest better_forecast,
// Open-Meteo fallback) + AQI (Open-Meteo) + moon (NASA) + a Today/Tonight suggestion.

const STATION_ID = '168737';

const SHOWERS = [
  { name:'Perseids',       peak:'08-12' },
  { name:'Orionids',       peak:'10-21' },
  { name:'Leonids',        peak:'11-17' },
  { name:'Geminids',       peak:'12-14' },
  { name:'Quadrantids',    peak:'01-03' },
  { name:'Lyrids',         peak:'04-22' },
  { name:'Eta Aquariids',  peak:'05-05' },
  { name:'Delta Aquariids',peak:'07-28' },
];

const PLANETS = {
  1:'Venus, W at dusk', 2:'Venus, WSW dusk', 3:'Jupiter, W dusk',
  4:'Jupiter, W dusk',  5:'Saturn, SE pre-dawn', 6:'Saturn, SE midnight',
  7:'Saturn, S midnight',8:'Saturn, S evening',  9:'Saturn, SW evening',
  10:'Saturn, SW eve',  11:'Jupiter, E dusk',   12:'Jupiter, S evening',
};

// Seasonal note for the morning-walk suggestion (central Western Ghats)
const MORNING_NOTE = {
  monsoon:     "the Malabar Whistling Thrush is in full song, and balsams and wild ginger are out along the path",
  postmonsoon: "sunbirds work the late blooms, and yellow sonki and balsam still colour the path",
  cool:        "wintering flycatchers move through the canopy, and the mornings come up misty and still",
  premonsoon:  "the koel and the brainfever bird call through the heat, and golden cassia is in flower",
};

function windLabel(deg){
  const p=['N','NNE','NE','ENE','E','ESE','SE','SSE','S','SSW','SW','WSW','W','WNW','NW','NNW'];
  return p[Math.round((((deg%360)+360)%360)/22.5)%16];
}
function beaufort(ms){
  const k=ms*3.6;
  if(k<2)return'Calm'; if(k<12)return'Light breeze'; if(k<20)return'Gentle breeze';
  if(k<29)return'Moderate'; if(k<39)return'Fresh'; if(k<50)return'Strong'; return'Near gale';
}
function uvLevel(u){
  if(u<=2)return'Low'; if(u<=5)return'Moderate'; if(u<=7)return'High';
  if(u<=10)return'Very high'; return'Extreme';
}
function workCond(t,h,u){
  if(t>35||(t>32&&h>80))return'tough · hydrate often';
  if(u>7)return'go early or late';
  if(t<28&&h<75)return'good conditions';
  return'go early, hydrate';
}
function sprayWindow(rainMm,rainRate,windMs,hour){
  const k=windMs*3.6;
  if(rainMm>5) return{open:false,label:'Hold — rain today'};
  if(rainRate>0.5) return{open:false,label:'Hold — raining now'};
  if(k>15)     return{open:false,label:'Hold — wind too high'};
  if(hour>=7&&hour<=17) return{open:false,label:'Hold — bees active'};
  return{open:true,label:'Open · spray now'};
}
function nextShower(now){
  const y=now.getUTCFullYear();
  const mmdd=String(now.getUTCMonth()+1).padStart(2,'0')+'-'+String(now.getUTCDate()).padStart(2,'0');
  for(const s of SHOWERS) if(s.peak>=mmdd) return`${s.name} · ${s.peak.replace('-',' ')} ${y}`;
  const f=SHOWERS[0]; return`${f.name} · ${f.peak.replace('-',' ')} ${y+1}`;
}
function moonPhaseName(illum,waxing){
  if(illum<3) return'New moon';
  if(illum<45) return waxing?'Waxing crescent':'Waning crescent';
  if(illum<55) return'Quarter moon';
  if(illum<88) return waxing?'Waxing gibbous':'Waning gibbous';
  return'Full moon';
}
function aqiCategory(v){
  if(v===null) return'Regional est.';
  if(v<=20)return'Good'; if(v<=40)return'Fair'; if(v<=60)return'Moderate';
  if(v<=80)return'Poor'; return'Very poor';
}

// --- time helpers (IST) ---
function istParts(ms){
  const d=new Date(ms+5.5*3600*1000);
  return { y:d.getUTCFullYear(), mo:d.getUTCMonth()+1, day:d.getUTCDate(),
           h:d.getUTCHours(), min:d.getUTCMinutes(), dateStr:d.toISOString().slice(0,10) };
}
function fmtISTfromMs(ms){
  const p=istParts(ms); let h=p.h; const m=String(p.min).padStart(2,'0');
  const ap=h<12?'am':'pm'; h=h%12||12; return `${h}:${m} ${ap}`;
}
function hourLabelIST(ms){
  const h=istParts(ms).h;
  return h===0?'12 am':h<12?`${h} am`:h===12?'noon':`${h-12} pm`;
}

// --- sky-state classification ---
function classifySky(icon,cond){
  const s=((icon||'')+' '+(cond||'')).toLowerCase();
  if(/rain|thunder|sleet|snow|storm|drizzle/.test(s)) return 'wet';
  if(/fog|mist|haz/.test(s)) return 'fog';
  if(/partly/.test(s)) return 'partly';
  if(/cloud|overcast/.test(s)) return 'cloudy';
  if(/clear|sunny|fair/.test(s)) return 'clear';
  return 'clear';
}
function skyFromWmo(c){
  if(c==null) return 'clear';
  if(c===0) return 'clear';
  if(c<=2) return 'partly';
  if(c===3) return 'cloudy';
  if(c===45||c===48) return 'fog';
  if(c>=51) return 'wet';
  return 'clear';
}
function seasonOf(m){
  if(m>=6&&m<=9) return 'monsoon';
  if(m>=10&&m<=11) return 'postmonsoon';
  if(m===12||m<=2) return 'cool';
  return 'premonsoon';
}

// --- the Today / Tonight suggestion ---
function makeSuggestion(o){
  const {isDay,isMorning,sky,feels,uv,moonIllum,season,rainSoon}=o;
  if(isDay){
    if(rainSoon) return "Rain about — a day for sheltered jobs; let the plots drink.";
    if(feels>=32 && uv>=8) return "Hot with strong sun — best to stay in the shade and out of the midday heat.";
    if(isMorning && (sky==='clear'||sky==='partly') && feels<32)
      return `A fine morning for a walk — ${MORNING_NOTE[season]||'listen for the season\u2019s birdsong and look for what\u2019s in bloom'}.`;
    if(sky==='clear') return feels>=24
      ? "Clear and bright — a fine day out in the fields."
      : "Bright and mild — good weather for a walk through the grove.";
    if(sky==='partly') return "Sun and cloud — comfortable hours for working outside.";
    if(sky==='fog')    return "Mist in the canopy — a soft, slow morning on the farm.";
    if(feels>=24) return "Soft cloud, warm air — easy working weather.";
    if(feels<=20) return "Grey and cool — good cover for a long day's work.";
    return "Soft cloud cover — comfortable working weather.";
  }
  // night
  if(rainSoon) return "Rain moving in — a night for the porch and the sound of it on the roof.";
  if(sky==='clear'){
    if((moonIllum??0)>=70) return "Clear skies, bright moon — a fine night for a moonlit walk.";
    if(feels>=24) return "Clear and warm — a night for dinner under the stars.";
    return "Clear and dark — a great night for stargazing.";
  }
  if(sky==='partly') return "Breaks in the cloud — catch the stars between them.";
  if(sky==='fog')    return "Mist settling in — a quiet, lantern-lit kind of night.";
  if(feels<=20) return "Cloudy and cool — a good night for a campfire.";
  if(feels>=24) return "Warm under the clouds — a good night for a barbecue.";
  return "Soft cloud cover — a calm night for a slow evening.";
}

exports.handler = async function(){
  const TOKEN = process.env.TEMPEST_TOKEN;
  const hdrs = {
    'Content-Type':'application/json',
    'Cache-Control':'public, max-age=120',
    'Access-Control-Allow-Origin':'*',
  };
  if(!TOKEN) return{statusCode:500,headers:hdrs,body:JSON.stringify({error:'TEMPEST_TOKEN missing'})};

  try{
    // --- 1. Tempest current observation ---
    const tRes = await fetch(
      `https://swd.weatherflow.com/swd/rest/observations/station/${STATION_ID}?token=${TOKEN}`
    );
    if(!tRes.ok) throw new Error(`Tempest HTTP ${tRes.status}`);
    const tData = await tRes.json();
    const obs   = tData.obs[0];
    const lat   = tData.latitude  ?? tData.station_meta?.latitude  ?? 14.05;
    const lon   = tData.longitude ?? tData.station_meta?.longitude ?? 75.10;

    const windAvg   = obs.wind_avg ?? 0;            // m/s
    const windGust  = obs.wind_gust ?? 0;
    const windDeg   = obs.wind_direction ?? 0;
    const pressure  = obs.sea_level_pressure ?? obs.barometric_pressure ?? obs.station_pressure ?? 0;
    const airTemp   = obs.air_temperature ?? 0;
    const humidity  = obs.relative_humidity ?? 0;
    const uv        = obs.uv ?? 0;
    const rainRate  = obs.precip ?? 0;              // mm in last minute
    const precipDay = obs.precip_accum_local_day ?? 0;
    const feelsLike = obs.feels_like ?? airTemp;
    const dewpoint  = obs.dew_point ?? 0;

    const nowMs = Date.now();
    const todayStr = istParts(nowMs).dateStr;

    // --- 2. Forecast: Tempest better_forecast (primary), Open-Meteo (fallback) ---
    let sunrise='—', sunset='—', nextRainLabel='Low chance';
    let sunriseMs=null, sunsetMs=null, skyState='clear', forecastSource='Tempest';

    let bfOK=false;
    try{
      const bfRes=await fetch(
        `https://swd.weatherflow.com/swd/rest/better_forecast?station_id=${STATION_ID}&token=${TOKEN}`
      );
      if(bfRes.ok){
        const bf=await bfRes.json();
        const day0=bf.forecast?.daily?.[0];
        if(day0?.sunrise){ sunriseMs=day0.sunrise*1000; sunrise=fmtISTfromMs(sunriseMs); }
        if(day0?.sunset){  sunsetMs =day0.sunset*1000;  sunset =fmtISTfromMs(sunsetMs); }
        skyState=classifySky(bf.current_conditions?.icon, bf.current_conditions?.conditions);
        const hourly=bf.forecast?.hourly||[];
        for(const hr of hourly){
          const ms=(hr.time||0)*1000;
          if(ms>nowMs && (hr.precip_probability??0)>=50){
            const prefix=istParts(ms).dateStr!==todayStr?'tmrw ':'';
            nextRainLabel=`${prefix}~${hourLabelIST(ms)} · ${hr.precip_probability}%`;
            break;
          }
        }
        bfOK = (sunriseMs!=null || hourly.length>0);
      }
    }catch{}

    if(!bfOK){
      forecastSource='Open-Meteo';
      try{
        const fRes=await fetch(
          `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}`+
          `&hourly=precipitation_probability&daily=sunrise,sunset&current=weather_code`+
          `&timezone=Asia%2FKolkata&forecast_days=2`
        );
        if(fRes.ok){
          const fd=await fRes.json();
          if(fd.daily?.sunrise?.[0]){ sunriseMs=new Date(fd.daily.sunrise[0]+':00+05:30').getTime(); sunrise=fmtISTfromMs(sunriseMs); }
          if(fd.daily?.sunset?.[0]){  sunsetMs =new Date(fd.daily.sunset[0]+':00+05:30').getTime();  sunset =fmtISTfromMs(sunsetMs); }
          skyState=skyFromWmo(fd.current?.weather_code);
          const probs=fd.hourly?.precipitation_probability||[];
          const times=fd.hourly?.time||[];
          for(let i=0;i<probs.length;i++){
            const t=new Date(times[i]+':00+05:30');
            if(t.getTime()>nowMs && probs[i]>=50){
              const h=parseInt(times[i].slice(11,13),10);
              const label=h===0?'12 am':h<12?`${h} am`:h===12?'noon':`${h-12} pm`;
              const prefix=times[i].slice(0,10)!==todayStr?'tmrw ':'';
              nextRainLabel=`${prefix}~${label} · ${probs[i]}%`;
              break;
            }
          }
        }
      }catch{}
    }

    // --- 3. Open-Meteo Air Quality ---
    let aqi=null;
    try{
      const aqiRes=await fetch(
        `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lon}&current=european_aqi&timezone=Asia%2FKolkata`
      );
      if(aqiRes.ok){ const d=await aqiRes.json(); aqi=d.current?.european_aqi??null; }
    }catch{}

    // --- 4. NASA Dial-A-Moon ---
    let moonImg=null, moonIllum=null, moonPhase='—';
    try{
      const utcHour=new Date().toISOString().slice(0,13);
      const mRes=await fetch(`https://svs.gsfc.nasa.gov/api/dialamoon/${utcHour}:00`);
      if(mRes.ok){
        const md=await mRes.json();
        moonImg   = md.image?.url||null;
        moonIllum = Math.round(md.phase ?? 0);   // 'phase' is % illuminated
        const age = md.age ?? 15;
        moonPhase = moonPhaseName(moonIllum, age<14.76);
      }
    }catch{}

    // --- 5. Derived / computed ---
    const p=istParts(nowMs);
    const hour=p.h, month=p.mo;
    const spray=sprayWindow(precipDay,rainRate,windAvg,hour);
    const shower=nextShower(new Date(nowMs+5.5*3600*1000));
    const planet=PLANETS[month]||'Saturn, check sky';

    let monsoonPct=null, monsoonStatus=null;
    if(month>=6&&month<=9){ monsoonPct=41; monsoonStatus='below normal'; }

    // day/night + morning window
    let isDay, isMorning=false;
    if(sunriseMs!=null && sunsetMs!=null){
      isDay = nowMs>=sunriseMs && nowMs<sunsetMs;
      isMorning = isDay && nowMs < sunriseMs+3*3600*1000;
    }else{
      isDay = hour>=6 && hour<18;
      isMorning = hour>=6 && hour<9;
    }

    const rainSoon = skyState==='wet' || rainRate>0;
    const suggestion = makeSuggestion({
      isDay, isMorning, sky:skyState, feels:feelsLike, uv,
      moonIllum, season:seasonOf(month), rainSoon,
    });

    const body={
      updated: new Date().toISOString(),
      station:{ id:STATION_ID, lat, lon },
      wind:{
        speed_kmh: Math.round(windAvg*3.6*10)/10,
        gust_kmh:  Math.round(windGust*3.6*10)/10,
        dir_deg:   Math.round(windDeg),
        dir_label: windLabel(windDeg),
        beaufort:  beaufort(windAvg),
      },
      weather:{
        temp_c:      Math.round(airTemp*10)/10,
        feels_like_c:Math.round(feelsLike*10)/10,
        humidity_pct:Math.round(humidity),
        uv_index:    Math.round(uv*10)/10,
        uv_level:    uvLevel(uv),
        pressure_mb: Math.round(pressure*10)/10,
        dewpoint_c:  Math.round(dewpoint*10)/10,
        sunrise, sunset,
        work_condition: workCond(airTemp,humidity,uv),
      },
      rain:{
        today_mm:    Math.round(precipDay*10)/10,
        rate_mmph:   Math.round(rainRate*60*10)/10,
        next_rain:   nextRainLabel,
        spray:       spray,
        monsoon_pct: monsoonPct,
        monsoon_status: monsoonStatus,
      },
      aqi:{ value:aqi, category:aqiCategory(aqi), source:'Open-Meteo · regional' },
      moon:{ image_url:moonImg, illumination_pct:moonIllum, phase:moonPhase },
      sky:{
        planet, shower,
        state: skyState,
        is_day: isDay,
        suggestion,
        suggestion_label: isDay?'Today':'Tonight',
      },
      forecast_source: forecastSource,
    };

    return{statusCode:200, headers:hdrs, body:JSON.stringify(body)};

  }catch(err){
    return{statusCode:500,headers:hdrs,body:JSON.stringify({error:err.message})};
  }
};
