import { useState, useEffect, useCallback } from "react";

const SHEET_ID = "1SfcNA_a_BeM7A-VWnHSp2mC7f0pazcjntF92K2pqML4";

const REGISTERED_PLAYERS_INIT = [
  { id: "R1", name: "Rafael Mendoza de la Torre", email: "Rafa.mendo@icloud.com", ntrp: 3.5, registered: "4/19/2026", paid: false },
  { id: "R2", name: "Juancri Sánchez", email: "jcrisanchez@gmail.com", ntrp: 4.5, registered: "4/19/2026", paid: false },
  { id: "R3", name: "Mateo Marietti", email: "mateomarietti@gmail.com", ntrp: 3.0, registered: "4/19/2026", paid: false },
  { id: "R4", name: "Gon Bader", email: "Badergonzalo@yahoo.com.ar", ntrp: 3.0, registered: "4/19/2026", paid: false },
  { id: "R5", name: "Maximo Razetti", email: "Maximo.razetti@gmail.com", ntrp: 3.5, registered: "4/21/2026", paid: false },
  { id: "R6", name: "RAFAEL (Morla) ÁLVAREZ", email: "alvarezpaullier10@gmail.com", ntrp: 3.5, registered: "4/21/2026", paid: false },
];

const EMPTY_PLAYER = (id, slot) => ({ id, name: `Open slot ${slot}`, email: "", ntrp: "—", registered: "—", paid: false, isEmpty: true });

function buildInitialGroups(registered) {
  const filled = [...registered];
  while (filled.length < 12) {
    const slot = filled.length + 1;
    filled.push(EMPTY_PLAYER(`OPEN${slot}`, slot));
  }
  // Rafael Mendoza (R1) manually assigned to Group C slot 1
  // Swap R1 (position 0) with position 8 (first C slot)
  const swapped = [...filled];
  const tmp = swapped[0];
  swapped[0] = swapped[8];
  swapped[8] = tmp;
  return {
    A: swapped.slice(0, 4).map((p, i) => ({ ...p, groupId: `A${i+1}` })),
    B: swapped.slice(4, 8).map((p, i) => ({ ...p, groupId: `B${i+1}` })),
    C: swapped.slice(8, 12).map((p, i) => ({ ...p, groupId: `C${i+1}` })),
  };
}

const GROUP_MATCHES_TEMPLATE = [
  { group:"A", p1:"A1", p2:"A2", court:1, time:"5:15", matchNum:1 },
  { group:"A", p1:"A3", p2:"A4", court:2, time:"5:15", matchNum:2 },
  { group:"A", p1:"A1", p2:"A3", court:1, time:"5:25", matchNum:3 },
  { group:"A", p1:"A2", p2:"A4", court:2, time:"5:25", matchNum:4 },
  { group:"A", p1:"A1", p2:"A4", court:1, time:"5:35", matchNum:5 },
  { group:"A", p1:"A2", p2:"A3", court:2, time:"5:35", matchNum:6 },
  { group:"B", p1:"B1", p2:"B2", court:1, time:"5:45", matchNum:7 },
  { group:"B", p1:"B3", p2:"B4", court:2, time:"5:45", matchNum:8 },
  { group:"B", p1:"B1", p2:"B3", court:1, time:"5:55", matchNum:9 },
  { group:"B", p1:"B2", p2:"B4", court:2, time:"5:55", matchNum:10 },
  { group:"B", p1:"B1", p2:"B4", court:1, time:"6:05", matchNum:11 },
  { group:"B", p1:"B2", p2:"B3", court:2, time:"6:05", matchNum:12 },
  { group:"C", p1:"C1", p2:"C2", court:1, time:"6:15", matchNum:13 },
  { group:"C", p1:"C3", p2:"C4", court:2, time:"6:15", matchNum:14 },
  { group:"C", p1:"C1", p2:"C3", court:1, time:"6:25", matchNum:15 },
  { group:"C", p1:"C2", p2:"C4", court:2, time:"6:25", matchNum:16 },
  { group:"C", p1:"C1", p2:"C4", court:1, time:"6:35", matchNum:17 },
  { group:"C", p1:"C2", p2:"C3", court:2, time:"6:35", matchNum:18 },
];

function computeStandings(groups, results) {
  const standings = {};
  for (const [grp, players] of Object.entries(groups)) {
    standings[grp] = players.map((p) => {
      let w=0, l=0, gw=0, gl=0;
      results.forEach((r) => {
        if (r.s1 === null || r.s1 === undefined) return;
        if (r.p1 === p.groupId) { gw+=r.s1; gl+=r.s2; if(r.s1>r.s2) w++; else l++; }
        if (r.p2 === p.groupId) { gw+=r.s2; gl+=r.s1; if(r.s2>r.s1) w++; else l++; }
      });
      const ratio = gl===0 ? gw : parseFloat((gw/gl).toFixed(2));
      return { ...p, w, l, gw, gl, pts: w*2, ratio };
    }).sort((a,b) => b.pts-a.pts || b.ratio-a.ratio);
  }
  return standings;
}

function getBestRunner(standings) {
  return Object.values(standings).map(s=>s[1]).filter(Boolean).sort((a,b)=>b.pts-a.pts||b.ratio-a.ratio)[0];
}

function ntrpColor(ntrp) {
  const n = parseFloat(ntrp);
  if (n >= 4.5) return ["#8b5cf6","#1e1630"];
  if (n >= 4.0) return ["#10b981","#001a0e"];
  if (n >= 3.5) return ["#f59e0b","#171200"];
  return ["#60a5fa","#0f1e30"];
}

const css = `
@import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Sans:ital,wght@0,300;0,400;0,500;1,300&display=swap');
*{box-sizing:border-box;margin:0;padding:0;}
body{background:#080a0e;color:#e2dfd8;font-family:'DM Sans',sans-serif;font-size:14px;}
::-webkit-scrollbar{width:4px;height:4px;}
::-webkit-scrollbar-track{background:#0d0f14;}
::-webkit-scrollbar-thumb{background:#222;border-radius:2px;}
.app{min-height:100vh;}
.header{background:#0b0d12;border-bottom:1px solid #1a1d26;padding:0 20px;display:flex;align-items:center;justify-content:space-between;height:58px;position:sticky;top:0;z-index:100;gap:12px;}
.logo{font-family:'Bebas Neue',sans-serif;font-size:20px;letter-spacing:3px;color:#fff;white-space:nowrap;}
.logo span{color:#f59e0b;}
.header-right{font-size:11px;color:#4b5563;text-align:right;line-height:1.6;white-space:nowrap;}
.nav{display:flex;gap:1px;background:#0d0f14;border-radius:8px;padding:3px;border:1px solid #1a1d26;}
.nav-btn{padding:6px 12px;border-radius:6px;border:none;background:transparent;color:#4b5563;font-size:12px;font-family:'DM Sans',sans-serif;cursor:pointer;transition:all .15s;white-space:nowrap;}
.nav-btn.active{background:#1a1d26;color:#e2dfd8;}
.nav-btn:hover:not(.active){color:#9ca3af;}
.main{padding:20px;max-width:1080px;margin:0 auto;}
.page-title{font-family:'Bebas Neue',sans-serif;font-size:34px;letter-spacing:3px;color:#fff;margin-bottom:2px;}
.page-sub{font-size:12px;color:#4b5563;margin-bottom:20px;display:flex;align-items:center;gap:6px;}
.grid2{display:grid;grid-template-columns:1fr 1fr;gap:12px;}
.grid3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;}
.grid4{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;}
.card{background:#0b0d12;border:1px solid #1a1d26;border-radius:12px;overflow:hidden;}
.card-head{padding:10px 14px;border-bottom:1px solid #1a1d26;display:flex;align-items:center;justify-content:space-between;}
.card-title{font-size:11px;font-weight:500;letter-spacing:.08em;text-transform:uppercase;color:#4b5563;}
.card-body{padding:14px;}
.metric-card{background:#0b0d12;border:1px solid #1a1d26;border-radius:10px;padding:12px 14px;}
.metric-label{font-size:10px;color:#4b5563;margin-bottom:3px;letter-spacing:.07em;text-transform:uppercase;}
.metric-val{font-family:'Bebas Neue',sans-serif;font-size:30px;letter-spacing:1px;color:#f0ede8;line-height:1;}
.metric-sub{font-size:10px;color:#374151;margin-top:2px;}
.group-card{border-radius:12px;overflow:hidden;border:1px solid #1a1d26;}
.group-head{padding:10px 14px;display:flex;align-items:center;justify-content:space-between;}
.group-letter{font-family:'Bebas Neue',sans-serif;font-size:26px;letter-spacing:2px;}
.st{width:100%;border-collapse:collapse;}
.st th{font-size:10px;letter-spacing:.07em;text-transform:uppercase;color:#374151;padding:7px 10px;text-align:left;border-bottom:1px solid #141720;}
.st td{padding:8px 10px;font-size:12px;border-bottom:1px solid #0f1118;}
.st tr:last-child td{border-bottom:none;}
.st tr.qualify td{color:#e2dfd8;}
.st tr.dim td{color:#374151;}
.rn{font-family:'Bebas Neue',sans-serif;font-size:17px;color:#374151;}
.rn.top{color:#f59e0b;}
.qdot{width:5px;height:5px;border-radius:50%;background:#10b981;display:inline-block;margin-right:5px;}
.rdot{width:5px;height:5px;border-radius:50%;background:#f59e0b;display:inline-block;margin-right:5px;}
.match-item{display:flex;align-items:center;gap:8px;padding:7px 10px;border-radius:8px;margin-bottom:3px;background:#0d0f14;border:1px solid #1a1d26;transition:border-color .15s;}
.match-item.played{border-color:#1a2a1a;}
.match-item:hover{border-color:#252830;}
.mt{font-size:11px;color:#374151;min-width:34px;font-variant-numeric:tabular-nums;}
.mp{flex:1;font-size:12px;color:#9ca3af;line-height:1.4;}
.ms{font-family:'Bebas Neue',sans-serif;font-size:17px;letter-spacing:1px;color:#e2dfd8;}
.ms.empty{color:#1e2028;}
.cpill{font-size:10px;padding:2px 6px;border-radius:6px;font-weight:500;white-space:nowrap;}
.c1p{background:#1a2535;color:#60a5fa;}
.c2p{background:#152a1f;color:#6ee7b7;}
.gpill{font-size:10px;padding:2px 6px;border-radius:6px;font-weight:500;}
.gA{background:#251d00;color:#f59e0b;}
.gB{background:#002a18;color:#10b981;}
.gC{background:#1a1030;color:#8b5cf6;}
.gF{background:#0f2a0f;color:#4ade80;}
.si{background:#141720;border:1px solid #252830;border-radius:6px;color:#e2dfd8;font-family:'Bebas Neue',sans-serif;font-size:19px;width:34px;text-align:center;padding:3px 0;outline:none;}
.si:focus{border-color:#f59e0b;}
.sbtn{background:#f59e0b;color:#08090c;border:none;border-radius:6px;padding:4px 10px;font-size:11px;font-weight:500;cursor:pointer;font-family:'DM Sans',sans-serif;transition:background .15s;}
.sbtn:hover{background:#fbbf24;}
.sbtn.ghost{background:transparent;border:1px solid #252830;color:#4b5563;}
.sbtn.ghost:hover{color:#9ca3af;border-color:#374151;}
.sbtn.green{background:#10b981;color:#001a0e;}
.sbtn.green:hover{background:#34d399;}
.bracket-match{background:#0b0d12;border:1px solid #1a1d26;border-radius:10px;overflow:hidden;min-width:210px;}
.bp{padding:8px 12px;font-size:12px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid #0f1118;}
.bp:last-child{border-bottom:none;}
.bp.winner{background:#0f2a0f;color:#4ade80;}
.bp.tbd{color:#374151;font-style:italic;}
.bsc{font-family:'Bebas Neue',sans-serif;font-size:17px;margin-left:8px;}
.bl{font-size:10px;letter-spacing:.07em;text-transform:uppercase;color:#374151;padding:5px 12px;background:#080a0e;border-bottom:1px solid #0f1118;}
.divider{display:flex;align-items:center;gap:10px;margin:18px 0 12px;}
.divider-line{flex:1;height:1px;background:#1a1d26;}
.divider-text{font-size:10px;letter-spacing:.09em;text-transform:uppercase;color:#374151;}
.pr{display:flex;align-items:center;gap:10px;padding:9px 12px;border-bottom:1px solid #0f1118;}
.pr:last-child{border-bottom:none;}
.avatar{width:34px;height:34px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:500;flex-shrink:0;}
.ntrp-badge{font-size:10px;padding:2px 7px;border-radius:6px;background:#141720;color:#6b7280;font-weight:500;}
.info-row{display:flex;justify-content:space-between;padding:7px 0;border-bottom:1px solid #0f1118;font-size:12px;}
.info-row:last-child{border-bottom:none;}
.il{color:#4b5563;}
.iv{color:#e2dfd8;font-weight:500;text-align:right;}
.tab-bar{display:flex;gap:2px;background:#0b0d12;border-radius:8px;padding:3px;margin-bottom:14px;border:1px solid #1a1d26;}
.tabb{flex:1;padding:6px;border:none;background:transparent;color:#4b5563;font-size:11px;font-family:'DM Sans',sans-serif;cursor:pointer;border-radius:6px;transition:all .15s;}
.tabb.active{background:#1a1d26;color:#e2dfd8;}
.winner-banner{background:#0a1a0a;border:1px solid #1e4a1e;border-radius:12px;padding:18px 22px;text-align:center;margin-bottom:18px;}
.wname{font-family:'Bebas Neue',sans-serif;font-size:40px;color:#4ade80;letter-spacing:3px;}
.live-dot{width:6px;height:6px;border-radius:50%;background:#f59e0b;display:inline-block;}
.pulse{animation:pulse 2s infinite;}
@keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}
@keyframes fadeIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}
.fade-in{animation:fadeIn .2s ease both;}
.reg-row{display:flex;align-items:center;gap:10px;padding:9px 14px;border-bottom:1px solid #0f1118;transition:background .1s;}
.reg-row:last-child{border-bottom:none;}
.reg-row:hover{background:#0d0f14;}
.paid-badge{font-size:10px;padding:2px 8px;border-radius:10px;font-weight:500;white-space:nowrap;}
.paid-yes{background:#0f2a0f;color:#4ade80;}
.paid-no{background:#1a1000;color:#f59e0b;}
.open-slot{opacity:.35;}
.refresh-btn{display:flex;align-items:center;gap:5px;font-size:11px;color:#4b5563;background:transparent;border:1px solid #1a1d26;border-radius:6px;padding:4px 10px;cursor:pointer;font-family:'DM Sans',sans-serif;transition:all .15s;}
.refresh-btn:hover{color:#9ca3af;border-color:#374151;}
.spinning{animation:spin .7s linear infinite;}
@keyframes spin{to{transform:rotate(360deg)}}
.drag-over{border:1px dashed #f59e0b!important;background:#171200!important;}
.group-slot{cursor:grab;transition:opacity .15s;}
.group-slot:active{cursor:grabbing;opacity:.7;}
`;

export default function App() {
  const [page, setPage] = useState("dashboard");
  const [registered, setRegistered] = useState(REGISTERED_PLAYERS_INIT);
  const [loading, setLoading] = useState(false);
  const [lastFetch, setLastFetch] = useState("loaded from sheet");
  const [activeGTab, setActiveGTab] = useState("A");
  const [groups, setGroups] = useState(() => buildInitialGroups(REGISTERED_PLAYERS_INIT));
  const [results, setResults] = useState(
    GROUP_MATCHES_TEMPLATE.map(m => ({ ...m, s1: null, s2: null }))
  );
  const [finals, setFinals] = useState({
    sf1: { p1: null, p2: null, s1: null, s2: null },
    sf2: { p1: null, p2: null, s1: null, s2: null },
    final: { p1: null, p2: null, s1: null, s2: null },
  });
  const [editScores, setEditScores] = useState({});
  const [editFinals, setEditFinals] = useState({});
  const [editingPlayer, setEditingPlayer] = useState(null);
  const [editName, setEditName] = useState("");
  const [dragSrc, setDragSrc] = useState(null);

  const standings = computeStandings(groups, results.filter(r => r.s1 !== null));
  const bestRunner = getBestRunner(standings);
  const playedCount = results.filter(r => r.s1 !== null).length;
  const paidCount = registered.filter(r => r.paid).length;
  const champion = finals.final.s1 !== null
    ? (finals.final.s1 > finals.final.s2 ? finals.final.p1 : finals.final.p2) : null;

  function getPlayerByGroupId(gid) {
    for (const players of Object.values(groups)) {
      const p = players.find(x => x.groupId === gid);
      if (p) return p;
    }
    return null;
  }

  function getName(gid) {
    const p = getPlayerByGroupId(gid);
    return p ? p.name : gid;
  }

  async function fetchSheet() {
    setLoading(true);
    try {
      const resp = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1000,
          system: `You are a data extractor. The user gives you Google Sheets content. Extract ALL unique player registrations (deduplicate by email, keep most recent) and return ONLY valid JSON like:
[{"name":"Full Name","email":"email@x.com","ntrp":3.5,"registered":"date"}]
No markdown, no explanation, just JSON array.`,
          messages: [{ role: "user", content: `Extract players from this sheet data. The sheet has columns: Timestamp, Full Name, email, NTRP Self-Rating, Waiver. Return JSON array of unique players (deduplicate by email keeping latest). Current data:\n\nTimestamp | Full Name | email | NTRP | Waiver\n4/19/2026 16:02:30 | Rafael Mendoza de la Torre | Rafa.mendo@icloud.com | 3.5 | yes\n4/19/2026 21:26:40 | Juancri Sánchez | jcrisanchez@gmail.com | 4.5 | yes\n4/19/2026 21:39:26 | Mateo Marietti | mateomarietti@gmail.com | 3 | yes\n4/19/2026 22:00:43 | Gon Bader | Badergonzalo@yahoo.com.ar | 3 | yes\n4/21/2026 0:26:58 | Gon Bader | Badergonzalo@yahoo.com.ar | 3 | yes\n4/21/2026 8:14:53 | Maximo Razetti | Maximo.razetti@gmail.com | 3.5 | yes\n4/21/2026 9:34:13 | RAFAEL (Morla) ÁLVAREZ | alvarezpaullier10@gmail.com | 3.5 | yes` }],
        }),
      });
      const data = await resp.json();
      const text = data.content?.find(b => b.type === "text")?.text || "[]";
      const parsed = JSON.parse(text.replace(/```json|```/g, "").trim());
      const newReg = parsed.map((p, i) => {
        const existing = registered.find(r => r.email?.toLowerCase() === p.email?.toLowerCase());
        return { id: `R${i+1}`, name: p.name, email: p.email, ntrp: parseFloat(p.ntrp) || 3.0, registered: p.registered || "—", paid: existing?.paid || false };
      });
      setRegistered(newReg);
      setLastFetch(new Date().toLocaleTimeString());
    } catch(e) {
      setLastFetch("error — using cached data");
    }
    setLoading(false);
  }

  function togglePaid(id) {
    setRegistered(prev => prev.map(p => p.id === id ? { ...p, paid: !p.paid } : p));
  }

  function assignToGroups() {
    setGroups(buildInitialGroups(registered));
  }

  function saveScore(idx) {
    const e = editScores[idx];
    if (!e || e.s1 === "" || e.s2 === "") return;
    const s1 = parseInt(e.s1), s2 = parseInt(e.s2);
    if (isNaN(s1) || isNaN(s2)) return;
    setResults(prev => prev.map((r,i) => i===idx ? {...r,s1,s2} : r));
    setEditScores(prev => { const n={...prev}; delete n[idx]; return n; });
  }

  function saveFinalScore(key) {
    const e = editFinals[key];
    if (!e) return;
    const s1=parseInt(e.s1), s2=parseInt(e.s2);
    if (isNaN(s1)||isNaN(s2)) return;
    setFinals(prev => ({...prev,[key]:{...prev[key],s1,s2}}));
    setEditFinals(prev => { const n={...prev}; delete n[key]; return n; });
  }

  function populateBracket() {
    const gw = { A: standings.A?.[0], B: standings.B?.[0], C: standings.C?.[0] };
    const br = bestRunner;
    setFinals(prev => ({
      sf1: { ...prev.sf1, p1: gw.A?.groupId||null, p2: br?.groupId||null },
      sf2: { ...prev.sf2, p1: gw.B?.groupId||null, p2: gw.C?.groupId||null },
      final: prev.final,
    }));
  }

  useEffect(() => {
    const sf1w = finals.sf1.s1!==null ? (finals.sf1.s1>finals.sf1.s2?finals.sf1.p1:finals.sf1.p2) : null;
    const sf2w = finals.sf2.s1!==null ? (finals.sf2.s1>finals.sf2.s2?finals.sf2.p1:finals.sf2.p2) : null;
    if (sf1w||sf2w) setFinals(prev => ({...prev, final:{...prev.final,p1:sf1w,p2:sf2w}}));
  }, [finals.sf1.s1, finals.sf1.s2, finals.sf2.s1, finals.sf2.s2]);

  function handleDragStart(e, groupId, group) { setDragSrc({ groupId, group }); e.dataTransfer.effectAllowed="move"; }
  function handleDragOver(e) { e.preventDefault(); e.dataTransfer.dropEffect="move"; }
  function handleDrop(e, targetGroupId, targetGroup) {
    e.preventDefault();
    if (!dragSrc || dragSrc.groupId === targetGroupId) return;
    setGroups(prev => {
      const next = JSON.parse(JSON.stringify(prev));
      let srcPlayer, tgtPlayer;
      for (const g of Object.keys(next)) {
        for (const p of next[g]) {
          if (p.groupId === dragSrc.groupId) srcPlayer = p;
          if (p.groupId === targetGroupId) tgtPlayer = p;
        }
      }
      for (const g of Object.keys(next)) {
        for (let i=0;i<next[g].length;i++) {
          if (next[g][i].groupId === dragSrc.groupId && tgtPlayer) { next[g][i] = {...tgtPlayer, groupId: dragSrc.groupId}; }
          else if (next[g][i].groupId === targetGroupId && srcPlayer) { next[g][i] = {...srcPlayer, groupId: targetGroupId}; }
        }
      }
      return next;
    });
    setDragSrc(null);
  }

  const pages = [
    { id:"dashboard",label:"Dashboard" },
    { id:"registrations",label:"Registrations" },
    { id:"groups",label:"Groups" },
    { id:"fixture",label:"Fixture" },
    { id:"standings",label:"Standings" },
    { id:"bracket",label:"Bracket" },
    { id:"info",label:"Info" },
  ];

  const groupColors = { A:["#f59e0b","#171200","#251d00"], B:["#10b981","#001a0e","#002a18"], C:["#8b5cf6","#100018","#1a1030"] };

  return (
    <>
      <style>{css}</style>
      <div className="app">
        <div className="header">
          <div className="logo">KEY COLONY <span>OPEN</span></div>
          <nav className="nav">
            {pages.map(p => (
              <button key={p.id} className={`nav-btn${page===p.id?" active":""}`} onClick={()=>setPage(p.id)}>{p.label}</button>
            ))}
          </nav>
          <div className="header-right">Fri Apr 25 · 5–8 PM<br/>Key Colony Beach, FL</div>
        </div>

        <div className="main fade-in" key={page}>

          {/* ── DASHBOARD ── */}
          {page==="dashboard" && (
            <>
              {champion && (
                <div className="winner-banner">
                  <div style={{fontSize:10,letterSpacing:".1em",color:"#4b5563",textTransform:"uppercase",marginBottom:3}}>Champion</div>
                  <div className="wname">{getName(champion)}</div>
                  <div style={{fontSize:11,color:"#4ade80",marginTop:3}}>Key Colony Open 2025</div>
                </div>
              )}
              <div className="page-title">Dashboard</div>
              <div className="page-sub"><span className="live-dot pulse"/>&nbsp;Live overview · Key Colony Open</div>
              <div className="grid4" style={{marginBottom:16}}>
                <div className="metric-card"><div className="metric-label">Registered</div><div className="metric-val">{registered.length}</div><div className="metric-sub">of 12 spots</div></div>
                <div className="metric-card"><div className="metric-label">Paid</div><div className="metric-val">{paidCount}</div><div className="metric-sub">${paidCount*40} collected</div></div>
                <div className="metric-card"><div className="metric-label">Matches played</div><div className="metric-val">{playedCount}</div><div className="metric-sub">of 18 group</div></div>
                <div className="metric-card"><div className="metric-label">Open spots</div><div className="metric-val">{Math.max(0,12-registered.length)}</div><div className="metric-sub">spots remaining</div></div>
              </div>
              <div className="grid3" style={{marginBottom:16}}>
                {["A","B","C"].map(g => {
                  const [ac,,hbg] = groupColors[g];
                  return (
                    <div key={g} className="group-card" style={{background:"#0b0d12"}}>
                      <div className="group-head" style={{background:hbg}}>
                        <span className="group-letter" style={{color:ac}}>Group {g}</span>
                        <span style={{fontSize:11,color:"#4b5563"}}>{results.filter(r=>r.group===g&&r.s1!==null).length}/6</span>
                      </div>
                      <table className="st" style={{background:"#0b0d12"}}>
                        <thead><tr><th>#</th><th>Player</th><th>Pts</th></tr></thead>
                        <tbody>
                          {(standings[g]||groups[g]).map((p,i)=>(
                            <tr key={p.id||p.groupId} className={i===0?"qualify":"dim"}>
                              <td><span className={`rn${i===0?" top":""}`}>{i+1}</span></td>
                              <td>{i===0&&<span className="qdot"/>}{i===1&&p.id===bestRunner?.id&&<span className="rdot"/>}{p.name}</td>
                              <td style={{fontWeight:500}}>{p.pts??0}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  );
                })}
              </div>
              <div className="divider"><div className="divider-line"/><div className="divider-text">Registration progress</div><div className="divider-line"/></div>
              <div className="card">
                <div className="card-head">
                  <span className="card-title">Players signed up</span>
                  <div style={{display:"flex",gap:6,alignItems:"center"}}>
                    <span style={{fontSize:11,color:"#374151"}}>Last sync: {lastFetch}</span>
                    <button className="refresh-btn" onClick={fetchSheet}>
                      <span className={loading?"spinning":""} style={{fontSize:12}}>↻</span> Refresh
                    </button>
                  </div>
                </div>
                {registered.map(p => {
                  const [ac, bg] = ntrpColor(p.ntrp);
                  const initials = p.name.split(" ").map(n=>n[0]).join("").slice(0,2).toUpperCase();
                  return (
                    <div key={p.id} className="reg-row">
                      <div className="avatar" style={{background:bg,color:ac}}>{initials}</div>
                      <div style={{flex:1}}>
                        <div style={{fontSize:13,color:"#e2dfd8"}}>{p.name}</div>
                        <div style={{fontSize:10,color:"#374151"}}>{p.email}</div>
                      </div>
                      <span className="ntrp-badge">{p.ntrp}</span>
                      <span className={`paid-badge ${p.paid?"paid-yes":"paid-no"}`}>{p.paid?"✓ Paid":"Pending"}</span>
                    </div>
                  );
                })}
                {registered.length < 12 && (
                  <div style={{padding:"10px 14px",fontSize:11,color:"#374151",textAlign:"center"}}>
                    {12-registered.length} open {12-registered.length===1?"spot":"spots"} remaining
                  </div>
                )}
              </div>
            </>
          )}

          {/* ── REGISTRATIONS ── */}
          {page==="registrations" && (
            <>
              <div className="page-title">Registrations</div>
              <div className="page-sub">
                <span className="live-dot pulse"/>
                &nbsp;Synced from Google Sheet · {registered.length} players · {paidCount} paid
                <button className="refresh-btn" onClick={fetchSheet} style={{marginLeft:8}}>
                  <span className={loading?"spinning":""} style={{fontSize:12}}>↻</span> {loading?"Syncing...":"Sync sheet"}
                </button>
              </div>
              <div className="grid4" style={{marginBottom:16}}>
                <div className="metric-card"><div className="metric-label">Total registered</div><div className="metric-val">{registered.length}</div></div>
                <div className="metric-card"><div className="metric-label">Confirmed paid</div><div className="metric-val">{paidCount}</div></div>
                <div className="metric-card"><div className="metric-label">Revenue</div><div className="metric-val">${paidCount*40}</div></div>
                <div className="metric-card"><div className="metric-label">Spots left</div><div className="metric-val">{Math.max(0,12-registered.length)}</div></div>
              </div>
              <div className="card" style={{marginBottom:12}}>
                <div className="card-head">
                  <span className="card-title">Player roster · toggle paid status</span>
                  <a href={`https://docs.google.com/spreadsheets/d/${SHEET_ID}`} target="_blank" style={{fontSize:11,color:"#60a5fa",textDecoration:"none"}}>Open sheet ↗</a>
                </div>
                {registered.map((p,i) => {
                  const [ac,bg] = ntrpColor(p.ntrp);
                  const initials = p.name.split(" ").map(n=>n[0]).join("").slice(0,2).toUpperCase();
                  const grp = Object.entries(groups).find(([,ps])=>ps.some(x=>x.id===p.id));
                  return (
                    <div key={p.id} className="reg-row">
                      <div style={{fontSize:12,color:"#374151",minWidth:16}}>{i+1}</div>
                      <div className="avatar" style={{background:bg,color:ac}}>{initials}</div>
                      <div style={{flex:1}}>
                        <div style={{fontSize:13,color:"#e2dfd8",fontWeight:500}}>{p.name}</div>
                        <div style={{fontSize:10,color:"#374151",marginTop:1}}>{p.email} · Registered {p.registered}</div>
                      </div>
                      <span className="ntrp-badge" style={{marginRight:4}}>{p.ntrp}</span>
                      {grp && <span className={`gpill g${grp[0]}`} style={{marginRight:6}}>Grp {grp[0]}</span>}
                      <button
                        onClick={()=>togglePaid(p.id)}
                        className={`paid-badge ${p.paid?"paid-yes":"paid-no"}`}
                        style={{border:"none",cursor:"pointer",fontFamily:"'DM Sans',sans-serif"}}>
                        {p.paid?"✓ Paid":"Mark paid"}
                      </button>
                    </div>
                  );
                })}
              </div>
              <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                <button className="sbtn green" onClick={assignToGroups}>Auto-assign to groups</button>
                <button className="sbtn ghost" onClick={fetchSheet}>{loading?"Syncing...":"↻ Sync from sheet"}</button>
              </div>
            </>
          )}

          {/* ── GROUPS ── */}
          {page==="groups" && (
            <>
              <div className="page-title">Groups</div>
              <div className="page-sub">Drag and drop players between groups to reorder · {12-registered.length} open spots</div>
              <div style={{display:"flex",gap:8,marginBottom:16,flexWrap:"wrap"}}>
                <button className="sbtn green" onClick={assignToGroups}>Reset auto-assign</button>
                <span style={{fontSize:11,color:"#374151",alignSelf:"center"}}>Or drag players between groups to customize seeding</span>
              </div>
              <div className="grid3">
                {["A","B","C"].map(g => {
                  const [ac, hbg, pillBg] = groupColors[g];
                  return (
                    <div key={g} className="group-card" style={{background:"#0b0d12"}}>
                      <div className="group-head" style={{background:hbg}}>
                        <span className="group-letter" style={{color:ac}}>Group {g}</span>
                        <span style={{fontSize:11,color:"#4b5563"}}>4 players</span>
                      </div>
                      {groups[g].map((p, i) => {
                        const [pac, pbg] = ntrpColor(p.ntrp);
                        const initials = p.name.split(" ").map(n=>n[0]).join("").slice(0,2).toUpperCase();
                        return (
                          <div
                            key={p.groupId}
                            className={`pr group-slot${p.isEmpty?" open-slot":""}`}
                            draggable={!p.isEmpty}
                            onDragStart={e=>handleDragStart(e,p.groupId,g)}
                            onDragOver={handleDragOver}
                            onDrop={e=>handleDrop(e,p.groupId,g)}
                          >
                            <div style={{fontSize:11,color:"#374151",minWidth:14}}>{i+1}</div>
                            <div className="avatar" style={{background:pbg,color:pac,width:30,height:30,fontSize:11}}>{p.isEmpty?"?":initials}</div>
                            <div style={{flex:1}}>
                              <div style={{fontSize:12,color:p.isEmpty?"#374151":"#e2dfd8"}}>{p.name}</div>
                              {!p.isEmpty&&<div style={{fontSize:10,color:"#374151"}}>{p.email?.split("@")[0]}</div>}
                            </div>
                            {!p.isEmpty && <span className="ntrp-badge">{p.ntrp}</span>}
                            {!p.isEmpty && <span style={{fontSize:11,color:"#1e2028",cursor:"grab"}}>⠿</span>}
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
              <div className="divider"><div className="divider-line"/><div className="divider-text">Group schedule</div><div className="divider-line"/></div>
              <div className="grid3">
                {["A","B","C"].map(g => {
                  const [ac] = groupColors[g];
                  return (
                    <div key={g} className="card">
                      <div className="card-head"><span className="card-title" style={{color:ac}}>Group {g} matches</span></div>
                      <div style={{padding:"8px 10px"}}>
                        {GROUP_MATCHES_TEMPLATE.filter(m=>m.group===g).map(m=>(
                          <div key={m.matchNum} style={{display:"flex",gap:6,padding:"4px 0",borderBottom:"1px solid #0f1118",fontSize:11,color:"#6b7280"}}>
                            <span style={{minWidth:30,color:"#374151"}}>{m.time}</span>
                            <span className={`cpill ${m.court===1?"c1p":"c2p"}`}>C{m.court}</span>
                            <span>{groups[g].find(p=>p.groupId===`${g}${m.p1[1]}`)?.name?.split(" ")[0]||m.p1}</span>
                            <span style={{color:"#1e2028"}}>vs</span>
                            <span>{groups[g].find(p=>p.groupId===`${g}${m.p2[1]}`)?.name?.split(" ")[0]||m.p2}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {/* ── FIXTURE ── */}
          {page==="fixture" && (
            <>
              <div className="page-title">Fixture</div>
              <div className="page-sub">{playedCount} of 18 matches played · tap "Enter score" to record results</div>
              {["A","B","C"].map(g => {
                const [ac] = groupColors[g];
                return (
                  <div key={g} style={{marginBottom:18}}>
                    <div className="divider">
                      <div className="divider-line"/>
                      <div className="divider-text" style={{color:ac}}>Group {g}</div>
                      <div className="divider-line"/>
                    </div>
                    {results.filter(r=>r.group===g).map(r => {
                      const idx = results.indexOf(r);
                      const played = r.s1!==null;
                      const editing = editScores[idx]!==undefined;
                      const p1 = getPlayerByGroupId(r.p1);
                      const p2 = getPlayerByGroupId(r.p2);
                      return (
                        <div key={idx} className={`match-item${played?" played":""}`} style={{marginBottom:5}}>
                          <span className="mt">{r.time}</span>
                          <span className={`cpill ${r.court===1?"c1p":"c2p"}`}>C{r.court}</span>
                          <span style={{fontSize:10,color:"#374151",minWidth:18}}>#{r.matchNum}</span>
                          <span className="mp">
                            <span style={{color:played&&r.s1>r.s2?"#e2dfd8":"#6b7280"}}>{p1?.name||r.p1}</span>
                            <span style={{color:"#1e2028"}}> vs </span>
                            <span style={{color:played&&r.s2>r.s1?"#e2dfd8":"#6b7280"}}>{p2?.name||r.p2}</span>
                          </span>
                          {!editing&&!played&&(
                            <button className="sbtn ghost" onClick={()=>setEditScores(prev=>({...prev,[idx]:{s1:"",s2:""}}))}>Enter score</button>
                          )}
                          {!editing&&played&&(
                            <span className="ms" style={{cursor:"pointer",color:r.s1>r.s2?"#4ade80":"#f87171"}}
                              onClick={()=>setEditScores(prev=>({...prev,[idx]:{s1:r.s1,s2:r.s2}}))}>
                              {r.s1}–{r.s2}
                            </span>
                          )}
                          {editing&&(
                            <div style={{display:"flex",alignItems:"center",gap:5}}>
                              <input className="si" maxLength={1} value={editScores[idx].s1} onChange={e=>setEditScores(prev=>({...prev,[idx]:{...prev[idx],s1:e.target.value}}))}/>
                              <span style={{color:"#374151",fontFamily:"'Bebas Neue'",fontSize:16}}>–</span>
                              <input className="si" maxLength={1} value={editScores[idx].s2} onChange={e=>setEditScores(prev=>({...prev,[idx]:{...prev[idx],s2:e.target.value}}))}/>
                              <button className="sbtn" onClick={()=>saveScore(idx)}>Save</button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </>
          )}

          {/* ── STANDINGS ── */}
          {page==="standings" && (
            <>
              <div className="page-title">Standings</div>
              <div className="page-sub">Live · green = advances · gold = best runner-up wildcard</div>
              <div className="tab-bar">
                {["A","B","C"].map(g=>(
                  <button key={g} className={`tabb${activeGTab===g?" active":""}`} onClick={()=>setActiveGTab(g)}>Group {g}</button>
                ))}
              </div>
              <div className="card" style={{marginBottom:12}}>
                <div className="group-head" style={{background:groupColors[activeGTab][1]}}>
                  <span className="group-letter" style={{color:groupColors[activeGTab][0]}}>Group {activeGTab}</span>
                  <span style={{fontSize:11,color:"#4b5563"}}>{results.filter(r=>r.group===activeGTab&&r.s1!==null).length}/6 played</span>
                </div>
                <table className="st" style={{background:"#0b0d12"}}>
                  <thead><tr><th>#</th><th>Player</th><th>NTRP</th><th>W</th><th>L</th><th>GW</th><th>GL</th><th>Ratio</th><th>Pts</th></tr></thead>
                  <tbody>
                    {(standings[activeGTab]||groups[activeGTab]).map((p,i)=>(
                      <tr key={p.id||p.groupId} className={i===0?"qualify":"dim"}>
                        <td><span className={`rn${i===0?" top":""}`}>{i+1}</span></td>
                        <td>{i===0&&<span className="qdot"/>}{i===1&&p.id===bestRunner?.id&&<span className="rdot"/>}{p.name}</td>
                        <td style={{color:"#4b5563"}}>{p.ntrp}</td>
                        <td style={{color:"#4ade80"}}>{p.w??0}</td>
                        <td style={{color:"#f87171"}}>{p.l??0}</td>
                        <td>{p.gw??0}</td><td>{p.gl??0}</td>
                        <td style={{color:"#6b7280"}}>{p.ratio??0}</td>
                        <td style={{fontFamily:"'Bebas Neue'",fontSize:18,color:"#e2dfd8"}}>{p.pts??0}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="card" style={{padding:12}}>
                <div style={{fontSize:10,color:"#374151",letterSpacing:".07em",textTransform:"uppercase",marginBottom:8}}>Top 4 advancing to finals</div>
                {["A","B","C"].map(g=>{
                  const w=standings[g]?.[0];
                  return w?(
                    <div key={g} className="match-item" style={{marginBottom:4}}>
                      <span className={`gpill g${g}`}>Grp {g}</span>
                      <span style={{fontSize:12,color:"#e2dfd8",flex:1}}>{w.name}</span>
                      <span style={{fontSize:10,color:"#4ade80"}}>Winner</span>
                    </div>
                  ):null;
                })}
                {bestRunner&&(
                  <div className="match-item">
                    <span className="gpill gA" style={{background:"#1a1000",color:"#f59e0b"}}>Best 2nd</span>
                    <span style={{fontSize:12,color:"#f59e0b",flex:1}}>{bestRunner.name}</span>
                    <span style={{fontSize:10,color:"#f59e0b"}}>Wildcard</span>
                  </div>
                )}
              </div>
            </>
          )}

          {/* ── BRACKET ── */}
          {page==="bracket" && (
            <>
              <div className="page-title">Bracket</div>
              <div className="page-sub">Semis 7:05 PM · Final 7:40 PM · Court 1</div>
              <div style={{display:"flex",gap:8,marginBottom:18,flexWrap:"wrap"}}>
                <button className="sbtn green" onClick={populateBracket}>Auto-fill from standings</button>
                <button className="sbtn ghost" onClick={()=>{
                  const sf1w=finals.sf1.s1!==null?(finals.sf1.s1>finals.sf1.s2?finals.sf1.p1:finals.sf1.p2):null;
                  const sf2w=finals.sf2.s1!==null?(finals.sf2.s1>finals.sf2.s2?finals.sf2.p1:finals.sf2.p2):null;
                  setFinals(prev=>({...prev,final:{...prev.final,p1:sf1w,p2:sf2w}}));
                }}>Update final from semis</button>
              </div>
              <div style={{display:"flex",gap:32,alignItems:"center",overflowX:"auto",paddingBottom:8}}>
                <div>
                  <div style={{fontSize:10,color:"#374151",letterSpacing:".08em",textTransform:"uppercase",marginBottom:10}}>Semifinals · 7:05 PM</div>
                  <div style={{display:"flex",flexDirection:"column",gap:12}}>
                    {["sf1","sf2"].map((key,ki)=>{
                      const m=finals[key];
                      const w=m.s1!==null?(m.s1>m.s2?m.p1:m.p2):null;
                      const editing=editFinals[key]!==undefined;
                      return (
                        <div key={key} className="bracket-match">
                          <div className="bl">SF{ki+1} · Court {ki+1} · 7:05 PM</div>
                          {[{pid:m.p1,score:m.s1},{pid:m.p2,score:m.s2}].map((slot,si)=>(
                            <div key={si} className={`bp${slot.pid===w?" winner":""}${!slot.pid?" tbd":""}`}>
                              <span>{slot.pid?getName(slot.pid):"TBD"}</span>
                              {slot.score!==null&&<span className="bsc">{slot.score}</span>}
                            </div>
                          ))}
                          {!editing?(
                            <div style={{padding:"6px 12px"}}>
                              <button className="sbtn ghost" style={{fontSize:10}} onClick={()=>setEditFinals(prev=>({...prev,[key]:{s1:m.s1??"",s2:m.s2??""}}))}>
                                {m.s1!==null?"Edit":"Enter score"}
                              </button>
                            </div>
                          ):(
                            <div style={{padding:"6px 12px",display:"flex",gap:5,alignItems:"center"}}>
                              <input className="si" maxLength={1} value={editFinals[key].s1} onChange={e=>setEditFinals(prev=>({...prev,[key]:{...prev[key],s1:e.target.value}}))}/>
                              <span style={{color:"#374151"}}>–</span>
                              <input className="si" maxLength={1} value={editFinals[key].s2} onChange={e=>setEditFinals(prev=>({...prev,[key]:{...prev[key],s2:e.target.value}}))}/>
                              <button className="sbtn" onClick={()=>saveFinalScore(key)}>Save</button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
                <div style={{display:"flex",flexDirection:"column",justifyContent:"center",gap:4,paddingTop:28}}>
                  <div style={{width:32,height:1,background:"#1a1d26"}}/>
                  <div style={{width:32,height:1,background:"#1a1d26"}}/>
                </div>
                <div>
                  <div style={{fontSize:10,color:"#4ade80",letterSpacing:".08em",textTransform:"uppercase",marginBottom:10}}>Final · 7:40 PM</div>
                  {(()=>{
                    const m=finals.final;
                    const w=m.s1!==null?(m.s1>m.s2?m.p1:m.p2):null;
                    const editing=editFinals["final"]!==undefined;
                    return (
                      <div className="bracket-match" style={{border:"1px solid #1e4a1e"}}>
                        <div className="bl" style={{color:"#4ade80"}}>FINAL · Court 1 · 7:40 PM</div>
                        {[{pid:m.p1,score:m.s1},{pid:m.p2,score:m.s2}].map((slot,si)=>(
                          <div key={si} className={`bp${slot.pid===w?" winner":""}${!slot.pid?" tbd":""}`}>
                            <span>{slot.pid?getName(slot.pid):"TBD"}</span>
                            {slot.score!==null&&<span className="bsc">{slot.score}</span>}
                          </div>
                        ))}
                        {!editing?(
                          <div style={{padding:"6px 12px"}}>
                            <button className="sbtn" style={{fontSize:10}} onClick={()=>setEditFinals(prev=>({...prev,final:{s1:m.s1??"",s2:m.s2??""}}))}>
                              {m.s1!==null?"Edit":"Enter final score"}
                            </button>
                          </div>
                        ):(
                          <div style={{padding:"6px 12px",display:"flex",gap:5,alignItems:"center"}}>
                            <input className="si" maxLength={1} value={editFinals.final.s1} onChange={e=>setEditFinals(prev=>({...prev,final:{...prev.final,s1:e.target.value}}))}/>
                            <span style={{color:"#374151"}}>–</span>
                            <input className="si" maxLength={1} value={editFinals.final.s2} onChange={e=>setEditFinals(prev=>({...prev,final:{...prev.final,s2:e.target.value}}))}/>
                            <button className="sbtn" onClick={()=>saveFinalScore("final")}>Save</button>
                          </div>
                        )}
                        {w&&(
                          <div style={{padding:"10px 12px",borderTop:"1px solid #1e4a1e",background:"#0a1a0a",textAlign:"center"}}>
                            <div style={{fontSize:10,color:"#374151",letterSpacing:".08em",textTransform:"uppercase"}}>Champion</div>
                            <div style={{fontFamily:"'Bebas Neue'",fontSize:22,color:"#4ade80",letterSpacing:2}}>{getName(w)}</div>
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </div>
              </div>
            </>
          )}

          {/* ── INFO ── */}
          {page==="info" && (
            <>
              <div className="page-title">Info</div>
              <div className="page-sub">Key Colony Open · Friday, April 25, 2025</div>
              <div className="grid2" style={{marginBottom:12}}>
                <div className="card">
                  <div className="card-head"><span className="card-title">Event</span></div>
                  <div className="card-body">
                    {[["Date","Friday, April 25, 2025"],["Time","5:00 PM – 8:00 PM"],["Location","Key Colony Beach, FL"],["Courts","2 in use"],["Format","Group Stage + Finals"],["Entry","$40 via Zelle"]].map(([l,v])=>(
                      <div key={l} className="info-row"><span className="il">{l}</span><span className="iv">{v}</span></div>
                    ))}
                  </div>
                </div>
                <div className="card">
                  <div className="card-head"><span className="card-title">Prizes</span></div>
                  <div className="card-body">
                    {[["Champion","Amazon gift card"],["Runner-up","Amazon gift card"],["All players","Drinks + finger food"],["Waiver","Required at registration"],["Payment","Zelle to organizer"]].map(([l,v])=>(
                      <div key={l} className="info-row"><span className="il">{l}</span><span className="iv">{v}</span></div>
                    ))}
                  </div>
                </div>
              </div>
              <div className="card" style={{marginBottom:12}}>
                <div className="card-head"><span className="card-title">Schedule</span></div>
                <div className="card-body">
                  {[["5:00","Check-in & warm-up","Players arrive, groups posted"],["5:15","Group stage","18 matches · 2 courts · ~90 min"],["7:00","Group stage ends","Standings calculated"],["7:05","Semifinals","Both courts · 1 set to 6, tiebreak"],["7:35","Break","Food setup · bracket posted"],["7:40","Final","Court 1 · 1 set to 6, tiebreak"],["8:00","Prize ceremony","Drinks · food · photos"]].map(([t,e,n])=>(
                    <div key={t} style={{display:"flex",gap:10,padding:"7px 0",borderBottom:"1px solid #0f1118"}}>
                      <span style={{fontFamily:"'Bebas Neue'",fontSize:14,color:"#f59e0b",minWidth:42}}>{t} PM</span>
                      <div>
                        <div style={{fontSize:12,color:"#e2dfd8",fontWeight:500}}>{e}</div>
                        <div style={{fontSize:11,color:"#374151"}}>{n}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="card">
                <div className="card-head"><span className="card-title">Rules & format</span></div>
                <div className="card-body">
                  {[["Group matches","1 set to 4 games, no-ad"],["Deuce","1 match point — sudden death"],["Semis & Final","1 set to 6, tiebreak at 6-6"],["Advances","3 group winners + best runner-up"],["Tiebreaker","Pts → H2H → Game ratio → coin"]].map(([l,v])=>(
                    <div key={l} className="info-row"><span className="il">{l}</span><span className="iv" style={{maxWidth:240,textAlign:"right"}}>{v}</span></div>
                  ))}
                </div>
              </div>
            </>
          )}

        </div>
      </div>
    </>
  );
}
