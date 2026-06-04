import { useState, useEffect, useCallback, useRef } from 'react';

// ─── FIREBASE REST CONFIG ─────────────────────────────────
const DB_URL = 'https://prode-mundial-2026-bcbb6-default-rtdb.firebaseio.com';

async function fbGet(path: string) {
  const r = await fetch(`${DB_URL}/${path}.json`);
  return r.ok ? r.json() : null;
}
async function fbSet(path: string, data: any) {
  await fetch(`${DB_URL}/${path}.json`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
}
function fbListen(path: string, cb: (v: any) => void) {
  const es = new EventSource(`${DB_URL}/${path}.json`);
  es.addEventListener('put', (e: any) => {
    try {
      const d = JSON.parse(e.data);
      if (d.data !== undefined) cb(d.data);
    } catch {}
  });
  return () => es.close();
}

// ─── DATA ─────────────────────────────────────────────────
const ADMIN_PASSWORD = 'mundial2026admin';

const GROUPS = [
  {
    id: 'A',
    seed: 'México',
    teams: ['México', 'Ecuador', 'Haití', 'Bosnia-Herz.'],
  },
  {
    id: 'B',
    seed: 'Canadá',
    teams: ['Canadá', 'Venezuela', 'Rumanía', 'Chile'],
  },
  {
    id: 'C',
    seed: 'Brasil',
    teams: ['Brasil', 'Marruecos', 'Haití', 'Escocia'],
  },
  {
    id: 'D',
    seed: 'EE.UU.',
    teams: ['Estados Unidos', 'Paraguay', 'Australia', 'Turquía'],
  },
  {
    id: 'E',
    seed: 'Alemania',
    teams: ['Alemania', 'C. de Marfil', 'Curazao', 'Ecuador'],
  },
  {
    id: 'F',
    seed: 'P. Bajos',
    teams: ['Países Bajos', 'Japón', 'Argelia', 'Túnez'],
  },
  {
    id: 'G',
    seed: 'Bélgica',
    teams: ['Bélgica', 'Egipto', 'Irán', 'Nueva Zelanda'],
  },
  {
    id: 'H',
    seed: 'España',
    teams: ['España', 'Arabia Saudita', 'Cabo Verde', 'Uruguay'],
  },
  {
    id: 'I',
    seed: 'Francia',
    teams: ['Francia', 'Ghana', 'Sudáfrica', 'Senegal'],
  },
  {
    id: 'J',
    seed: 'Argentina',
    teams: ['Argentina', 'Perú', 'Suiza', 'Rep. Congo'],
  },
  {
    id: 'K',
    seed: 'Portugal',
    teams: ['Portugal', 'Panamá', 'Corea del Sur', 'Colombia'],
  },
  {
    id: 'L',
    seed: 'Inglaterra',
    teams: ['Inglaterra', 'Serbia', 'Croacia', 'Camerún'],
  },
];

const GROUP_MATCHES = GROUPS.map((g) => {
  const [a, b, c, d] = g.teams;
  return {
    groupId: g.id,
    matches: [
      { id: `${g.id}1`, home: a, away: b },
      { id: `${g.id}2`, home: c, away: d },
      { id: `${g.id}3`, home: a, away: c },
      { id: `${g.id}4`, home: b, away: d },
      { id: `${g.id}5`, home: a, away: d },
      { id: `${g.id}6`, home: b, away: c },
    ],
  };
});

const ELIM_PHASES = [
  { id: 'r32', label: '16avos de Final', slots: 32 },
  { id: 'r16', label: 'Octavos de Final', slots: 16 },
  { id: 'r8', label: 'Cuartos de Final', slots: 8 },
  { id: 'r4', label: 'Semifinales', slots: 4 },
  { id: 'r2', label: 'Final + 3° Puesto', slots: 2 },
];

const SPECIALS = [
  { id: 'champion', label: '🥇 Campeón del Mundo', pts: 15 },
  { id: 'runner', label: '🥈 Subcampeón', pts: 10 },
  { id: 'scorer', label: '👟 Goleador del Torneo', pts: 8 },
  { id: 'keeper', label: '🧤 Mejor Arquero (Guante de Oro)', pts: 6 },
  { id: 'mvp', label: '⭐ Mejor Jugador (Balón de Oro)', pts: 6 },
];

// ─── SCORING ──────────────────────────────────────────────
function calcScore(predictions: any, results: any, adminData: any) {
  let n1 = 0,
    n2 = 0,
    n3 = 0;
  for (const { matches } of GROUP_MATCHES) {
    for (const m of matches) {
      const pred = predictions?.groups?.[m.id];
      const real = results?.groups?.[m.id];
      if (!pred || !real || real.home == null || real.home === '') continue;
      const rH = parseInt(real.home),
        rA = parseInt(real.away);
      const rW = rH > rA ? 'home' : rA > rH ? 'away' : 'draw';
      if (pred.winner === rW) n1 += 1;
      const pH = parseInt(pred.home),
        pA = parseInt(pred.away);
      if (!isNaN(pH) && !isNaN(pA) && pH === rH && pA === rA) n2 += 3;
    }
  }
  for (const g of GROUPS) {
    const pred = predictions?.positions?.[g.id];
    const real = results?.positions?.[g.id];
    if (!pred || !real) continue;
    if (
      pred.first &&
      real.first &&
      pred.first === real.first &&
      pred.second &&
      real.second &&
      pred.second === real.second
    )
      n2 += 4;
    if (pred.third && real.third && pred.third === real.third) n2 += 2;
  }
  for (const [mid, pred] of Object.entries(predictions?.elim || {}) as any) {
    const real = results?.elim?.[mid];
    if (!real || real.home == null || real.home === '') continue;
    const rH = parseInt(real.home),
      rA = parseInt(real.away);
    if ((pred as any).winner === (rH > rA ? 'home' : 'away')) n1 += 2;
    const pH = parseInt((pred as any).home),
      pA = parseInt((pred as any).away);
    if (!isNaN(pH) && !isNaN(pA) && pH === rH && pA === rA) n2 += 5;
  }
  for (const sp of SPECIALS) {
    const pred = predictions?.specials?.[sp.id];
    const real = adminData?.specials?.[sp.id];
    if (pred && real && pred.trim().toLowerCase() === real.trim().toLowerCase())
      n3 += sp.pts;
  }
  return { n1, n2, n3, total: n1 + n2 + n3 };
}

// ─── THEME ────────────────────────────────────────────────
const T = {
  navy: '#0A1628',
  blue: '#152845',
  gold: '#C8973A',
  gold2: '#F0C060',
  white: '#FFFFFF',
  gray: '#8A9BB0',
  green: '#27AE60',
  teal: '#16A085',
  red: '#C0392B',
};

const css = `
  @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Barlow:wght@400;600;700&family=Barlow+Condensed:wght@700&display=swap');
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:'Barlow',sans-serif;background:${T.navy};color:${T.white};min-height:100vh}
  ::-webkit-scrollbar{width:6px}::-webkit-scrollbar-thumb{background:${T.gold};border-radius:3px}
  .app{min-height:100vh;background:linear-gradient(160deg,${T.navy} 0%,${T.blue} 50%,${T.navy} 100%)}
  .nav{background:rgba(10,22,40,.97);border-bottom:2px solid ${T.gold};padding:0 1rem;display:flex;align-items:center;justify-content:space-between;height:54px;position:sticky;top:0;z-index:100}
  .nav-logo{font-family:'Bebas Neue',sans-serif;font-size:1.4rem;color:${T.gold2};letter-spacing:2px}
  .nav-tabs{display:flex;gap:.2rem;flex-wrap:wrap}
  .nav-tab{background:none;border:none;color:${T.gray};font-family:'Barlow',sans-serif;font-size:.78rem;font-weight:700;padding:.4rem .7rem;border-radius:6px;cursor:pointer;transition:.2s;text-transform:uppercase}
  .nav-tab:hover{color:${T.white};background:rgba(255,255,255,.07)}
  .nav-tab.active{color:${T.gold2};background:rgba(200,151,58,.12);border-bottom:2px solid ${T.gold2}}
  .hero-badge{display:inline-block;background:${T.gold};color:${T.navy};font-family:'Barlow Condensed',sans-serif;font-size:.72rem;font-weight:700;letter-spacing:3px;padding:.25rem .9rem;border-radius:2rem;margin-bottom:.8rem}
  .hero-title{font-family:'Bebas Neue',sans-serif;font-size:clamp(2.8rem,7vw,5rem);line-height:.95;letter-spacing:2px;background:linear-gradient(135deg,${T.gold2},${T.gold},${T.gold2});-webkit-background-clip:text;-webkit-text-fill-color:transparent}
  .hero-stars{color:${T.gold2};font-size:1.1rem;letter-spacing:.5rem;margin-bottom:.8rem}
  .card{background:rgba(21,40,69,.7);border:1px solid rgba(200,151,58,.2);border-radius:14px;padding:1.1rem;transition:.2s}
  .card:hover{border-color:rgba(200,151,58,.35)}
  .card-gold{background:linear-gradient(135deg,rgba(200,151,58,.15),rgba(240,192,96,.07));border-color:${T.gold}}
  .section-title{font-family:'Bebas Neue',sans-serif;font-size:1.3rem;letter-spacing:2px;color:${T.gold2};margin-bottom:.9rem}
  .btn{border:none;border-radius:8px;cursor:pointer;font-family:'Barlow',sans-serif;font-weight:700;transition:.2s;text-transform:uppercase}
  .btn-gold{background:linear-gradient(135deg,${T.gold},${T.gold2});color:${T.navy};padding:.6rem 1.3rem;font-size:.83rem}
  .btn-gold:hover{transform:translateY(-1px);box-shadow:0 4px 18px rgba(200,151,58,.35)}
  .btn-outline{background:transparent;border:1.5px solid ${T.gold};color:${T.gold};padding:.45rem 1.1rem;font-size:.78rem}
  .btn-outline:hover{background:rgba(200,151,58,.1)}
  .btn-sm{padding:.3rem .8rem;font-size:.75rem}
  input[type=text],input[type=password],select{background:rgba(10,22,40,.6);border:1.5px solid rgba(200,151,58,.3);border-radius:8px;color:${T.white};font-family:'Barlow',sans-serif;font-size:.88rem;padding:.5rem .75rem;width:100%;transition:.2s;outline:none}
  input:focus,select:focus{border-color:${T.gold};box-shadow:0 0 0 3px rgba(200,151,58,.1)}
  input::placeholder{color:${T.gray}}
  select option{background:${T.blue}}
  .input-score{width:48px!important;text-align:center;padding:.38rem .25rem!important}
  .match-row{display:grid;grid-template-columns:1fr auto auto auto 1fr auto;align-items:center;gap:.5rem;padding:.6rem .7rem;border-radius:10px;background:rgba(10,22,40,.4);border:1px solid transparent;transition:.2s;margin-bottom:.35rem}
  .match-row:hover{border-color:rgba(200,151,58,.2)}
  .team-name{font-size:.85rem;font-weight:600}
  .team-name.home{text-align:right}
  .vs-label{font-family:'Bebas Neue',sans-serif;font-size:.85rem;color:${T.gray};min-width:18px;text-align:center}
  .score-real{font-family:'Bebas Neue',sans-serif;font-size:1.05rem;color:${T.gold2};min-width:20px;text-align:center}
  .pts-badge{font-size:.68rem;font-weight:700;padding:.12rem .45rem;border-radius:4px;min-width:32px;text-align:center}
  .pts-badge.good{background:rgba(39,174,96,.2);color:#6EE7A0;border:1px solid rgba(39,174,96,.3)}
  .pts-badge.exact{background:rgba(200,151,58,.2);color:${T.gold2};border:1px solid ${T.gold}}
  .pts-badge.miss{background:rgba(192,57,43,.1);color:#F08080;border:1px solid rgba(192,57,43,.2)}
  .group-header{display:flex;align-items:center;gap:.7rem;margin-bottom:.7rem;padding-bottom:.45rem;border-bottom:1px solid rgba(200,151,58,.2)}
  .group-letter{font-family:'Bebas Neue',sans-serif;font-size:1.9rem;color:${T.gold};line-height:1;width:2rem;text-align:center}
  .lb-row{display:grid;grid-template-columns:2.2rem 1fr 3rem 3rem 3rem 3.5rem;align-items:center;gap:.4rem;padding:.65rem .9rem;border-radius:10px;margin-bottom:.35rem;transition:.2s}
  .lb-row:hover{transform:translateX(2px)}
  .lb-rank{font-family:'Bebas Neue',sans-serif;font-size:1.2rem;text-align:center}
  .lb-name{font-weight:600;font-size:.88rem}
  .lb-pts{text-align:center;font-size:.82rem;font-weight:700}
  .lb-total{font-family:'Bebas Neue',sans-serif;font-size:1.15rem;text-align:center;color:${T.gold2}}
  .lb-gold{background:linear-gradient(135deg,rgba(200,151,58,.2),rgba(240,192,96,.1));border:1px solid ${T.gold}}
  .lb-silver{background:rgba(138,155,176,.08);border:1px solid rgba(138,155,176,.3)}
  .lb-bronze{background:rgba(192,120,64,.08);border:1px solid rgba(192,120,64,.3)}
  .lb-norm{background:rgba(10,22,40,.3);border:1px solid rgba(255,255,255,.06)}
  .special-card{display:grid;grid-template-columns:2.8rem 1fr auto;align-items:center;gap:.9rem;padding:.85rem .9rem;border-radius:12px;background:rgba(10,22,40,.5);border:1px solid rgba(200,151,58,.2);margin-bottom:.55rem}
  .inner-tabs{display:flex;gap:.25rem;flex-wrap:wrap;margin-bottom:.9rem}
  .inner-tab{background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1);color:${T.gray};font-size:.75rem;font-weight:700;padding:.32rem .75rem;border-radius:6px;cursor:pointer;transition:.2s;text-transform:uppercase}
  .inner-tab.active{background:rgba(200,151,58,.15);border-color:${T.gold};color:${T.gold2}}
  .chip{display:inline-block;background:rgba(200,151,58,.15);color:${T.gold2};border:1px solid rgba(200,151,58,.3);border-radius:4px;font-size:.7rem;font-weight:700;padding:.12rem .45rem}
  .divider{height:1px;background:linear-gradient(90deg,transparent,rgba(200,151,58,.3),transparent);margin:.9rem 0}
  .grid-2{display:grid;grid-template-columns:1fr 1fr;gap:.9rem}
  .grid-3{display:grid;grid-template-columns:repeat(3,1fr);gap:.7rem}
  .alert-warn{padding:.7rem .9rem;border-radius:8px;font-size:.83rem;margin-bottom:.9rem;background:rgba(200,151,58,.12);border:1px solid rgba(200,151,58,.3);color:${T.gold2}}
  .flash{background:${T.gold};color:${T.navy};text-align:center;padding:.45rem;font-weight:700;font-size:.83rem;position:sticky;top:54px;z-index:99}
  .saving{opacity:.6;font-size:.72rem;color:${T.gray}}
  @media(max-width:580px){.grid-2,.grid-3{grid-template-columns:1fr}.nav-tab{font-size:.7rem;padding:.35rem .45rem}.lb-row{grid-template-columns:1.8rem 1fr 2.5rem 2.5rem 2.5rem 3rem;gap:.3rem}}
`;

// ─── MATCH ROW ────────────────────────────────────────────
function MatchRow({
  match,
  predHome,
  predAway,
  predWinner,
  realHome,
  realAway,
  onPredChange,
  adminMode,
  onRealChange,
}: any) {
  const hasReal =
    realHome != null && realHome !== '' && realAway != null && realAway !== '';
  const rH = hasReal ? parseInt(realHome) : null;
  const rA = hasReal ? parseInt(realAway) : null;
  const rW = hasReal
    ? rH! > rA!
      ? 'home'
      : rA! > rH!
      ? 'away'
      : 'draw'
    : null;
  let pts = 0,
    ptsType = '';
  if (hasReal && onPredChange) {
    const pH = parseInt(predHome),
      pA = parseInt(predAway);
    if (!isNaN(pH) && !isNaN(pA) && pH === rH && pA === rA) {
      pts = adminMode ? 5 : 3;
      ptsType = 'exact';
    } else if (predWinner === rW) {
      pts = adminMode ? 2 : 1;
      ptsType = 'good';
    } else ptsType = 'miss';
  }
  return (
    <div className="match-row">
      <div
        className="team-name home"
        style={{ color: rW === 'home' ? T.gold2 : T.white }}
      >
        {match.home}
      </div>
      {adminMode && onRealChange ? (
        <>
          <input
            className="input-score"
            type="text"
            value={realHome ?? ''}
            placeholder="–"
            onChange={(e) => onRealChange('home', e.target.value)}
            style={{ width: 44 }}
          />
          <span className="vs-label">–</span>
          <input
            className="input-score"
            type="text"
            value={realAway ?? ''}
            placeholder="–"
            onChange={(e) => onRealChange('away', e.target.value)}
            style={{ width: 44 }}
          />
        </>
      ) : (
        <>
          <span className="score-real">{hasReal ? rH : '–'}</span>
          <span className="vs-label">vs</span>
          <span className="score-real">{hasReal ? rA : '–'}</span>
        </>
      )}
      <div
        className="team-name"
        style={{ color: rW === 'away' ? T.gold2 : T.white }}
      >
        {match.away}
      </div>
      {!adminMode && onPredChange && (
        <div style={{ display: 'flex', gap: 3, alignItems: 'center' }}>
          <input
            className="input-score"
            type="text"
            value={predHome ?? ''}
            placeholder="G"
            onChange={(e) => onPredChange('home', e.target.value)}
            style={{ width: 38, fontSize: '.78rem' }}
          />
          <input
            className="input-score"
            type="text"
            value={predAway ?? ''}
            placeholder="G"
            onChange={(e) => onPredChange('away', e.target.value)}
            style={{ width: 38, fontSize: '.78rem' }}
          />
          <select
            value={predWinner || ''}
            onChange={(e) => onPredChange('winner', e.target.value)}
            style={{ width: 86, fontSize: '.73rem', padding: '.28rem .35rem' }}
          >
            <option value="">Ganador</option>
            <option value="home">{match.home.split(' ').pop()}</option>
            <option value="draw">Empate</option>
            <option value="away">{match.away.split(' ').pop()}</option>
          </select>
          {hasReal && (
            <span className={`pts-badge ${ptsType}`}>
              {pts > 0 ? `+${pts}` : ptsType === 'miss' ? '✗' : ''}
            </span>
          )}
        </div>
      )}
      {adminMode && <div />}
    </div>
  );
}

function GroupSection({ myPreds, results, onUpdate }: any) {
  const [ag, setAg] = useState('A');
  const group = GROUPS.find((g) => g.id === ag)!;
  const matches = GROUP_MATCHES.find((g) => g.groupId === ag)?.matches || [];
  return (
    <div>
      <div className="inner-tabs">
        {'ABCDEFGHIJKL'.split('').map((g) => (
          <button
            key={g}
            className={`inner-tab ${ag === g ? 'active' : ''}`}
            onClick={() => setAg(g)}
          >
            {g}
          </button>
        ))}
      </div>
      <div className="card">
        <div className="group-header">
          <div className="group-letter">{group.id}</div>
          <div>
            <div
              style={{
                fontFamily: "'Barlow Condensed',sans-serif",
                fontSize: '1.05rem',
                letterSpacing: 1,
              }}
            >
              GRUPO {group.id}
            </div>
            <div style={{ color: T.gray, fontSize: '.73rem' }}>
              {group.teams.join(' · ')}
            </div>
          </div>
          <div className="chip">6 partidos</div>
        </div>
        {matches.map((m) => (
          <MatchRow
            key={m.id}
            match={m}
            predHome={myPreds.groups?.[m.id]?.home}
            predAway={myPreds.groups?.[m.id]?.away}
            predWinner={myPreds.groups?.[m.id]?.winner}
            realHome={results.groups?.[m.id]?.home}
            realAway={results.groups?.[m.id]?.away}
            onPredChange={(f: string, v: string) => onUpdate(m.id, f, v)}
          />
        ))}
      </div>
    </div>
  );
}

function PositionsSection({ myPreds, results, onUpdate }: any) {
  return (
    <div>
      <div className="alert-warn">
        <strong>Nivel 2:</strong> 1° y 2° correcto = 4pts · 3° clasificado =
        2pts extra
      </div>
      <div className="grid-2">
        {GROUPS.map((g) => (
          <div key={g.id} className="card">
            <div className="group-header" style={{ marginBottom: '.55rem' }}>
              <div className="group-letter" style={{ fontSize: '1.5rem' }}>
                {g.id}
              </div>
              <div
                style={{
                  fontFamily: "'Barlow Condensed',sans-serif",
                  fontSize: '.95rem',
                }}
              >
                Grupo {g.id}
              </div>
            </div>
            {(
              [
                ['first', '🥇'],
                ['second', '🥈'],
                ['third', '🎟️'],
              ] as [string, string][]
            ).map(([pos, emoji]) => (
              <div
                key={pos}
                style={{
                  marginBottom: '.35rem',
                  display: 'grid',
                  gridTemplateColumns: '1.5rem 1fr auto',
                  alignItems: 'center',
                  gap: '.4rem',
                }}
              >
                <span style={{ fontSize: '.9rem', textAlign: 'center' }}>
                  {emoji}
                </span>
                <select
                  value={myPreds.positions?.[g.id]?.[pos] || ''}
                  onChange={(e) => onUpdate(g.id, pos, e.target.value)}
                  style={{ fontSize: '.78rem', padding: '.3rem .4rem' }}
                >
                  <option value="">Elegir...</option>
                  {g.teams.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
                {results.positions?.[g.id]?.[pos] && (
                  <span
                    className={`pts-badge ${
                      myPreds.positions?.[g.id]?.[pos] ===
                      results.positions[g.id][pos]
                        ? 'exact'
                        : 'miss'
                    }`}
                  >
                    {myPreds.positions?.[g.id]?.[pos] ===
                    results.positions[g.id][pos]
                      ? '✓'
                      : '✗'}
                  </span>
                )}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function ElimSection({ myPreds, results, onUpdate }: any) {
  const [phase, setPhase] = useState('r32');
  const ph = ELIM_PHASES.find((p) => p.id === phase)!;
  return (
    <div>
      <div className="inner-tabs">
        {ELIM_PHASES.map((p) => (
          <button
            key={p.id}
            className={`inner-tab ${phase === p.id ? 'active' : ''}`}
            onClick={() => setPhase(p.id)}
          >
            {p.label}
          </button>
        ))}
      </div>
      <div className="card">
        <div className="group-header">
          <div>
            <div
              style={{
                fontFamily: "'Barlow Condensed',sans-serif",
                fontSize: '1.05rem',
                letterSpacing: 1,
              }}
            >
              {ph.label}
            </div>
            <div style={{ color: T.gray, fontSize: '.73rem' }}>
              Ganador: 2pts · Exacto: 5pts
            </div>
          </div>
          <div className="chip">{ph.slots / 2} partidos</div>
        </div>
        {Array.from(
          { length: ph.slots / 2 },
          (_, i) => `${phase}_m${i + 1}`
        ).map((mid, i) => {
          const home = results.elim?.[mid]?.homeTeam || `Equipo ${i * 2 + 1}`;
          const away = results.elim?.[mid]?.awayTeam || `Equipo ${i * 2 + 2}`;
          return (
            <MatchRow
              key={mid}
              match={{ home, away }}
              predHome={myPreds.elim?.[mid]?.home}
              predAway={myPreds.elim?.[mid]?.away}
              predWinner={myPreds.elim?.[mid]?.winner}
              realHome={results.elim?.[mid]?.home}
              realAway={results.elim?.[mid]?.away}
              onPredChange={(f: string, v: string) => onUpdate(mid, f, v)}
            />
          );
        })}
      </div>
    </div>
  );
}

function SpecialsSection({ myPreds, adminData, onUpdate }: any) {
  return (
    <div>
      <div className="alert-warn">
        <strong>⚠️ Cierra el 11 de junio.</strong> No se aceptan cambios después
        del primer partido.
      </div>
      {SPECIALS.map((sp) => {
        const realVal = adminData?.specials?.[sp.id];
        const myVal = myPreds.specials?.[sp.id];
        const correct =
          realVal &&
          myVal &&
          myVal.trim().toLowerCase() === realVal.trim().toLowerCase();
        return (
          <div
            key={sp.id}
            className="special-card"
            style={{
              border: realVal
                ? correct
                  ? `1.5px solid ${T.green}`
                  : `1.5px solid ${T.red}`
                : '1px solid rgba(200,151,58,.2)',
            }}
          >
            <div style={{ fontSize: '1.5rem', textAlign: 'center' }}>
              {sp.label.split(' ')[0]}
            </div>
            <div>
              <div
                style={{
                  fontWeight: 600,
                  fontSize: '.88rem',
                  marginBottom: '.35rem',
                }}
              >
                {sp.label.replace(/^[^\w]+/, '').trim()}
              </div>
              <input
                type="text"
                placeholder="Tu predicción..."
                value={myVal || ''}
                onChange={(e) => onUpdate(sp.id, e.target.value)}
                style={{ fontSize: '.83rem' }}
              />
              {realVal && (
                <div
                  style={{
                    fontSize: '.73rem',
                    marginTop: '.28rem',
                    color: T.gray,
                  }}
                >
                  Real:{' '}
                  <strong style={{ color: correct ? T.green : T.red }}>
                    {realVal}
                  </strong>
                </div>
              )}
            </div>
            <div style={{ textAlign: 'center' }}>
              <div
                style={{
                  fontFamily: "'Bebas Neue',sans-serif",
                  fontSize: '1.05rem',
                  color: T.gold2,
                }}
              >
                {sp.pts}pts
              </div>
              {realVal && (
                <div
                  style={{
                    fontSize: '.68rem',
                    color: correct ? T.green : T.red,
                  }}
                >
                  {correct ? '✓ +' + sp.pts : '✗'}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function AdminPanel({
  results,
  adminData,
  participants,
  onSaveResults,
  onSaveAdminData,
}: any) {
  const [pw, setPw] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);
  const [localR, setLocalR] = useState(results);
  const [localA, setLocalA] = useState(adminData);
  const [adminTab, setAdminTab] = useState('groups');
  const [activeG, setActiveG] = useState('A');
  const [msg, setMsg] = useState('');
  useEffect(() => setLocalR(results), [results]);
  useEffect(() => setLocalA(adminData), [adminData]);
  const flash = (m: string) => {
    setMsg(m);
    setTimeout(() => setMsg(''), 2000);
  };
  if (!isAdmin)
    return (
      <div className="card" style={{ maxWidth: 360, margin: '0 auto' }}>
        <div className="section-title" style={{ textAlign: 'center' }}>
          ⚙️ Acceso Admin
        </div>
        <p
          style={{
            color: T.gray,
            fontSize: '.83rem',
            marginBottom: '1rem',
            textAlign: 'center',
          }}
        >
          Solo el administrador puede cargar resultados.
        </p>
        <input
          type="password"
          placeholder="Contraseña"
          value={pw}
          onChange={(e) => setPw(e.target.value)}
          onKeyDown={(e) =>
            e.key === 'Enter' &&
            (pw === ADMIN_PASSWORD
              ? setIsAdmin(true)
              : flash('Contraseña incorrecta'))
          }
        />
        <button
          className="btn btn-gold"
          style={{ width: '100%', marginTop: '.7rem' }}
          onClick={() =>
            pw === ADMIN_PASSWORD
              ? setIsAdmin(true)
              : flash('Contraseña incorrecta')
          }
        >
          INGRESAR
        </button>
        {msg && (
          <div
            style={{
              marginTop: '.5rem',
              color: T.red,
              fontSize: '.8rem',
              textAlign: 'center',
            }}
          >
            {msg}
          </div>
        )}
      </div>
    );
  const group = GROUPS.find((g) => g.id === activeG)!;
  const matches =
    GROUP_MATCHES.find((g) => g.groupId === activeG)?.matches || [];
  const updG = (mid: string, f: string, v: string) =>
    setLocalR((p: any) => ({
      ...p,
      groups: { ...p.groups, [mid]: { ...p.groups?.[mid], [f]: v } },
    }));
  const updPos = (gid: string, pos: string, v: string) =>
    setLocalR((p: any) => ({
      ...p,
      positions: { ...p.positions, [gid]: { ...p.positions?.[gid], [pos]: v } },
    }));
  const updElim = (mid: string, f: string, v: string) =>
    setLocalR((p: any) => ({
      ...p,
      elim: { ...p.elim, [mid]: { ...p.elim?.[mid], [f]: v } },
    }));
  const updSp = (id: string, v: string) =>
    setLocalA((p: any) => ({ ...p, specials: { ...p.specials, [id]: v } }));
  return (
    <div>
      {msg && <div className="flash">{msg}</div>}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '.7rem',
          marginBottom: '1.2rem',
        }}
      >
        <h2 className="section-title" style={{ marginBottom: 0 }}>
          ⚙️ Panel Admin
        </h2>
        <div className="chip">🔓 Activo</div>
      </div>
      <div className="card" style={{ marginBottom: '1rem' }}>
        <div
          style={{
            fontSize: '.8rem',
            color: T.gray,
            marginBottom: '.5rem',
            fontWeight: 700,
          }}
        >
          👥 PARTICIPANTES ({Object.keys(participants).length})
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '.35rem' }}>
          {Object.keys(participants).map((n) => (
            <div
              key={n}
              style={{
                background: 'rgba(200,151,58,.1)',
                border: `1px solid ${T.gold}`,
                borderRadius: 6,
                padding: '.25rem .65rem',
                fontSize: '.78rem',
                color: T.gold2,
              }}
            >
              {n}
            </div>
          ))}
        </div>
      </div>
      <div className="inner-tabs">
        {[
          ['groups', '⚽ Grupos'],
          ['positions', '📊 Posiciones'],
          ['elim', '🏆 Eliminatorias'],
          ['specials', '⭐ Especiales'],
        ].map(([id, label]) => (
          <button
            key={id}
            className={`inner-tab ${adminTab === id ? 'active' : ''}`}
            onClick={() => setAdminTab(id)}
          >
            {label}
          </button>
        ))}
      </div>
      {adminTab === 'groups' && (
        <div>
          <div className="inner-tabs">
            {'ABCDEFGHIJKL'.split('').map((g) => (
              <button
                key={g}
                className={`inner-tab ${activeG === g ? 'active' : ''}`}
                onClick={() => setActiveG(g)}
              >
                {g}
              </button>
            ))}
          </div>
          <div className="card">
            <div className="group-header" style={{ marginBottom: '.7rem' }}>
              <div className="group-letter">{group.id}</div>
              <div>
                <div style={{ fontFamily: "'Barlow Condensed',sans-serif" }}>
                  Grupo {group.id}
                </div>
                <div style={{ color: T.gray, fontSize: '.73rem' }}>
                  {group.teams.join(' · ')}
                </div>
              </div>
            </div>
            {matches.map((m) => (
              <MatchRow
                key={m.id}
                match={m}
                adminMode
                realHome={localR.groups?.[m.id]?.home}
                realAway={localR.groups?.[m.id]?.away}
                onRealChange={(f: string, v: string) => updG(m.id, f, v)}
              />
            ))}
          </div>
          <button
            className="btn btn-gold"
            style={{ marginTop: '.9rem' }}
            onClick={() => {
              onSaveResults(localR);
              flash('Grupos guardados ✓');
            }}
          >
            💾 GUARDAR GRUPOS
          </button>
        </div>
      )}
      {adminTab === 'positions' && (
        <div>
          <div className="grid-2">
            {GROUPS.map((g) => (
              <div key={g.id} className="card">
                <div
                  style={{
                    fontFamily: "'Bebas Neue',sans-serif",
                    color: T.gold2,
                    marginBottom: '.45rem',
                  }}
                >
                  Grupo {g.id}
                </div>
                {(
                  [
                    ['first', '1°'],
                    ['second', '2°'],
                    ['third', '3° clasif.'],
                  ] as [string, string][]
                ).map(([pos, label]) => (
                  <div key={pos} style={{ marginBottom: '.35rem' }}>
                    <div
                      style={{
                        fontSize: '.7rem',
                        fontWeight: 700,
                        color: T.gold,
                        marginBottom: '.2rem',
                        textTransform: 'uppercase',
                      }}
                    >
                      {label}
                    </div>
                    <select
                      value={localR.positions?.[g.id]?.[pos] || ''}
                      onChange={(e) => updPos(g.id, pos, e.target.value)}
                      style={{ fontSize: '.8rem', padding: '.3rem .4rem' }}
                    >
                      <option value="">Sin definir</option>
                      {g.teams.map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            ))}
          </div>
          <button
            className="btn btn-gold"
            style={{ marginTop: '.9rem' }}
            onClick={() => {
              onSaveResults(localR);
              flash('Posiciones guardadas ✓');
            }}
          >
            💾 GUARDAR POSICIONES
          </button>
        </div>
      )}
      {adminTab === 'elim' && (
        <div>
          {ELIM_PHASES.map((ph) => (
            <div key={ph.id} className="card" style={{ marginBottom: '.9rem' }}>
              <div
                style={{
                  fontFamily: "'Bebas Neue',sans-serif",
                  color: T.gold2,
                  marginBottom: '.7rem',
                }}
              >
                {ph.label}
              </div>
              {Array.from(
                { length: ph.slots / 2 },
                (_, i) => `${ph.id}_m${i + 1}`
              ).map((mid, i) => (
                <div key={mid} style={{ marginBottom: '.5rem' }}>
                  <div
                    style={{
                      fontSize: '.7rem',
                      color: T.gray,
                      marginBottom: '.2rem',
                    }}
                  >
                    Partido {i + 1}
                  </div>
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '1fr auto 1fr auto',
                      gap: '.35rem',
                      alignItems: 'center',
                    }}
                  >
                    <input
                      placeholder="Equipo A"
                      value={localR.elim?.[mid]?.homeTeam || ''}
                      onChange={(e) => updElim(mid, 'homeTeam', e.target.value)}
                      style={{ fontSize: '.78rem' }}
                    />
                    <span style={{ color: T.gray, fontSize: '.78rem' }}>
                      vs
                    </span>
                    <input
                      placeholder="Equipo B"
                      value={localR.elim?.[mid]?.awayTeam || ''}
                      onChange={(e) => updElim(mid, 'awayTeam', e.target.value)}
                      style={{ fontSize: '.78rem' }}
                    />
                    <div style={{ display: 'flex', gap: 3 }}>
                      <input
                        className="input-score"
                        placeholder="G"
                        value={localR.elim?.[mid]?.home || ''}
                        onChange={(e) => updElim(mid, 'home', e.target.value)}
                        style={{ width: 44 }}
                      />
                      <input
                        className="input-score"
                        placeholder="G"
                        value={localR.elim?.[mid]?.away || ''}
                        onChange={(e) => updElim(mid, 'away', e.target.value)}
                        style={{ width: 44 }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ))}
          <button
            className="btn btn-gold"
            onClick={() => {
              onSaveResults(localR);
              flash('Eliminatorias guardadas ✓');
            }}
          >
            💾 GUARDAR ELIMINATORIAS
          </button>
        </div>
      )}
      {adminTab === 'specials' && (
        <div>
          <div className="card">
            <div
              style={{
                fontFamily: "'Bebas Neue',sans-serif",
                color: T.gold2,
                marginBottom: '.9rem',
              }}
            >
              Resultados Reales — Nivel 3
            </div>
            {SPECIALS.map((sp) => (
              <div
                key={sp.id}
                className="special-card"
                style={{ marginBottom: '.5rem' }}
              >
                <div style={{ fontSize: '1.5rem', textAlign: 'center' }}>
                  {sp.label.split(' ')[0]}
                </div>
                <div>
                  <div
                    style={{
                      fontWeight: 600,
                      fontSize: '.85rem',
                      marginBottom: '.35rem',
                    }}
                  >
                    {sp.label.replace(/^[^\w]+/, '').trim()}
                  </div>
                  <input
                    type="text"
                    placeholder="Resultado real..."
                    value={localA.specials?.[sp.id] || ''}
                    onChange={(e) => updSp(sp.id, e.target.value)}
                    style={{ fontSize: '.83rem' }}
                  />
                </div>
                <div
                  style={{
                    fontFamily: "'Bebas Neue',sans-serif",
                    fontSize: '1.05rem',
                    color: T.gold2,
                    textAlign: 'center',
                  }}
                >
                  {sp.pts}pts
                </div>
              </div>
            ))}
          </div>
          <button
            className="btn btn-gold"
            style={{ marginTop: '.75rem' }}
            onClick={() => {
              onSaveAdminData(localA);
              flash('Especiales guardados ✓');
            }}
          >
            💾 GUARDAR ESPECIALES
          </button>
        </div>
      )}
    </div>
  );
}

// ─── MAIN ─────────────────────────────────────────────────
export default function App() {
  const [tab, setTab] = useState('home');
  const [predTab, setPredTab] = useState('groups');
  const [user, setUser] = useState<string | null>(null);
  const [participants, setParticipants] = useState<any>({});
  const [results, setResults] = useState<any>({
    groups: {},
    positions: {},
    elim: {},
    specials: {},
  });
  const [adminData, setAdminData] = useState<any>({ specials: {} });
  const [saving, setSaving] = useState(false);
  const [flash, setFlash] = useState('');
  const saveTimer = useRef<any>(null);

  useEffect(() => {
    const unsub1 = fbListen('participants', (v) => {
      if (v) setParticipants(v);
    });
    const unsub2 = fbListen('results', (v) => {
      if (v) setResults(v);
    });
    const unsub3 = fbListen('adminData', (v) => {
      if (v) setAdminData(v);
    });
    return () => {
      unsub1();
      unsub2();
      unsub3();
    };
  }, []);

  const showFlash = (msg: string) => {
    setFlash(msg);
    setTimeout(() => setFlash(''), 2200);
  };

  const savePred = useCallback((next: any) => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      setSaving(true);
      await fbSet('participants', next);
      setSaving(false);
    }, 600);
  }, []);

  const updatePrediction = (path: string[], value: string) => {
    if (!user) return;
    setParticipants((prev: any) => {
      const next = JSON.parse(JSON.stringify(prev));
      if (!next[user]) next[user] = { name: user, predictions: {} };
      let obj = next[user].predictions;
      for (let i = 0; i < path.length - 1; i++) {
        if (!obj[path[i]]) obj[path[i]] = {};
        obj = obj[path[i]];
      }
      obj[path[path.length - 1]] = value;
      savePred(next);
      return next;
    });
  };

  const saveResults = async (r: any) => {
    setSaving(true);
    await fbSet('results', r);
    setResults(r);
    setSaving(false);
    showFlash('Resultados guardados ✓');
  };
  const saveAdminData = async (ad: any) => {
    setSaving(true);
    await fbSet('adminData', ad);
    setAdminData(ad);
    setSaving(false);
    showFlash('Datos guardados ✓');
  };

const myPreds = user ? participants[user]?.predictions || {groups:{},positions:{},elim:{},specials:{}} : {groups:{},positions:{},elim:{},specials:{}};
  const leaderboard = Object.entries(participants)
    .map(([name, data]: any) => {
      const s = calcScore(data.predictions || {}, results, adminData);
      return { name, ...s };
    })
    .sort((a: any, b: any) => b.total - a.total);
  const myScore = calcScore(myPreds, results, adminData);
  const myRank = leaderboard.findIndex((x: any) => x.name === user) + 1;

  if (!user)
    return (
      <div className="app">
        <style>{css}</style>
        <div
          style={{
            minHeight: '100vh',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1.5rem',
            background: `linear-gradient(160deg,${T.navy} 0%,${T.blue} 60%,${T.navy} 100%)`,
          }}
        >
          <div style={{ textAlign: 'center', marginBottom: '1.8rem' }}>
            <div className="hero-stars">★ ★ ★ ★ ★</div>
            <div className="hero-badge">PRODE OFICIAL</div>
            <h1 className="hero-title">
              MUNDIAL
              <br />
              2026
            </h1>
            <p
              style={{ color: T.gray, fontSize: '.88rem', marginTop: '.5rem' }}
            >
              Estados Unidos · México · Canadá
            </p>
            <p
              style={{ color: T.gray, fontSize: '.75rem', marginTop: '.2rem' }}
            >
              11 junio – 19 julio · 48 selecciones
            </p>
          </div>
          <div
            className="card card-gold"
            style={{ maxWidth: 370, width: '100%' }}
          >
            <div
              className="section-title"
              style={{
                fontSize: '.95rem',
                textAlign: 'center',
                marginBottom: '1.1rem',
              }}
            >
              INGRESÁ AL PRODE
            </div>
            <div style={{ marginBottom: '.7rem' }}>
              <label
                style={{
                  fontSize: '.76rem',
                  color: T.gray,
                  marginBottom: '.3rem',
                  display: 'block',
                }}
              >
                NUEVO PARTICIPANTE
              </label>
              <input
                type="text"
                id="nameInput"
                placeholder="Tu nombre o apodo"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    const v = (e.target as HTMLInputElement).value.trim();
                    if (v) {
                      if (!participants[v]) {
                        const next = {
                          ...participants,
                          [v]: { name: v, predictions: {} },
                        };
                        setParticipants(next);
                        fbSet('participants', next);
                      }
                      setUser(v);
                      setTab('predictions');
                    }
                  }
                }}
              />
            </div>
            <button
              className="btn btn-gold"
              style={{ width: '100%', marginBottom: '1rem' }}
              onClick={() => {
                const el = document.getElementById(
                  'nameInput'
                ) as HTMLInputElement;
                const v = el?.value.trim();
                if (v) {
                  if (!participants[v]) {
                    const next = {
                      ...participants,
                      [v]: { name: v, predictions: {} },
                    };
                    setParticipants(next);
                    fbSet('participants', next);
                  }
                  setUser(v);
                  setTab('predictions');
                }
              }}
            >
              ENTRAR AL PRODE →
            </button>
            {Object.keys(participants).length > 0 && (
              <>
                <div
                  style={{
                    height: 1,
                    background:
                      'linear-gradient(90deg,transparent,rgba(200,151,58,.3),transparent)',
                    margin: '.9rem 0',
                  }}
                />
                <div
                  style={{
                    fontSize: '.73rem',
                    color: T.gray,
                    marginBottom: '.45rem',
                  }}
                >
                  YA ESTOY REGISTRADO:
                </div>
                <div
                  style={{ display: 'flex', flexWrap: 'wrap', gap: '.35rem' }}
                >
                  {Object.keys(participants)
                    .sort()
                    .map((n) => (
                      <button
                        key={n}
                        className="btn btn-outline btn-sm"
                        onClick={() => {
                          setUser(n);
                          setTab('predictions');
                        }}
                      >
                        {n}
                      </button>
                    ))}
                </div>
              </>
            )}
          </div>
          <p
            style={{
              marginTop: '1rem',
              fontSize: '.7rem',
              color: T.gray,
              textAlign: 'center',
              maxWidth: 300,
            }}
          >
            Tus predicciones se guardan en tiempo real y son compartidas con
            todos.
          </p>
        </div>
      </div>
    );

  return (
    <div className="app">
      <style>{css}</style>
      <nav className="nav">
        <div className="nav-logo">⚽ MUNDIAL 26</div>
        <div className="nav-tabs">
          {(
            [
              ['home', '🏠'],
              ['predictions', '✏️ Predecir'],
              ['leaderboard', '🏆 Tabla'],
              ['admin', '⚙️'],
            ] as [string, string][]
          ).map(([id, label]) => (
            <button
              key={id}
              className={`nav-tab ${tab === id ? 'active' : ''}`}
              onClick={() => setTab(id)}
            >
              {label}
            </button>
          ))}
        </div>
        <div style={{ fontSize: '.75rem', color: T.gray }}>
          <span style={{ color: T.gold2, fontWeight: 700 }}>{user}</span> &nbsp;
          <button
            style={{
              background: 'none',
              border: 'none',
              color: T.gray,
              cursor: 'pointer',
              fontSize: '.72rem',
            }}
            onClick={() => setUser(null)}
          >
            ↩
          </button>
        </div>
      </nav>
      {flash && <div className="flash">{flash}</div>}
      <div style={{ maxWidth: 880, margin: '0 auto', padding: '1.3rem .9rem' }}>
        {tab === 'home' && (
          <div>
            <div
              style={{
                textAlign: 'center',
                padding: '1.5rem 0 1rem',
                position: 'relative',
              }}
            >
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  background:
                    'radial-gradient(ellipse at 50% 0%,rgba(200,151,58,.1) 0%,transparent 70%)',
                  pointerEvents: 'none',
                }}
              />
              <div className="hero-stars">★ ★ ★ ★ ★</div>
              <h1
                className="hero-title"
                style={{ fontSize: 'clamp(2.3rem,5vw,3.8rem)' }}
              >
                MUNDIAL 2026
              </h1>
              <p style={{ color: T.gray, marginTop: '.3rem' }}>
                Hola, <strong style={{ color: T.gold2 }}>{user}</strong> — ¡Que
                gane el mejor!
              </p>
            </div>
            <div className="grid-3" style={{ marginBottom: '1.3rem' }}>
              {[
                {
                  label: 'Tu posición',
                  val: myRank || '–',
                  sub: 'en la tabla',
                },
                {
                  label: 'Tus puntos',
                  val: myScore.total,
                  sub: `N1:${myScore.n1} N2:${myScore.n2} N3:${myScore.n3}`,
                },
                {
                  label: 'Participantes',
                  val: Object.keys(participants).length,
                  sub: 'jugando',
                },
              ].map(({ label, val, sub }) => (
                <div
                  key={label}
                  className="card card-gold"
                  style={{ textAlign: 'center', padding: '1rem .7rem' }}
                >
                  <div
                    style={{
                      fontSize: '.68rem',
                      textTransform: 'uppercase',
                      letterSpacing: '1px',
                      color: T.gray,
                      marginBottom: '.25rem',
                    }}
                  >
                    {label}
                  </div>
                  <div
                    style={{
                      fontFamily: "'Bebas Neue',sans-serif",
                      fontSize: '2.6rem',
                      color: T.gold2,
                      lineHeight: 1,
                    }}
                  >
                    {val}
                  </div>
                  <div
                    style={{
                      fontSize: '.7rem',
                      color: T.gray,
                      marginTop: '.18rem',
                    }}
                  >
                    {sub}
                  </div>
                </div>
              ))}
            </div>
            <div className="card" style={{ marginBottom: '1rem' }}>
              <div className="section-title">Sistema de Puntaje</div>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(3,1fr)',
                  gap: '.7rem',
                }}
              >
                {[
                  {
                    n: '1',
                    label: 'Básico',
                    color: T.green,
                    max: '~70pts',
                    items: ['Ganador grupos · 1pt', 'Ganador elim. · 2pts'],
                  },
                  {
                    n: '2',
                    label: 'Intermedio',
                    color: '#6B9FD4',
                    max: '~120pts',
                    items: [
                      'Exacto grupos · 3pts',
                      'Exacto elim. · 5pts',
                      '1°+2° grupo · 4pts',
                      '3° · 2pts',
                    ],
                  },
                  {
                    n: '3',
                    label: 'Experto',
                    color: T.gold,
                    max: '~45pts',
                    items: [
                      'Campeón · 15pts',
                      'Subcampeón · 10pts',
                      'Goleador · 8pts',
                      'Arquero · 6pts',
                      'MVP · 6pts',
                    ],
                  },
                ].map((lv) => (
                  <div
                    key={lv.n}
                    style={{
                      padding: '.7rem',
                      borderRadius: 10,
                      border: `1.5px solid ${lv.color}44`,
                      background: `${lv.color}12`,
                    }}
                  >
                    <div
                      style={{
                        fontFamily: "'Bebas Neue',sans-serif",
                        color: lv.color,
                        fontSize: '.95rem',
                        letterSpacing: 1,
                      }}
                    >
                      N{lv.n} — {lv.label}
                    </div>
                    <div
                      style={{
                        fontFamily: "'Bebas Neue',sans-serif",
                        color: T.gray,
                        fontSize: '.72rem',
                        marginBottom: '.35rem',
                      }}
                    >
                      MÁX {lv.max}
                    </div>
                    {lv.items.map((i) => (
                      <div
                        key={i}
                        style={{ fontSize: '.72rem', color: T.gray }}
                      >
                        · {i}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>
            <button
              className="btn btn-gold"
              style={{ width: '100%', padding: '.82rem', fontSize: '.95rem' }}
              onClick={() => setTab('predictions')}
            >
              ✏️ IR A MIS PREDICCIONES →
            </button>
          </div>
        )}
        {tab === 'predictions' && (
          <div>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '.9rem',
              }}
            >
              <h2 className="section-title" style={{ marginBottom: 0 }}>
                Mis Predicciones
              </h2>
              {saving && <div className="saving">Guardando...</div>}
            </div>
            <div className="inner-tabs" style={{ marginBottom: '1rem' }}>
              {(
                [
                  ['groups', '⚽ Grupos'],
                  ['positions', '📊 Posiciones'],
                  ['elim', '🏆 Eliminatorias'],
                  ['specials', '⭐ N3'],
                ] as [string, string][]
              ).map(([id, label]) => (
                <button
                  key={id}
                  className={`inner-tab ${predTab === id ? 'active' : ''}`}
                  onClick={() => setPredTab(id)}
                >
                  {label}
                </button>
              ))}
            </div>
            {predTab === 'groups' && (
              <GroupSection
                myPreds={myPreds}
                results={results}
                onUpdate={(mid: string, f: string, v: string) =>
                  updatePrediction(['groups', mid, f], v)
                }
              />
            )}
            {predTab === 'positions' && (
              <PositionsSection
                myPreds={myPreds}
                results={results}
                onUpdate={(gid: string, pos: string, v: string) =>
                  updatePrediction(['positions', gid, pos], v)
                }
              />
            )}
            {predTab === 'elim' && (
              <ElimSection
                myPreds={myPreds}
                results={results}
                onUpdate={(mid: string, f: string, v: string) =>
                  updatePrediction(['elim', mid, f], v)
                }
              />
            )}
            {predTab === 'specials' && (
              <SpecialsSection
                myPreds={myPreds}
                adminData={adminData}
                onUpdate={(id: string, v: string) =>
                  updatePrediction(['specials', id], v)
                }
              />
            )}
          </div>
        )}
        {tab === 'leaderboard' && (
          <div>
            <h2 className="section-title">🏆 Tabla de Posiciones</h2>
            <div className="card" style={{ marginBottom: '1rem' }}>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '2.2rem 1fr 3rem 3rem 3rem 3.5rem',
                  gap: '.4rem',
                  padding: '.35rem .9rem',
                  borderBottom: '1px solid rgba(200,151,58,.2)',
                  marginBottom: '.55rem',
                }}
              >
                {['#', 'Nombre', 'N1', 'N2', 'N3', 'Total'].map((h) => (
                  <div
                    key={h}
                    style={{
                      fontSize: '.68rem',
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      letterSpacing: '1px',
                      color: T.gray,
                      textAlign: 'center',
                    }}
                  >
                    {h}
                  </div>
                ))}
              </div>
              {leaderboard.length === 0 && (
                <div
                  style={{
                    textAlign: 'center',
                    color: T.gray,
                    padding: '2rem',
                  }}
                >
                  Aún no hay puntos.
                </div>
              )}
              {leaderboard.map(
                ({ name, n1, n2, n3, total }: any, i: number) => (
                  <div
                    key={name}
                    className={`lb-row ${
                      i === 0
                        ? 'lb-gold'
                        : i === 1
                        ? 'lb-silver'
                        : i === 2
                        ? 'lb-bronze'
                        : 'lb-norm'
                    }`}
                    style={{
                      border:
                        name === user ? `2px solid ${T.gold2}` : undefined,
                    }}
                  >
                    <div
                      className="lb-rank"
                      style={{
                        color:
                          i === 0
                            ? T.gold
                            : i === 1
                            ? T.gray
                            : i === 2
                            ? '#C07840'
                            : T.gray,
                      }}
                    >
                      {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : i + 1}
                    </div>
                    <div
                      className="lb-name"
                      style={{ color: name === user ? T.gold2 : T.white }}
                    >
                      {name}
                      {name === user ? ' 👈' : ''}
                    </div>
                    <div className="lb-pts" style={{ color: T.green }}>
                      {n1}
                    </div>
                    <div className="lb-pts" style={{ color: '#6B9FD4' }}>
                      {n2}
                    </div>
                    <div className="lb-pts" style={{ color: T.gold }}>
                      {n3}
                    </div>
                    <div className="lb-total">{total}</div>
                  </div>
                )
              )}
            </div>
            <div
              style={{ textAlign: 'center', fontSize: '.73rem', color: T.gray }}
            >
              Máximo posible: ~235 pts · Se actualiza en tiempo real
            </div>
          </div>
        )}
        {tab === 'admin' && (
          <AdminPanel
            results={results}
            adminData={adminData}
            participants={participants}
            onSaveResults={saveResults}
            onSaveAdminData={saveAdminData}
          />
        )}
      </div>
    </div>
  );
}
