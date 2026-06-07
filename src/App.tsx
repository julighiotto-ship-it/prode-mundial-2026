import { useState, useEffect, useCallback, useRef } from "react";

const DB_URL = "https://prode-mundial-2026-bcbb6-default-rtdb.firebaseio.com";

async function fbSet(path: string, data: any) {
  await fetch(`${DB_URL}/${path}.json`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
}
function fbListen(path: string, cb: (v: any) => void) {
  const es = new EventSource(`${DB_URL}/${path}.json`);
  es.addEventListener("put", (e: any) => {
    try { const d = JSON.parse(e.data); if (d.data !== undefined) cb(d.data); } catch {}
  });
  return () => es.close();
}

const ADMIN_PASSWORD = "mundial2026admin";
const EMPTY_PREDS = { groups:{} as any, elim:{} as any, specials:{} as any };

const GROUPS = [
  { id:"A", seed:"México",     teams:["México","Ecuador","Haití","Bosnia-Herz."] },
  { id:"B", seed:"Canadá",     teams:["Canadá","Venezuela","Rumanía","Chile"] },
  { id:"C", seed:"Brasil",     teams:["Brasil","Marruecos","Haití","Escocia"] },
  { id:"D", seed:"EE.UU.",     teams:["Estados Unidos","Paraguay","Australia","Turquía"] },
  { id:"E", seed:"Alemania",   teams:["Alemania","C. de Marfil","Curazao","Ecuador"] },
  { id:"F", seed:"P. Bajos",   teams:["Países Bajos","Japón","Argelia","Túnez"] },
  { id:"G", seed:"Bélgica",    teams:["Bélgica","Egipto","Irán","Nueva Zelanda"] },
  { id:"H", seed:"España",     teams:["España","Arabia Saudita","Cabo Verde","Uruguay"] },
  { id:"I", seed:"Francia",    teams:["Francia","Ghana","Sudáfrica","Senegal"] },
  { id:"J", seed:"Argentina",  teams:["Argentina","Perú","Suiza","Rep. Congo"] },
  { id:"K", seed:"Portugal",   teams:["Portugal","Panamá","Corea del Sur","Colombia"] },
  { id:"L", seed:"Inglaterra", teams:["Inglaterra","Serbia","Croacia","Camerún"] },
];

const GROUP_MATCHES = GROUPS.map(g => {
  const [a,b,c,d] = g.teams;
  return { groupId: g.id, matches: [
    {id:`${g.id}1`,home:a,away:b},{id:`${g.id}2`,home:c,away:d},
    {id:`${g.id}3`,home:a,away:c},{id:`${g.id}4`,home:b,away:d},
    {id:`${g.id}5`,home:a,away:d},{id:`${g.id}6`,home:b,away:c},
  ]};
});

const ELIM_PHASES = [
  { id:"r32", label:"16avos de Final",   slots:32 },
  { id:"r16", label:"Octavos de Final",  slots:16 },
  { id:"r8",  label:"Cuartos de Final",  slots:8  },
  { id:"r4",  label:"Semifinales",       slots:4  },
  { id:"r2",  label:"Final + 3° Puesto", slots:2  },
];

// Cruces reales del Mundial 2026 (16avos de final, según FIFA)
// Los 8 terceros clasificados (*) se definen al terminar la fase de grupos
const ELIM_R32_FIXTURES = [
  { id:"r32_m1",  home:"2° Grupo A",  away:"2° Grupo B" },
  { id:"r32_m2",  home:"1° Grupo C",  away:"2° Grupo D" },
  { id:"r32_m3",  home:"1° Grupo E",  away:"3° Grupo A/B/C/D/F*" },
  { id:"r32_m4",  home:"1° Grupo F",  away:"2° Grupo C" },
  { id:"r32_m5",  home:"1° Grupo E",  away:"2° Grupo F" },
  { id:"r32_m6",  home:"1° Grupo I",  away:"3° Grupo C/D/F/G/H*" },
  { id:"r32_m7",  home:"1° Grupo A",  away:"3° Grupo C/E/F/H/I*" },
  { id:"r32_m8",  home:"1° Grupo L",  away:"3° Grupo E/H/I/J/K*" },
  { id:"r32_m9",  home:"1° Grupo D",  away:"3° Grupo B/E/F/I/J*" },
  { id:"r32_m10", home:"1° Grupo G",  away:"3° Grupo A/E/H/I/J*" },
  { id:"r32_m11", home:"2° Grupo K",  away:"2° Grupo L" },
  { id:"r32_m12", home:"1° Grupo H",  away:"2° Grupo J" },
  { id:"r32_m13", home:"1° Grupo B",  away:"3° Grupo E/F/G/I/J*" },
  { id:"r32_m14", home:"1° Grupo J",  away:"2° Grupo H" },
  { id:"r32_m15", home:"1° Grupo K",  away:"3° Grupo D/E/I/J/L*" },
  { id:"r32_m16", home:"2° Grupo D",  away:"2° Grupo G" },
];

const SPECIALS = [
  { id:"champion", label:"🥇 Campeón del Mundo",            pts:15 },
  { id:"runner",   label:"🥈 Subcampeón",                    pts:10 },
  { id:"scorer",   label:"👟 Goleador del Torneo",           pts:8  },
  { id:"keeper",   label:"🧤 Mejor Arquero (Guante de Oro)", pts:6  },
  { id:"mvp",      label:"⭐ Mejor Jugador (Balón de Oro)",  pts:6  },
];

function calcScore(predictions: any, results: any, adminData: any) {
  const preds = predictions || EMPTY_PREDS;
  let n1=0, n2=0, n3=0;
  for (const {matches} of GROUP_MATCHES) {
    for (const m of matches) {
      const pred = preds.groups?.[m.id];
      const real = results?.groups?.[m.id];
      if (!pred||!real||real.home==null||real.home==="") continue;
      const rH=parseInt(real.home),rA=parseInt(real.away);
      const rW=rH>rA?"home":rA>rH?"away":"draw";
      if (pred.winner===rW) n1+=1;
      const pH=parseInt(pred.home),pA=parseInt(pred.away);
      if (!isNaN(pH)&&!isNaN(pA)&&pH===rH&&pA===rA) n2+=3;
    }
  }

  for (const [mid,pred] of Object.entries(preds.elim||{}) as any) {
    const real=results?.elim?.[mid];
    if (!real||real.home==null||real.home==="") continue;
    const rH=parseInt(real.home),rA=parseInt(real.away);
    if ((pred as any).winner===(rH>rA?"home":"away")) n1+=2;
    const pH=parseInt((pred as any).home),pA=parseInt((pred as any).away);
    if (!isNaN(pH)&&!isNaN(pA)&&pH===rH&&pA===rA) n2+=5;
  }
  for (const sp of SPECIALS) {
    const pred=preds.specials?.[sp.id];
    const real=adminData?.specials?.[sp.id];
    if (pred&&real&&pred.trim().toLowerCase()===real.trim().toLowerCase()) n3+=sp.pts;
  }
  return {n1,n2,n3,total:n1+n2+n3};
}

const T={
  grass:"#0a1f0a",grass2:"#0d2b0d",cel:"#6AABCF",cel2:"#8DC4E0",celDark:"#1a4a6a",
  white:"#e8f4f8",whiteDim:"rgba(232,244,248,0.55)",gray:"rgba(232,244,248,0.4)",
  green:"#6DC26D",gold:"#D4A84B",red:"#C0392B",navy:"#03120a"
};

const css=`
  @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Barlow:wght@400;600;700&family=Barlow+Condensed:wght@700&display=swap');
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:'Barlow',sans-serif;background:#0a1f0a;color:#e8f4f8;min-height:100vh}
  ::-webkit-scrollbar{width:6px}::-webkit-scrollbar-thumb{background:#6AABCF;border-radius:3px}

  /* Grass texture + field lines */
  .app{min-height:100vh;background-color:#0a1f0a;
    background-image:
      repeating-linear-gradient(0deg,transparent,transparent 38px,rgba(255,255,255,0.018) 38px,rgba(255,255,255,0.018) 40px),
      repeating-linear-gradient(90deg,transparent,transparent 58px,rgba(255,255,255,0.01) 58px,rgba(255,255,255,0.01) 60px);
  }

  /* NAV */
  .nav{background:#03120a;border-bottom:2px solid #6AABCF;padding:0 1rem;display:flex;align-items:center;justify-content:space-between;height:54px;position:sticky;top:0;z-index:100}
  .nav-logo{font-family:'Bebas Neue',sans-serif;font-size:1.4rem;color:#e8f4f8;letter-spacing:3px}
  .nav-logo span{color:#6AABCF}
  .nav-tabs{display:flex;gap:.2rem;flex-wrap:wrap}
  .nav-tab{background:none;border:none;color:rgba(232,244,248,0.35);font-family:'Barlow',sans-serif;font-size:.78rem;font-weight:700;padding:.4rem .7rem;border-radius:6px;cursor:pointer;transition:.2s;text-transform:uppercase}
  .nav-tab:hover{color:#e8f4f8;background:rgba(106,171,207,0.08)}
  .nav-tab.active{color:#e8f4f8;background:rgba(106,171,207,0.15);border-bottom:2px solid #6AABCF}

  /* HERO */
  .hero-badge{display:inline-block;background:#6AABCF;color:#03120a;font-family:'Barlow Condensed',sans-serif;font-size:.72rem;font-weight:700;letter-spacing:3px;padding:.25rem .9rem;border-radius:2rem;margin-bottom:.8rem}
  .hero-title{font-family:'Bebas Neue',sans-serif;font-size:clamp(2.8rem,7vw,5rem);line-height:.95;letter-spacing:3px;color:#e8f4f8;text-shadow:0 2px 0 rgba(0,0,0,0.5)}
  .hero-title .cel{color:#6AABCF}
  .hero-stars{color:#6AABCF;font-size:1.1rem;letter-spacing:.5rem;margin-bottom:.8rem}
  .hero-stripes{position:absolute;inset:0;background:repeating-linear-gradient(-55deg,transparent,transparent 18px,rgba(106,171,207,0.05) 18px,rgba(106,171,207,0.05) 20px);pointer-events:none}

  /* CARDS */
  .card{background:rgba(8,30,12,0.75);border:1px solid rgba(106,171,207,0.18);border-radius:12px;padding:1.1rem;transition:.2s;position:relative;overflow:hidden}
  .card::before{content:'';position:absolute;top:0;left:0;width:3px;height:100%;background:#6AABCF;border-radius:3px 0 0 3px}
  .card:hover{border-color:rgba(106,171,207,0.35)}
  .card-cel{background:rgba(106,171,207,0.1);border-color:#6AABCF}
  .card-cel::before{background:#6AABCF}

  /* Jersey texture cards */
  .card-jersey-cel{
    background-color:rgba(106,171,207,0.85);
    background-image:repeating-linear-gradient(90deg,rgba(255,255,255,0.06) 0px,rgba(255,255,255,0.06) 1px,transparent 1px,transparent 4px),repeating-linear-gradient(0deg,rgba(0,0,0,0.04) 0px,rgba(0,0,0,0.04) 1px,transparent 1px,transparent 4px);
    border-color:#6AABCF
  }
  .card-jersey-cel::before{background:#03120a}
  .card-jersey-white{
    background-color:rgba(232,244,248,0.88);
    background-image:repeating-linear-gradient(90deg,rgba(106,171,207,0.08) 0px,rgba(106,171,207,0.08) 1px,transparent 1px,transparent 4px),repeating-linear-gradient(0deg,rgba(106,171,207,0.05) 0px,rgba(106,171,207,0.05) 1px,transparent 1px,transparent 4px);
    border-color:rgba(106,171,207,0.4)
  }
  .card-jersey-white::before{background:#6AABCF}

  .section-title{font-family:'Bebas Neue',sans-serif;font-size:1.2rem;letter-spacing:2px;color:#6AABCF;margin-bottom:.9rem;display:flex;align-items:center;gap:.5rem}
  .section-title::after{content:'';flex:1;height:1px;background:linear-gradient(90deg,rgba(106,171,207,0.3),transparent)}

  /* BUTTONS */
  .btn{border:none;border-radius:8px;cursor:pointer;font-family:'Barlow',sans-serif;font-weight:700;transition:.2s;text-transform:uppercase}
  .btn-gold{background:#6AABCF;color:#03120a;padding:.6rem 1.3rem;font-size:.83rem}
  .btn-gold:hover{transform:translateY(-1px);filter:brightness(1.1)}
  .btn-outline{background:transparent;border:1.5px solid #6AABCF;color:#6AABCF;padding:.45rem 1.1rem;font-size:.78rem}
  .btn-outline:hover{background:rgba(106,171,207,0.1)}
  .btn-sm{padding:.3rem .8rem;font-size:.75rem}

  /* INPUTS */
  input[type=text],input[type=password],select{background:rgba(3,18,10,0.7);border:1.5px solid rgba(106,171,207,0.25);border-radius:8px;color:#e8f4f8;font-family:'Barlow',sans-serif;font-size:.88rem;padding:.5rem .75rem;width:100%;transition:.2s;outline:none}
  input:focus,select:focus{border-color:#6AABCF;box-shadow:0 0 0 3px rgba(106,171,207,0.12)}
  input::placeholder{color:rgba(232,244,248,0.3)}
  select option{background:#0d2b0d}
  .input-score{width:48px!important;text-align:center;padding:.38rem .25rem!important}

  /* MATCH ROW */
  .match-row{display:grid;grid-template-columns:1fr auto auto auto 1fr auto;align-items:center;gap:.5rem;padding:.6rem .7rem;border-radius:8px;background:rgba(255,255,255,0.025);border:1px solid transparent;transition:.2s;margin-bottom:.3rem}
  .match-row:hover{border-color:rgba(106,171,207,0.2);background:rgba(255,255,255,0.045)}
  .team-name{font-size:.85rem;font-weight:600;color:#e8f4f8}
  .team-name.home{text-align:right}
  .vs-label{font-family:'Bebas Neue',sans-serif;font-size:.85rem;color:rgba(232,244,248,0.3);min-width:18px;text-align:center}
  .score-real{font-family:'Bebas Neue',sans-serif;font-size:1.05rem;color:#6AABCF;min-width:20px;text-align:center}
  .pts-badge{font-size:.68rem;font-weight:700;padding:.12rem .45rem;border-radius:4px;min-width:32px;text-align:center}
  .pts-badge.good{background:rgba(109,194,109,0.18);color:#6DC26D;border:1px solid rgba(109,194,109,0.3)}
  .pts-badge.exact{background:rgba(106,171,207,0.18);color:#6AABCF;border:1px solid rgba(106,171,207,0.4)}
  .pts-badge.miss{background:rgba(192,57,43,0.1);color:#F08080;border:1px solid rgba(192,57,43,0.2)}

  /* GROUP HEADER */
  .group-header{display:flex;align-items:center;gap:.7rem;margin-bottom:.7rem;padding-bottom:.45rem;border-bottom:1px solid rgba(106,171,207,0.15)}
  .group-letter{font-family:'Bebas Neue',sans-serif;font-size:1.9rem;color:#6AABCF;line-height:1;width:2rem;text-align:center;text-shadow:0 0 20px rgba(106,171,207,0.3)}

  /* LEADERBOARD */
  .lb-row{display:grid;grid-template-columns:2.2rem 1fr 3rem 3rem 3rem 3.5rem;align-items:center;gap:.4rem;padding:.65rem .9rem;border-radius:10px;margin-bottom:.35rem;transition:.2s}
  .lb-row:hover{transform:translateX(2px)}
  .lb-rank{font-family:'Bebas Neue',sans-serif;font-size:1.2rem;text-align:center}
  .lb-name{font-weight:600;font-size:.88rem}
  .lb-pts{text-align:center;font-size:.82rem;font-weight:700}
  .lb-total{font-family:'Bebas Neue',sans-serif;font-size:1.15rem;text-align:center;color:#e8f4f8}
  .lb-gold{background:rgba(106,171,207,0.15);border:1px solid rgba(106,171,207,0.35)}
  .lb-silver{background:rgba(232,244,248,0.05);border:1px solid rgba(232,244,248,0.1)}
  .lb-bronze{background:rgba(212,168,75,0.07);border:1px solid rgba(212,168,75,0.2)}
  .lb-norm{background:rgba(255,255,255,0.025);border:1px solid rgba(255,255,255,0.05)}

  /* SPECIALS */
  .special-card{display:grid;grid-template-columns:2.8rem 1fr auto;align-items:center;gap:.9rem;padding:.85rem .9rem;border-radius:12px;background:rgba(8,30,12,0.7);border:1px solid rgba(106,171,207,0.18);margin-bottom:.55rem}

  /* INNER TABS */
  .inner-tabs{display:flex;gap:.25rem;flex-wrap:wrap;margin-bottom:.9rem}
  .inner-tab{background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);color:rgba(232,244,248,0.4);font-size:.75rem;font-weight:700;padding:.32rem .75rem;border-radius:6px;cursor:pointer;transition:.2s;text-transform:uppercase}
  .inner-tab.active{background:rgba(106,171,207,0.15);border-color:#6AABCF;color:#e8f4f8}

  /* CHIP */
  .chip{display:inline-block;background:rgba(106,171,207,0.12);color:#6AABCF;border:1px solid rgba(106,171,207,0.25);border-radius:4px;font-size:.7rem;font-weight:700;padding:.12rem .45rem}

  /* DIVIDER — dashed field line */
  .divider{height:1px;margin:.9rem 0;background:repeating-linear-gradient(90deg,rgba(106,171,207,0.2) 0,rgba(106,171,207,0.2) 6px,transparent 6px,transparent 10px)}

  .grid-2{display:grid;grid-template-columns:1fr 1fr;gap:.9rem}
  .grid-3{display:grid;grid-template-columns:repeat(3,1fr);gap:.7rem}
  .alert-warn{padding:.7rem .9rem;border-radius:8px;font-size:.83rem;margin-bottom:.9rem;background:rgba(212,168,75,0.1);border:1px solid rgba(212,168,75,0.3);color:#D4A84B}
  .flash{background:#6AABCF;color:#03120a;text-align:center;padding:.45rem;font-weight:700;font-size:.83rem;position:sticky;top:54px;z-index:99}
  .saving{opacity:.6;font-size:.72rem;color:rgba(232,244,248,0.4)}
  @media(max-width:580px){.grid-2,.grid-3{grid-template-columns:1fr}.nav-tab{font-size:.7rem;padding:.35rem .45rem}.lb-row{grid-template-columns:1.8rem 1fr 2.5rem 2.5rem 2.5rem 3rem;gap:.3rem}}
`;

function MatchRow({match,predHome,predAway,predWinner,realHome,realAway,onPredChange,adminMode,onRealChange}:any) {
  const hasReal=realHome!=null&&realHome!==""&&realAway!=null&&realAway!=="";
  const rH=hasReal?parseInt(realHome):null;
  const rA=hasReal?parseInt(realAway):null;
  const rW=hasReal?(rH!>rA!?"home":rA!>rH!?"away":"draw"):null;
  let pts=0,ptsType="";
  if (hasReal&&onPredChange) {
    const pH=parseInt(predHome||""),pA=parseInt(predAway||"");
    if (!isNaN(pH)&&!isNaN(pA)&&pH===rH&&pA===rA){pts=3;ptsType="exact";}
    else if (predWinner===rW){pts=1;ptsType="good";}
    else if (predWinner) ptsType="miss";
  }
  return (
    <div className="match-row">
      <div className="team-name home" style={{color:rW==="home"?'#6AABCF':'#e8f4f8'}}>{match.home}</div>
      {adminMode&&onRealChange?(
        <><input className="input-score" type="text" value={realHome??""} placeholder="–" onChange={e=>onRealChange("home",e.target.value)} style={{width:44}}/><span className="vs-label">–</span><input className="input-score" type="text" value={realAway??""} placeholder="–" onChange={e=>onRealChange("away",e.target.value)} style={{width:44}}/></>
      ):(
        <><span className="score-real">{hasReal?rH:"–"}</span><span className="vs-label">vs</span><span className="score-real">{hasReal?rA:"–"}</span></>
      )}
      <div className="team-name" style={{color:rW==="away"?'#6AABCF':'#e8f4f8'}}>{match.away}</div>
      {!adminMode&&onPredChange&&(
        <div style={{display:"flex",gap:3,alignItems:"center"}}>
          <input className="input-score" type="text" value={predHome??""} placeholder="G" onChange={e=>onPredChange("home",e.target.value)} style={{width:38,fontSize:".78rem"}}/>
          <input className="input-score" type="text" value={predAway??""} placeholder="G" onChange={e=>onPredChange("away",e.target.value)} style={{width:38,fontSize:".78rem"}}/>
          <select value={predWinner||""} onChange={e=>onPredChange("winner",e.target.value)} style={{width:86,fontSize:".73rem",padding:".28rem .35rem"}}>
            <option value="">Ganador</option>
            <option value="home">{match.home.split(" ").pop()}</option>
            <option value="draw">Empate</option>
            <option value="away">{match.away.split(" ").pop()}</option>
          </select>
          {hasReal&&ptsType&&<span className={`pts-badge ${ptsType}`}>{pts>0?`+${pts}`:ptsType==="miss"?"✗":""}</span>}
        </div>
      )}
      {adminMode&&<div/>}
    </div>
  );
}

function GroupSection({myPreds,results,onUpdate}:any) {
  const [ag,setAg]=useState("A");
  const group=GROUPS.find(g=>g.id===ag)!;
  const matches=GROUP_MATCHES.find(g=>g.groupId===ag)?.matches||[];
  const gPreds = myPreds?.groups || {};
  const gResults = results?.groups || {};
  return (
    <div>
      <div className="inner-tabs">{"ABCDEFGHIJKL".split("").map(g=><button key={g} className={`inner-tab ${ag===g?"active":""}`} onClick={()=>setAg(g)}>{g}</button>)}</div>
      <div className="card">
        <div className="group-header">
          <div className="group-letter">{group.id}</div>
          <div><div style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:"1.05rem",letterSpacing:1}}>GRUPO {group.id}</div><div style={{color:'rgba(232,244,248,0.4)',fontSize:".73rem"}}>{group.teams.join(" · ")}</div></div>
          <div className="chip">6 partidos</div>
        </div>
        {matches.map(m=><MatchRow key={m.id} match={m}
          predHome={gPreds[m.id]?.home} predAway={gPreds[m.id]?.away} predWinner={gPreds[m.id]?.winner}
          realHome={gResults[m.id]?.home} realAway={gResults[m.id]?.away}
          onPredChange={(f:string,v:string)=>onUpdate(m.id,f,v)}/>)}
      </div>
    </div>
  );
}



function ElimSection({myPreds,results,onUpdate}:any) {
  const [phase,setPhase]=useState("r32");
  const ph=ELIM_PHASES.find(p=>p.id===phase)!;
  const elimPreds = myPreds?.elim || {};
  const elimResults = results?.elim || {};
  return (
    <div>
      <div className="inner-tabs">{ELIM_PHASES.map(p=><button key={p.id} className={`inner-tab ${phase===p.id?"active":""}`} onClick={()=>setPhase(p.id)}>{p.label}</button>)}</div>
      <div className="card">
        <div className="group-header">
          <div><div style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:"1.05rem",letterSpacing:1}}>{ph.label}</div><div style={{color:'rgba(232,244,248,0.4)',fontSize:".73rem"}}>Ganador: 2pts · Exacto: 5pts</div></div>
          <div className="chip">{ph.slots/2} partidos</div>
        </div>
        {phase==="r32" && <div style={{fontSize:".72rem",color:'rgba(232,244,248,0.4)',marginBottom:".5rem",padding:"0 .3rem"}}>* Los terceros con asterisco se definen al terminar la fase de grupos según tabla de terceros FIFA</div>}
        {Array.from({length:ph.slots/2},(_,i)=>`${phase}_m${i+1}`).map((mid,i)=>{
          // For r32 use official FIFA fixture names as default
          const fixture = phase==="r32" ? ELIM_R32_FIXTURES[i] : null;
          const defaultHome = fixture ? fixture.home : `Equipo ${i*2+1}`;
          const defaultAway = fixture ? fixture.away : `Equipo ${i*2+2}`;
          const home=elimResults[mid]?.homeTeam||defaultHome;
          const away=elimResults[mid]?.awayTeam||defaultAway;
          return (
            <div key={mid}>
              {fixture && <div style={{fontSize:".68rem",color:'#6AABCF',fontWeight:700,padding:".2rem .7rem 0",letterSpacing:".5px"}}>PARTIDO {i+1}</div>}
              <MatchRow match={{home,away}}
                predHome={elimPreds[mid]?.home} predAway={elimPreds[mid]?.away} predWinner={elimPreds[mid]?.winner}
                realHome={elimResults[mid]?.home} realAway={elimResults[mid]?.away}
                onPredChange={(f:string,v:string)=>onUpdate(mid,f,v)}/>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SpecialsSection({myPreds,adminData,onUpdate}:any) {
  const spPreds = myPreds?.specials || {};
  return (
    <div>
      <div className="alert-warn"><strong>⚠️ Cierra el 5 de julio</strong> (mitad del torneo). Completá antes de esa fecha.</div>
      {SPECIALS.map(sp=>{
        const realVal=adminData?.specials?.[sp.id];
        const myVal=spPreds[sp.id];
        const correct=realVal&&myVal&&myVal.trim().toLowerCase()===realVal.trim().toLowerCase();
        return (
          <div key={sp.id} className="special-card" style={{border:realVal?(correct?`1.5px solid ${T.green}`:`1.5px solid ${T.red}`):"1px solid rgba(200,151,58,.2)"}}>
            <div style={{fontSize:"1.5rem",textAlign:"center"}}>{sp.label.split(" ")[0]}</div>
            <div>
              <div style={{fontWeight:600,fontSize:".88rem",marginBottom:".35rem"}}>{sp.label.replace(/^[^\w]+/,"").trim()}</div>
              <input type="text" placeholder="Tu predicción..." value={myVal||""} onChange={e=>onUpdate(sp.id,e.target.value)} style={{fontSize:".83rem"}}/>
              {realVal&&<div style={{fontSize:".73rem",marginTop:".28rem",color:'rgba(232,244,248,0.4)'}}>Real: <strong style={{color:correct?'#6DC26D':'#F08080'}}>{realVal}</strong></div>}
            </div>
            <div style={{textAlign:"center"}}>
              <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:"1.05rem",color:"#D4A84B"}}>{sp.pts}pts</div>
              {realVal&&<div style={{fontSize:".68rem",color:correct?'#6DC26D':'#F08080'}}>{correct?"✓ +"+sp.pts:"✗"}</div>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function AdminPanel({results,adminData,participants,onSaveResults,onSaveAdminData}:any) {
  const [pw,setPw]=useState("");
  const [isAdmin,setIsAdmin]=useState(false);
  const [localR,setLocalR]=useState<any>({groups:{},elim:{},specials:{}});
  const [localA,setLocalA]=useState<any>({specials:{}});
  const [adminTab,setAdminTab]=useState("groups");
  const [activeG,setActiveG]=useState("A");
  const [msg,setMsg]=useState("");
  useEffect(()=>{if(results)setLocalR(results);},[results]);
  useEffect(()=>{if(adminData)setLocalA(adminData);},[adminData]);
  const flash=(m:string)=>{setMsg(m);setTimeout(()=>setMsg(""),2000);};
  if (!isAdmin) return (
    <div className="card" style={{maxWidth:360,margin:"0 auto"}}>
      <div className="section-title" style={{textAlign:"center"}}>⚙️ Acceso Admin</div>
      <p style={{color:'rgba(232,244,248,0.4)',fontSize:".83rem",marginBottom:"1rem",textAlign:"center"}}>Solo el administrador puede cargar resultados.</p>
      <input type="password" placeholder="Contraseña" value={pw} onChange={e=>setPw(e.target.value)} onKeyDown={e=>e.key==="Enter"&&(pw===ADMIN_PASSWORD?setIsAdmin(true):flash("Contraseña incorrecta"))}/>
      <button className="btn btn-gold" style={{width:"100%",marginTop:".7rem"}} onClick={()=>pw===ADMIN_PASSWORD?setIsAdmin(true):flash("Contraseña incorrecta")}>INGRESAR</button>
      {msg&&<div style={{marginTop:".5rem",color:T.red,fontSize:".8rem",textAlign:"center"}}>{msg}</div>}
    </div>
  );
  const group=GROUPS.find(g=>g.id===activeG)!;
  const matches=GROUP_MATCHES.find(g=>g.groupId===activeG)?.matches||[];
  const gR=localR?.groups||{};
  const updG=(mid:string,f:string,v:string)=>setLocalR((p:any)=>({...p,groups:{...(p.groups||{}),[mid]:{...(p.groups?.[mid]||{}),[f]:v}}}));

  const updElim=(mid:string,f:string,v:string)=>{
    setLocalR((p:any)=>{
      const next={...p,elim:{...(p.elim||{}),[mid]:{...(p.elim?.[mid]||{}),[f]:v}}};
      // Auto-save team names immediately so players see them
      if(f==="homeTeam"||f==="awayTeam"){
        setTimeout(()=>onSaveResults(next),300);
      }
      return next;
    });
  };
  const updSp=(id:string,v:string)=>setLocalA((p:any)=>({...p,specials:{...(p.specials||{}),[id]:v}}));
  return (
    <div>
      {msg&&<div className="flash">{msg}</div>}
      <div style={{display:"flex",alignItems:"center",gap:".7rem",marginBottom:"1.2rem"}}>
        <h2 className="section-title" style={{marginBottom:0}}>⚙️ Panel Admin</h2>
        <div className="chip">🔓 Activo</div>
      </div>
      <div className="card" style={{marginBottom:"1rem"}}>
        <div style={{fontSize:".8rem",color:'rgba(232,244,248,0.4)',marginBottom:".5rem",fontWeight:700}}>👥 PARTICIPANTES ({Object.keys(participants||{}).length})</div>
        <div style={{display:"flex",flexWrap:"wrap",gap:".35rem"}}>
          {Object.keys(participants||{}).map(n=><div key={n} style={{background:"rgba(106,171,207,.1)",border:"1px solid #6AABCF",borderRadius:6,padding:".25rem .65rem",fontSize:".78rem",color:"#6AABCF"}}>{n}</div>)}
        </div>
      </div>
      <div className="inner-tabs">
        {[["groups","⚽ Grupos"],["elim","🏆 Eliminatorias"],["specials","⭐ Especiales"]].map(([id,label])=>(
          <button key={id} className={`inner-tab ${adminTab===id?"active":""}`} onClick={()=>setAdminTab(id)}>{label}</button>
        ))}
      </div>
      {adminTab==="groups"&&<div>
        <div className="inner-tabs">{"ABCDEFGHIJKL".split("").map(g=><button key={g} className={`inner-tab ${activeG===g?"active":""}`} onClick={()=>setActiveG(g)}>{g}</button>)}</div>
        <div className="card">
          <div className="group-header" style={{marginBottom:".7rem"}}><div className="group-letter">{group.id}</div><div><div style={{fontFamily:"'Barlow Condensed',sans-serif"}}>Grupo {group.id}</div><div style={{color:'rgba(232,244,248,0.4)',fontSize:".73rem"}}>{group.teams.join(" · ")}</div></div></div>
          {matches.map(m=><MatchRow key={m.id} match={m} adminMode realHome={gR[m.id]?.home} realAway={gR[m.id]?.away} onRealChange={(f:string,v:string)=>updG(m.id,f,v)}/>)}
        </div>
        <button className="btn btn-gold" style={{marginTop:".9rem"}} onClick={()=>{onSaveResults(localR);flash("Grupos guardados ✓");}}>💾 GUARDAR GRUPOS</button>
      </div>}

      {adminTab==="elim"&&<div>
        {ELIM_PHASES.map(ph=>(
          <div key={ph.id} className="card" style={{marginBottom:".9rem"}}>
            <div style={{fontFamily:"'Bebas Neue',sans-serif",color:"#6AABCF",marginBottom:".7rem"}}>{ph.label}</div>
            {Array.from({length:ph.slots/2},(_,i)=>`${ph.id}_m${i+1}`).map((mid,i)=>{
              const fixture = ph.id==="r32" ? ELIM_R32_FIXTURES[i] : null;
              const phHome = fixture ? fixture.home : `Equipo ${i*2+1}`;
              const phAway = fixture ? fixture.away : `Equipo ${i*2+2}`;
              return (
              <div key={mid} style={{marginBottom:".5rem"}}>
                <div style={{fontSize:".7rem",color:'#6AABCF',marginBottom:".2rem",fontWeight:700}}>
                  Partido {i+1}{fixture?` — ${phHome} vs ${phAway}`:""}
                </div>
                <div style={{display:"grid",gridTemplateColumns:"1fr auto 1fr auto",gap:".35rem",alignItems:"center"}}>
                  <input placeholder={phHome} value={localR?.elim?.[mid]?.homeTeam||""} onChange={e=>updElim(mid,"homeTeam",e.target.value)} style={{fontSize:".78rem"}}/>
                  <span style={{color:'rgba(232,244,248,0.35)',fontSize:".78rem"}}>vs</span>
                  <input placeholder={phAway} value={localR?.elim?.[mid]?.awayTeam||""} onChange={e=>updElim(mid,"awayTeam",e.target.value)} style={{fontSize:".78rem"}}/>
                  <div style={{display:"flex",gap:3}}>
                    <input className="input-score" placeholder="G" value={localR?.elim?.[mid]?.home||""} onChange={e=>updElim(mid,"home",e.target.value)} style={{width:44}}/>
                    <input className="input-score" placeholder="G" value={localR?.elim?.[mid]?.away||""} onChange={e=>updElim(mid,"away",e.target.value)} style={{width:44}}/>
                  </div>
                </div>
              </div>
              );
            })}
          </div>
        ))}
        <button className="btn btn-gold" onClick={()=>{onSaveResults(localR);flash("Eliminatorias guardadas ✓");}}>💾 GUARDAR ELIMINATORIAS</button>
      </div>}
      {adminTab==="specials"&&<div>
        <div className="card">
          <div style={{fontFamily:"'Bebas Neue',sans-serif",color:"#6AABCF",marginBottom:".9rem"}}>Resultados Reales — Nivel 3</div>
          {SPECIALS.map(sp=>(
            <div key={sp.id} className="special-card" style={{marginBottom:".5rem"}}>
              <div style={{fontSize:"1.5rem",textAlign:"center"}}>{sp.label.split(" ")[0]}</div>
              <div>
                <div style={{fontWeight:600,fontSize:".85rem",marginBottom:".35rem"}}>{sp.label.replace(/^[^\w]+/,"").trim()}</div>
                <input type="text" placeholder="Resultado real..." value={localA?.specials?.[sp.id]||""} onChange={e=>updSp(sp.id,e.target.value)} style={{fontSize:".83rem"}}/>
              </div>
              <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:"1.05rem",color:"#D4A84B",textAlign:"center"}}>{sp.pts}pts</div>
            </div>
          ))}
        </div>
        <button className="btn btn-gold" style={{marginTop:".75rem"}} onClick={()=>{onSaveAdminData(localA);flash("Especiales guardados ✓");}}>💾 GUARDAR ESPECIALES</button>
      </div>}
    </div>
  );
}

export default function App() {
  const [tab,setTab]=useState("home");
  const [predTab,setPredTab]=useState("groups");
  const [user,setUser]=useState<string|null>(null);
  const [participants,setParticipants]=useState<any>({});
  const [results,setResults]=useState<any>({groups:{},elim:{},specials:{}});
  const [adminData,setAdminData]=useState<any>({specials:{}});
  const [saving,setSaving]=useState(false);
  const [flash,setFlash]=useState("");
  const saveTimer=useRef<any>(null);

  useEffect(()=>{
    const u1=fbListen("participants",(v)=>{if(v)setParticipants(v);});
    const u2=fbListen("results",(v)=>{if(v)setResults(v);});
    const u3=fbListen("adminData",(v)=>{if(v)setAdminData(v);});
    return()=>{u1();u2();u3();};
  },[]);

  const showFlash=(msg:string)=>{setFlash(msg);setTimeout(()=>setFlash(""),2200);};

  const savePred=useCallback((next:any)=>{
    if(saveTimer.current)clearTimeout(saveTimer.current);
    saveTimer.current=setTimeout(async()=>{setSaving(true);await fbSet("participants",next);setSaving(false);},600);
  },[]);

  const updatePrediction=(path:string[],value:string)=>{
    if(!user)return;
    setParticipants((prev:any)=>{
      const next=JSON.parse(JSON.stringify(prev));
      if(!next[user])next[user]={name:user,predictions:{...EMPTY_PREDS}};
      if(!next[user].predictions)next[user].predictions={...EMPTY_PREDS};
      let obj=next[user].predictions;
      for(let i=0;i<path.length-1;i++){if(!obj[path[i]])obj[path[i]]={};obj=obj[path[i]];}
      obj[path[path.length-1]]=value;
      savePred(next);
      return next;
    });
  };

  const saveResults=async(r:any)=>{setSaving(true);await fbSet("results",r);setResults(r);setSaving(false);showFlash("Resultados guardados ✓");};
  const saveAdminData=async(ad:any)=>{setSaving(true);await fbSet("adminData",ad);setAdminData(ad);setSaving(false);showFlash("Datos guardados ✓");};

  const myPreds = user ? (participants[user]?.predictions || {...EMPTY_PREDS}) : {...EMPTY_PREDS};
  const leaderboard=Object.entries(participants).map(([name,data]:any)=>{const s=calcScore(data.predictions,results,adminData);return{name,...s};}).sort((a:any,b:any)=>b.total-a.total);
  const myScore=calcScore(myPreds,results,adminData);
  const myRank=leaderboard.findIndex((x:any)=>x.name===user)+1;

  if(!user) return (
    <div className="app">
      <style>{css}</style>
      <div style={{minHeight:"100vh",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:"1.5rem",background:'#0a1f0a'}}>
        <div style={{textAlign:"center",marginBottom:"1.8rem",position:"relative"}}>
          <div className="hero-stripes" style={{borderRadius:12}}/>
          <div style={{position:"relative",zIndex:1}}>
            <div className="hero-stars">★ ★ ★ ★ ★</div>
            <div className="hero-badge">PRODE OFICIAL</div>
            <h1 className="hero-title"><span className="cel">MUNDIAL</span><br/>2026</h1>
            <p style={{color:"rgba(232,244,248,0.5)",fontSize:".88rem",marginTop:".5rem"}}>Estados Unidos · México · Canadá</p>
            <p style={{color:"rgba(232,244,248,0.35)",fontSize:".75rem",marginTop:".2rem"}}>11 junio – 19 julio · 48 selecciones</p>
          </div>
        </div>
        <div className="card card-gold" style={{maxWidth:370,width:"100%"}}>
          <div className="section-title" style={{fontSize:".95rem",textAlign:"center",marginBottom:"1.1rem"}}>INGRESÁ AL PRODE</div>
          <div style={{marginBottom:".7rem"}}>
            <label style={{fontSize:".76rem",color:'rgba(232,244,248,0.4)',marginBottom:".3rem",display:"block"}}>NUEVO PARTICIPANTE</label>
            <input type="text" id="nameInput" placeholder="Tu nombre o apodo"
              onKeyDown={e=>{if(e.key==="Enter"){const v=(e.target as HTMLInputElement).value.trim();if(v){if(!participants[v]){const next={...participants,[v]:{name:v,predictions:{...EMPTY_PREDS}}};setParticipants(next);fbSet("participants",next);}setUser(v);setTab("predictions");}}}}/>
          </div>
          <button className="btn btn-gold" style={{width:"100%",marginBottom:"1rem"}} onClick={()=>{const el=document.getElementById("nameInput") as HTMLInputElement;const v=el?.value.trim();if(v){if(!participants[v]){const next={...participants,[v]:{name:v,predictions:{...EMPTY_PREDS}}};setParticipants(next);fbSet("participants",next);}setUser(v);setTab("predictions");}}}>ENTRAR AL PRODE →</button>
          {Object.keys(participants).length>0&&<>
            <div className="divider"/>
            <div style={{fontSize:".73rem",color:'rgba(232,244,248,0.4)',marginBottom:".45rem"}}>YA ESTOY REGISTRADO:</div>
            <div style={{display:"flex",flexWrap:"wrap",gap:".35rem"}}>
              {Object.keys(participants).sort().map(n=><button key={n} className="btn btn-outline btn-sm" onClick={()=>{setUser(n);setTab("predictions");}}>{n}</button>)}
            </div>
          </>}
        </div>
        <p style={{marginTop:"1rem",fontSize:".7rem",color:"rgba(232,244,248,0.4)",textAlign:"center",maxWidth:300}}>Tus predicciones se guardan en tiempo real y son compartidas con todos.</p>
      </div>
    </div>
  );

  return (
    <div className="app">
      <style>{css}</style>
      <nav className="nav">
        <div className="nav-logo">⚽ <span>MUNDIAL</span> 26</div>
        <div className="nav-tabs">
          {([["home","🏠"],["predictions","✏️ Predecir"],["leaderboard","🏆 Tabla"],["admin","⚙️"]] as [string,string][]).map(([id,label])=>(
            <button key={id} className={`nav-tab ${tab===id?"active":""}`} onClick={()=>setTab(id)}>{label}</button>
          ))}
        </div>
        <div style={{fontSize:".75rem",color:'rgba(232,244,248,0.4)'}}
>
          <span style={{color:'#6AABCF',fontWeight:700}}>{user}</span> &nbsp;
          <button style={{background:"none",border:"none",color:'rgba(232,244,248,0.4)',cursor:"pointer",fontSize:".72rem"}} onClick={()=>setUser(null)}>↩</button>
        </div>
      </nav>
      {flash&&<div className="flash">{flash}</div>}
      <div style={{maxWidth:880,margin:"0 auto",padding:"1.3rem .9rem"}}>
        {tab==="home"&&(
          <div>
            <div style={{textAlign:"center",padding:"1.5rem 0 1rem",position:"relative",overflow:"hidden"}}>
              <div className="hero-stripes"/>
              <div style={{position:"relative",zIndex:1}}>
                <div className="hero-stars">★ ★ ★ ★ ★</div>
                <div className="hero-badge">PRODE OFICIAL · TRABAJO</div>
                <h1 className="hero-title" style={{fontSize:"clamp(2.3rem,5vw,3.8rem)"}}><span className="cel">MUNDIAL</span><br/>2026</h1>
                <p style={{color:"rgba(232,244,248,0.5)",marginTop:".3rem",fontSize:".85rem"}}>Hola, <strong style={{color:"#6AABCF"}}>{user}</strong> — ¡Que gane el mejor!</p>
              </div>
            </div>
            <div className="grid-3" style={{marginBottom:"1.3rem"}}>
              {([
                {label:"Tu posición",val:myRank||"–",sub:"en la tabla",cls:"card card-jersey-cel",vc:"#03120a",lc:"rgba(3,18,10,0.6)"},
                {label:"Tus puntos",val:myScore.total,sub:`N1:${myScore.n1} N2:${myScore.n2} N3:${myScore.n3}`,cls:"card card-cel",vc:"#e8f4f8",lc:"rgba(232,244,248,0.4)"},
                {label:"Participantes",val:Object.keys(participants).length,sub:"jugando",cls:"card card-jersey-white",vc:"#1a4a6a",lc:"rgba(26,74,106,0.6)"},
              ] as any[]).map(({label,val,sub,cls,vc,lc})=>(
                <div key={label} className={cls} style={{textAlign:"center",padding:"1rem .7rem"}}>
                  <div style={{fontSize:".68rem",textTransform:"uppercase",letterSpacing:"1px",color:lc,marginBottom:".25rem"}}>{label}</div>
                  <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:"2.6rem",color:vc,lineHeight:1}}>{val}</div>
                  <div style={{fontSize:".7rem",color:lc,marginTop:".18rem"}}>{sub}</div>
                </div>
              ))}
            </div>
            <div className="card" style={{marginBottom:"1rem"}}>
              <div className="section-title">Sistema de Puntaje</div>
              <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:".7rem"}}>
                {[
                  {n:"1",label:"Básico",bg:"rgba(39,100,39,0.25)",border:"rgba(109,194,109,0.3)",color:"#6DC26D",max:"~70pts",items:["Ganador grupos · 1pt","Ganador elim. · 2pts"]},
                  {n:"2",label:"Intermedio",bg:"rgba(20,60,100,0.35)",border:"rgba(106,171,207,0.3)",color:"#6AABCF",max:"~80pts",items:["Exacto grupos · 3pts","Exacto elim. · 5pts"]},
                  {n:"3",label:"Experto",bg:"rgba(100,80,10,0.3)",border:"rgba(212,168,75,0.35)",color:"#D4A84B",max:"~45pts",items:["Campeón · 15pts","Subcampeón · 10pts","Goleador · 8pts","Arquero · 6pts","MVP · 6pts"]},
                ].map(lv=>(
                  <div key={lv.n} style={{padding:".7rem",borderRadius:10,border:`1px solid ${lv.border}`,background:lv.bg}}>
                    <div style={{fontFamily:"'Bebas Neue',sans-serif",color:lv.color,fontSize:".95rem",letterSpacing:1}}>N{lv.n} — {lv.label}</div>
                    <div style={{fontFamily:"'Bebas Neue',sans-serif",color:"rgba(232,244,248,0.4)",fontSize:".72rem",marginBottom:".35rem"}}>MÁX {lv.max}</div>
                    {lv.items.map(i=><div key={i} style={{fontSize:".72rem",color:"rgba(232,244,248,0.5)"}}>· {i}</div>)}
                  </div>
                ))}
              </div>
            </div>
            <button className="btn btn-gold" style={{width:"100%",padding:".82rem",fontSize:".95rem"}} onClick={()=>setTab("predictions")}>✏️ IR A MIS PREDICCIONES →</button>
          </div>
        )}
        {tab==="predictions"&&(
          <div>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:".9rem"}}>
              <h2 className="section-title" style={{marginBottom:0}}>Mis Predicciones</h2>
              {saving&&<div className="saving">Guardando...</div>}
            </div>
            <div className="inner-tabs" style={{marginBottom:"1rem"}}>
              {([["groups","⚽ Grupos"],["elim","🏆 Eliminatorias"],["specials","⭐ N3"]] as [string,string][]).map(([id,label])=>(
                <button key={id} className={`inner-tab ${predTab===id?"active":""}`} onClick={()=>setPredTab(id)}>{label}</button>
              ))}
            </div>
            {predTab==="groups"&&<GroupSection myPreds={myPreds} results={results} onUpdate={(mid:string,f:string,v:string)=>updatePrediction(["groups",mid,f],v)}/>}

            {predTab==="elim"&&<ElimSection myPreds={myPreds} results={results} onUpdate={(mid:string,f:string,v:string)=>updatePrediction(["elim",mid,f],v)}/>}
            {predTab==="specials"&&<SpecialsSection myPreds={myPreds} adminData={adminData} onUpdate={(id:string,v:string)=>updatePrediction(["specials",id],v)}/>}
          </div>
        )}
        {tab==="leaderboard"&&(
          <div>
            <h2 className="section-title">🏆 Tabla de Posiciones</h2>
            <div className="card" style={{marginBottom:"1rem"}}>
              <div style={{display:"grid",gridTemplateColumns:"2.2rem 1fr 3rem 3rem 3rem 3.5rem",gap:".4rem",padding:".35rem .9rem",borderBottom:"1px solid rgba(200,151,58,.2)",marginBottom:".55rem"}}>
                {["#","Nombre","N1","N2","N3","Total"].map(h=><div key={h} style={{fontSize:".68rem",fontWeight:700,textTransform:"uppercase",letterSpacing:"1px",color:"rgba(232,244,248,0.4)",textAlign:"center"}}>{h}</div>)}
              </div>
              {leaderboard.length===0&&<div style={{textAlign:"center",color:"rgba(232,244,248,0.4)",padding:"2rem"}}>Aún no hay puntos.</div>}
              {leaderboard.map(({name,n1,n2,n3,total}:any,i:number)=>(
                <div key={name} className={`lb-row ${i===0?"lb-gold":i===1?"lb-silver":i===2?"lb-bronze":"lb-norm"}`} style={{border:name===user?'2px solid #6AABCF':undefined}}>
                  <div className="lb-rank" style={{color:i===0?'#6AABCF':i===1?'rgba(232,244,248,0.5)':i===2?'#D4A84B':'rgba(232,244,248,0.3)'}}>{i===0?"🥇":i===1?"🥈":i===2?"🥉":i+1}</div>
                  <div className="lb-name" style={{color:name===user?'#6AABCF':'#e8f4f8'}}>{name}{name===user?" 👈":""}</div>
                  <div className="lb-pts" style={{color:'#6DC26D'}}>{n1}</div>
                  <div className="lb-pts" style={{color:"#6AABCF"}}>{n2}</div>
                  <div className="lb-pts" style={{color:'#D4A84B'}}>{n3}</div>
                  <div className="lb-total" style={{color:name===user?"#6AABCF":"#e8f4f8"}}>{total}</div>
                </div>
              ))}
            </div>
            <div style={{textAlign:"center",fontSize:".73rem",color:'rgba(232,244,248,0.4)'}}
>Máximo posible: ~235 pts · Se actualiza en tiempo real</div>
          </div>
        )}
        {tab==="admin"&&<AdminPanel results={results} adminData={adminData} participants={participants} onSaveResults={saveResults} onSaveAdminData={saveAdminData}/>}
      </div>
    </div>
  );
}
