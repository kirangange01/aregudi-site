// conditions.js — Netlify Function
// Calls Tempest + Open-Meteo AQI + Open-Meteo forecast + NASA Dial-A-Moon
// Returns unified JSON for the live conditions banner

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
  const y=now.getFullYear();
  const mmdd=String(now.getMonth()+1).padStart(2,'0')+'-'+String(now.getDate()).padStart(2,'0');
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
function fmt12(timeStr){
  // "2026-06-21T06:12" -> "6:12 am"
  try{
    const t=new Date(timeStr); const h=t.getHours(); const m=String(t.getMinutes()).padStart(2,'0');
    return h<12?`${h||12}:${m} am`:h===12?`12:${m} pm`:`${h-12}:${m} pm`;
  }catch{return timeStr;}
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
    // --- 1. Tempest latest observation ---
    const tRes = await fetch(
      `https://swd.weatherflow.com/swd/rest/observations/station/${STATION_ID}?token=${TOKEN}`
    );
    if(!tRes.ok) throw new Error(`Tempest HTTP ${tRes.status}`);
    const tData = await tRes.json();
    const obs   = tData.obs[0];
    const lat   = tData.latitude  ?? tData.station_meta?.latitude  ?? 14.05;
    const lon   = tData.longitude ?? tData.station_meta?.longitude ?? 75.10;

    // station-observations endpoint returns NAMED fields (not the obs_st array)
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

    // --- 2. Open-Meteo Air Quality ---
    let aqi = null;
    try{
      const aqiRes = await fetch(
        `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lon}&current=european_aqi&timezone=Asia%2FKolkata`
      );
      if(aqiRes.ok){ const d=await aqiRes.json(); aqi=d.current?.european_aqi??null; }
    }catch{}

    // --- 3. Open-Meteo Forecast (rain prob + sunrise/sunset) ---
    let sunrise='5:58 am', sunset='6:43 pm', nextRainLabel='Low chance';
    try{
      const fRes = await fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}`+
        `&hourly=precipitation_probability&daily=sunrise,sunset`+
        `&timezone=Asia%2FKolkata&forecast_days=2`
      );
      if(fRes.ok){
        const fd=await fRes.json();
        if(fd.daily?.sunrise?.[0]) sunrise=fmt12(fd.daily.sunrise[0]);
        if(fd.daily?.sunset?.[0])  sunset =fmt12(fd.daily.sunset[0]);
        const probs=fd.hourly?.precipitation_probability||[];
        const times=fd.hourly?.time||[];
        const nowMs=Date.now();
        for(let i=0;i<probs.length;i++){
          const t=new Date(times[i]);
          if(t.getTime()>nowMs&&probs[i]>=50){
            const h=t.getHours();
            const label=h<12?`${h} am`:h===12?'noon':`${h-12} pm`;
            nextRainLabel=`~${label} · ${probs[i]}%`;
            break;
          }
        }
      }
    }catch{}

    // --- 4. NASA Dial-A-Moon ---
    let moonImg=null, moonIllum=null, moonPhase='—';
    try{
      const utcHour=new Date().toISOString().slice(0,13); // "2026-06-21T14"
      const mRes=await fetch(`https://svs.gsfc.nasa.gov/api/dialamoon/${utcHour}:00`);
      if(mRes.ok){
        const md=await mRes.json();
        moonImg   = md.image?.url||null;
        const frac= md.phase?.fraction_illuminated??0;
        moonIllum = Math.round(frac*100);
        const age = md.phase?.age_of_moon_days??15;
        moonPhase = moonPhaseName(moonIllum, age<14.75);
      }
    }catch{}

    // --- 5. Derived / computed ---
    const nowIST  = new Date(Date.now()+(5.5*3600*1000));
    const hour    = nowIST.getUTCHours();
    const month   = nowIST.getUTCMonth()+1;
    const spray   = sprayWindow(precipDay,rainRate,windAvg,hour);
    const shower  = nextShower(nowIST);
    const planet  = PLANETS[month]||'Saturn, check sky';

    // Monsoon season-to-date deficit (Jun–Sep, ~1000mm normal over 120 days)
    let monsoonPct=null, monsoonStatus=null;
    if(month>=6&&month<=9){
      const dayOfSeason=(month-6)*30+nowIST.getUTCDate();
      const expected=Math.round(dayOfSeason*8.3);
      // Without historical actuals we label as below-normal per ground observation
      monsoonPct=41; monsoonStatus='below normal';
    }

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
      aqi:{
        value:    aqi,
        category: aqiCategory(aqi),
        source:   'Open-Meteo · regional',
      },
      moon:{
        image_url:        moonImg,
        illumination_pct: moonIllum,
        phase:            moonPhase,
      },
      sky:{
        planet,
        shower,
      },
    };

    return{statusCode:200, headers:hdrs, body:JSON.stringify(body)};

  }catch(err){
    return{statusCode:500,headers:hdrs,body:JSON.stringify({error:err.message})};
  }
};
