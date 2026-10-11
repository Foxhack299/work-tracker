import { useState, useEffect, useRef } from "react";

const STORAGE_KEY = "work_tracker_sessions_v2";
const THEME_KEY = "work_tracker_theme";

const THEMES = {
  dark: {
    bg: "#0c0c0d", card: "#161618", navBg: "rgba(12,12,13,0.82)", text: "#f4f4f5",
    sub: "#a1a1aa", muted: "#7c7c85", border: "#26262a", surface2: "#1f1f22",
    accent: "#34d399", accentInk: "#052e1f", danger: "#f87171",
    successBg: "rgba(52,211,153,0.1)", dangerBg: "rgba(248,113,113,0.1)",
    shadow: "none", scrollThumb: "#2a2a2e",
  },
  light: {
    bg: "#f6f6f3", card: "#ffffff", navBg: "rgba(255,255,255,0.85)", text: "#18181b",
    sub: "#52525b", muted: "#71717a", border: "#e7e5e0", surface2: "#f0efea",
    accent: "#059669", accentInk: "#ffffff", danger: "#dc2626",
    successBg: "rgba(5,150,105,0.08)", dangerBg: "rgba(220,38,38,0.07)",
    shadow: "0 1px 2px rgba(24,24,27,0.04), 0 4px 16px rgba(24,24,27,0.04)", scrollThumb: "#dddbd4",
  },
};

// Tracés Lucide (MIT), en ligne pour éviter une dépendance.
const ICONS = {
  calendar: <><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></>,
  chart: <><path d="M3 3v18h18"/><path d="M18 17V9M13 17V5M8 17v-3"/></>,
  clock: <><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></>,
  download: <><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M7 10l5 5 5-5M12 15V3"/></>,
  upload: <><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M17 8l-5-5-5 5M12 3v12"/></>,
  sliders: <path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6"/>,
  mic: <><rect x="9" y="2" width="6" height="12" rx="3"/><path d="M19 10v1a7 7 0 0 1-14 0v-1M12 18v4"/></>,
  x: <path d="M18 6 6 18M6 6l12 12"/>,
  check: <path d="M20 6 9 17l-5-5"/>,
  plus: <path d="M12 5v14M5 12h14"/>,
  left: <path d="m15 18-6-6 6-6"/>,
  right: <path d="m9 18 6-6-6-6"/>,
  pencil: <path d="M17 3a2.85 2.85 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/>,
  moon: <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>,
  sun: <><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/></>,
};

function Icon({ name, size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flexShrink:0, display:"block" }}>
      {ICONS[name]}
    </svg>
  );
}

function formatHM(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h === 0) return `${m}min`;
  if (m === 0) return `${h}h`;
  return `${h}h${String(m).padStart(2, "0")}`;
}

function formatTime(date) {
  return new Date(date).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}

function formatDate(date) {
  return new Date(date).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
}

function timeStrToSeconds(timeStr) {
  const [h, m] = timeStr.split(":").map(Number);
  return h * 3600 + m * 60;
}

// Amplitude entre début et fin ; si la fin est avant le début, c'est un horaire de nuit (fin le lendemain).
function spanSeconds(startStr, endStr) {
  const startSec = timeStrToSeconds(startStr);
  const endSec = timeStrToSeconds(endStr);
  if (endSec === startSec) return null;
  return endSec > startSec ? endSec - startSec : endSec + 86400 - startSec;
}

function getWeekStart(date) {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d;
}

function isValidSession(s) {
  return s && typeof s === "object"
    && Number.isFinite(s.start) && Number.isFinite(s.end) && Number.isFinite(s.duration)
    && s.duration >= 0;
}

function groupByDay(sessions) {
  const groups = {};
  // Sort sessions most recent first
  const sorted = [...sessions].sort((a, b) => b.start - a.start);
  sorted.forEach((s) => {
    const day = new Date(s.start).toLocaleDateString("fr-FR");
    if (!groups[day]) groups[day] = { label: formatDate(s.start), sessions: [], total: 0 };
    groups[day].sessions.push(s);
    groups[day].total += s.duration || 0;
  });
  // Most recent day first
  return Object.values(groups).sort((a, b) => b.sessions[0].start - a.sessions[0].start);
}

function getTodayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}

function getDaysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate();
}
function getFirstDayOfMonth(year, month) {
  let d = new Date(year, month, 1).getDay();
  return d === 0 ? 6 : d - 1;
}

const MONTHS_FR = ["Janvier","Février","Mars","Avril","Mai","Juin","Juillet","Août","Septembre","Octobre","Novembre","Décembre"];
const DAYS_FR = ["L","M","M","J","V","S","D"];
const WEEKDAYS_FR = ["dimanche","lundi","mardi","mercredi","jeudi","vendredi","samedi"];
const MONTHS_FR_ASCII = ["janvier","fevrier","mars","avril","mai","juin","juillet","aout","septembre","octobre","novembre","decembre"];

function normalizeText(str) {
  return str.toLowerCase().trim().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

function parseSpokenTime(raw) {
  const text = normalizeText(raw);
  if (/\bminuit\b/.test(text)) return /demi/.test(text) ? "00:30" : "00:00";
  if (/\bmidi\b/.test(text)) return /demi/.test(text) ? "12:30" : "12:00";
  const match = text.match(/(\d{1,2})\s*(?:heures?|h|:)\s*(\d{1,2})?/);
  if (!match) return null;
  let h = parseInt(match[1], 10);
  let m = match[2] !== undefined ? parseInt(match[2], 10) : 0;
  if (match[2] === undefined) {
    if (/et\s+demie?/.test(text)) m = 30;
    else if (/et\s+quart/.test(text)) m = 15;
    else if (/moins\s+(le\s+)?quart/.test(text)) { h -= 1; m = 45; }
  }
  if (h < 0) h += 24;
  if (h > 23 || m > 59) return null;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function toDateStr(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function parseSpokenDate(raw) {
  const text = normalizeText(raw);
  const today = new Date();

  // Une date précise ("3 juin") prime sur un simple nom de jour ("lundi 3 juin").
  const dayMonthMatch = text.match(/(\d{1,2})(?:er)?\s+(janvier|fevrier|mars|avril|mai|juin|juillet|aout|septembre|octobre|novembre|decembre)/);
  if (dayMonthMatch) {
    const day = parseInt(dayMonthMatch[1], 10);
    const monthIdx = MONTHS_FR_ASCII.indexOf(dayMonthMatch[2]);
    let d = new Date(today.getFullYear(), monthIdx, day);
    if (d.getTime() - today.getTime() > 1000 * 60 * 60 * 24 * 3) {
      d = new Date(today.getFullYear() - 1, monthIdx, day);
    }
    return toDateStr(d);
  }

  if (/aujourd\s*'?\s*hui/.test(text)) return toDateStr(today);
  if (/avant.?hier/.test(text)) { const d = new Date(today); d.setDate(d.getDate() - 2); return toDateStr(d); }
  if (/\bhier\b/.test(text)) { const d = new Date(today); d.setDate(d.getDate() - 1); return toDateStr(d); }
  if (/\bdemain\b/.test(text)) { const d = new Date(today); d.setDate(d.getDate() + 1); return toDateStr(d); }

  for (let i = 0; i < WEEKDAYS_FR.length; i++) {
    if (new RegExp(`\\b${WEEKDAYS_FR[i]}\\b`).test(text)) {
      const d = new Date(today);
      const diff = (d.getDay() - i + 7) % 7;
      d.setDate(d.getDate() - diff);
      return toDateStr(d);
    }
  }
  return null;
}

function parseSpokenEntry(raw) {
  const text = normalizeText(raw);

  // Inclut "et demie", "et quart", "moins le quart" dans le jeton pour que parseSpokenTime les voie.
  const timeRegex = /(\d{1,2}\s*(?:heures?|h|:)\s*(?:\d{1,2})?(?:\s*(?:et\s+demie?|et\s+quart|moins\s+(?:le\s+)?quart)\b)?|\b(?:midi|minuit)(?:\s+et\s+demie?)?\b)/g;
  const timeTokens = [];
  let m;
  while ((m = timeRegex.exec(text)) !== null) {
    const parsed = parseSpokenTime(m[0]);
    if (parsed) timeTokens.push(parsed);
  }
  if (timeTokens.length < 2) return null;

  const dateStr = parseSpokenDate(text) || getTodayStr();
  return { dateStr, start: timeTokens[0], end: timeTokens[1] };
}

export default function App() {
  const [tab, setTab] = useState("calendar");
  // Lecture directe au démarrage : un effet "charger" séparé laissait l'effet "sauvegarder" écrire [] par-dessus les données.
  const [sessions, setSessions] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
      return Array.isArray(saved) ? saved.filter(isValidSession) : [];
    } catch { return []; }
  });
  const [hourlyRate, setHourlyRate] = useState(() => { try { const s = localStorage.getItem("work_tracker_hourly_rate"); const r = parseFloat(s); return Number.isFinite(r) && r >= 0 ? r : 15; } catch { return 15; } });
  const [editingRate, setEditingRate] = useState(false);
  const [importMsg, setImportMsg] = useState(null);
  const importRef = useRef(null);

  const [theme, setTheme] = useState(() => {
    try { const t = localStorage.getItem(THEME_KEY); return THEMES[t] ? t : "dark"; } catch { return "dark"; }
  });
  const [voiceListening, setVoiceListening] = useState(false);
  const [voiceError, setVoiceError] = useState(null);
  const [voiceSuccess, setVoiceSuccess] = useState(null);
  const voiceSupported = typeof window !== "undefined" && !!(window.SpeechRecognition || window.webkitSpeechRecognition);

  const today = new Date();
  const [calYear, setCalYear] = useState(today.getFullYear());
  const [calMonth, setCalMonth] = useState(today.getMonth());
  const [selectedDate, setSelectedDate] = useState(getTodayStr());
  const [manualStart, setManualStart] = useState("08:00");
  const [manualEnd, setManualEnd] = useState("17:00");
  const [manualBreak, setManualBreak] = useState(60);
  const [manualSuccess, setManualSuccess] = useState(false);
  const [filterMonth, setFilterMonth] = useState(today.getMonth());
  const [filterYear, setFilterYear] = useState(today.getFullYear());

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
    } catch {}
  }, [sessions]);

  useEffect(() => {
    try {
      localStorage.setItem("work_tracker_hourly_rate", String(hourlyRate));
    } catch {}
  }, [hourlyRate]);

  useEffect(() => {
    try {
      localStorage.setItem(THEME_KEY, theme);
    } catch {}
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", THEMES[theme].bg);
  }, [theme]);

  const deleteSession = (id) => {
    if (!window.confirm("Supprimer cette session ?")) return;
    setSessions((prev) => prev.filter((s) => s.id !== id));
  };

  const handleManualAdd = () => {
    const span = spanSeconds(manualStart, manualEnd);
    if (span === null) return;
    const duration = span - (manualBreak || 0) * 60;
    if (duration <= 0) return;
    const [y, mo, d] = selectedDate.split("-").map(Number);
    const [sh, sm] = manualStart.split(":").map(Number);
    const [eh, em] = manualEnd.split(":").map(Number);
    const overnight = timeStrToSeconds(manualEnd) < timeStrToSeconds(manualStart);
    const startTs = new Date(y, mo - 1, d, sh, sm).getTime();
    const endTs = new Date(y, mo - 1, d + (overnight ? 1 : 0), eh, em).getTime();
    const newSession = { id: Date.now(), start: startTs, end: endTs, duration, breakMin: manualBreak || 0, type: "manual" };
    setSessions((prev) => [newSession, ...prev].sort((a, b) => b.start - a.start));
    setManualSuccess(true);
    setTimeout(() => setManualSuccess(false), 2000);
  };

  const startVoiceEntry = () => {
    if (!voiceSupported) {
      setVoiceError("Reconnaissance vocale non supportée par ce navigateur.");
      setTimeout(() => setVoiceError(null), 3000);
      return;
    }
    const SpeechRecognitionCtor = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognitionCtor();
    recognition.lang = "fr-FR";
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      const parsed = parseSpokenEntry(transcript);
      if (parsed) {
        setSelectedDate(parsed.dateStr);
        const [y, mo] = parsed.dateStr.split("-").map(Number);
        setCalYear(y);
        setCalMonth(mo - 1);
        setManualStart(parsed.start);
        setManualEnd(parsed.end);
        const yesterdayStr = toDateStr(new Date(Date.now() - 86400000));
        const dateLabel = parsed.dateStr === getTodayStr() ? "aujourd'hui"
          : parsed.dateStr === yesterdayStr ? "hier"
          : formatDate(parsed.dateStr + "T12:00:00");
        setVoiceSuccess(`✓ Compris : ${dateLabel}, ${parsed.start.replace(":", "h")} → ${parsed.end.replace(":", "h")}`);
        setTimeout(() => setVoiceSuccess(null), 4000);
      } else {
        setVoiceError(`Phrase non comprise : "${transcript}"`);
        setTimeout(() => setVoiceError(null), 3500);
      }
    };
    recognition.onerror = () => {
      setVoiceError("Erreur de reconnaissance vocale, réessaie.");
      setTimeout(() => setVoiceError(null), 3000);
    };
    recognition.onend = () => setVoiceListening(false);

    setVoiceError(null);
    setVoiceSuccess(null);
    setVoiceListening(true);
    recognition.start();
  };

  const weekStart = getWeekStart(new Date());
  const weekEnd = new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate() + 7);
  const weekSessions = sessions.filter((s) => s.start >= weekStart.getTime() && s.start < weekEnd.getTime());
  const weekSeconds = weekSessions.reduce((acc, s) => acc + (s.duration || 0), 0);
  const now = new Date();
  const monthSessions = sessions.filter((s) => { const d = new Date(s.start); return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear(); });
  const monthSeconds = monthSessions.reduce((acc, s) => acc + (s.duration || 0), 0);
  const sessionDays = new Set(sessions.map((s) => toDateStr(new Date(s.start))));
  const days = groupByDay(sessions);


  const handleExport = () => {
    const data = { sessions, hourlyRate, exportedAt: new Date().toISOString() };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "pointeuse-sauvegarde-" + new Date().toLocaleDateString("fr-FR").split("/").join("-") + ".json";
    a.click();
    // Révoquer tout de suite peut annuler le téléchargement (Safari iOS notamment).
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const handleImport = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target.result);
        if (!data || !Array.isArray(data.sessions) || !data.sessions.every(isValidSession)) throw new Error("invalid");
        const rate = Number(data.hourlyRate);
        if (!window.confirm(`Remplacer toutes tes données actuelles par ${data.sessions.length} session(s) de la sauvegarde ?`)) return;
        setSessions(data.sessions.map((s, i) => ({ ...s, id: s.id ?? s.start + i })));
        if (data.hourlyRate !== undefined && Number.isFinite(rate) && rate >= 0) setHourlyRate(rate);
        setImportMsg("✓ Données restaurées avec succès !");
        setTimeout(() => setImportMsg(null), 3000);
      } catch {
        setImportMsg("✗ Fichier invalide");
        setTimeout(() => setImportMsg(null), 3000);
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const daysInMonth = getDaysInMonth(calYear, calMonth);
  const firstDay = getFirstDayOfMonth(calYear, calMonth);

  const prevMonth = () => { if (calMonth === 0) { setCalMonth(11); setCalYear(y => y-1); } else setCalMonth(m=>m-1); };
  const nextMonth = () => { if (calMonth === 11) { setCalMonth(0); setCalYear(y => y+1); } else setCalMonth(m=>m+1); };

  const previewDuration = () => {
    const span = spanSeconds(manualStart, manualEnd);
    const dur = span === null ? 0 : span - (manualBreak||0)*60;
    if (dur <= 0) return "--";
    const overnight = timeStrToSeconds(manualEnd) < timeStrToSeconds(manualStart);
    return formatHM(dur) + (overnight ? " (+1j)" : "");
  };

  const renderVoiceButton = () => (
    <button
      type="button"
      onClick={startVoiceEntry}
      className={"tap" + (voiceListening ? " listening" : "")}
      aria-label="Dicter une entrée"
      title={voiceSupported ? "Dicter une entrée complète (ex: \"aujourd'hui de 8h15 à 16h49\")" : "Micro non supporté par ce navigateur"}
      style={{
        width:44, height:44, borderRadius:"50%", flexShrink:0, border:"none",
        display:"flex", alignItems:"center", justifyContent:"center",
        background: voiceListening ? "var(--danger)" : "var(--surface2)",
        color: voiceListening ? "#ffffff" : "var(--text)",
      }}
    ><Icon name="mic" /></button>
  );

  const card = { background:"var(--card)", border:"1px solid var(--border)", borderRadius:16, padding:18, marginBottom:14, boxShadow:"var(--shadow)" };
  const label = { fontSize:12, fontWeight:500, color:"var(--muted)", marginBottom:8 };
  const inputStyle = {
    background:"var(--surface2)", border:"1px solid transparent", borderRadius:10,
    padding:"12px 14px", color:"var(--text)", fontSize:16, width:"100%",
    colorScheme: theme === "dark" ? "dark" : "light",
  };
  const primaryBtn = {
    width:"100%", padding:15, border:"none", borderRadius:12, fontSize:15, fontWeight:600,
    background:"var(--text)", color:"var(--bg)", display:"flex", alignItems:"center", justifyContent:"center", gap:8,
  };
  const ghostBtn = { ...primaryBtn, background:"transparent", color:"var(--text)", border:"1px solid var(--border)" };
  const chip = (active) => ({
    padding:"8px 0", borderRadius:999, fontSize:13, fontWeight:500, border:"none",
    background: active ? "var(--text)" : "var(--surface2)",
    color: active ? "var(--bg)" : "var(--sub)",
  });
  const iconBtn = { width:40, height:40, border:"none", borderRadius:10, background:"transparent", color:"var(--sub)", display:"flex", alignItems:"center", justifyContent:"center" };
  const toast = (ok) => ({
    background: ok ? "var(--successBg)" : "var(--dangerBg)", color: ok ? "var(--accent)" : "var(--danger)",
    borderRadius:12, padding:"12px 14px", marginBottom:14, fontSize:13, fontWeight:500, textAlign:"center",
  });

  const renderSession = (s, i) => (
    <div key={s.id} className="item" style={{ ...card, animationDelay:`${Math.min(i, 8) * 30}ms`, padding:"12px 8px 12px 16px", marginBottom:8, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
      <div>
        <div className="num" style={{ fontSize:15, fontWeight:600 }}>
          {formatTime(s.start)} – {formatTime(s.end)}
          {s.type==="manual" && <span style={{ color:"var(--muted)", fontSize:11, fontWeight:500, marginLeft:8 }}>manuel</span>}
        </div>
        <div className="num" style={{ fontSize:13, color:"var(--muted)", marginTop:2 }}>
          {formatHM(s.duration)}{s.breakMin>0&&` · pause ${s.breakMin} min`}
        </div>
      </div>
      <div style={{ display:"flex", alignItems:"center", gap:4 }}>
        <span className="num" style={{ fontSize:15, fontWeight:600, color:"var(--accent)" }}>{((s.duration/3600)*hourlyRate).toFixed(2)} €</span>
        <button onClick={()=>deleteSession(s.id)} className="tap" aria-label="Supprimer la session" style={{ ...iconBtn, color:"var(--muted)" }}><Icon name="x" size={18} /></button>
      </div>
    </div>
  );

  const renderTotals = (hours, earned, n) => (
    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-end" }}>
      <div>
        <div className="num" style={{ fontSize:34, fontWeight:700, letterSpacing:-1, lineHeight:1.1 }}>{hours}<span style={{ fontSize:20, color:"var(--muted)", fontWeight:600 }}> h</span></div>
        <div style={{ fontSize:13, color:"var(--muted)", marginTop:4 }}>{n} session{n>1?"s":""}</div>
      </div>
      <div style={{ textAlign:"right" }}>
        <div className="num" style={{ fontSize:34, fontWeight:700, letterSpacing:-1, lineHeight:1.1, color:"var(--accent)" }}>{earned}<span style={{ fontSize:20, fontWeight:600 }}> €</span></div>
        <div style={{ fontSize:13, color:"var(--muted)", marginTop:4 }}>salaire estimé</div>
      </div>
    </div>
  );

  const TABS = [
    { id:"calendar", icon:"calendar", label:"Calendrier", title:"Saisie du temps" },
    { id:"stats", icon:"chart", label:"Stats", title:"Statistiques" },
    { id:"history", icon:"clock", label:"Historique", title:"Historique" },
    { id:"save", icon:"download", label:"Sauvegarde", title:"Sauvegarde" },
    { id:"settings", icon:"sliders", label:"Paramètres", title:"Paramètres" },
  ];
  const tabIndex = TABS.findIndex(t => t.id === tab);
  const v = THEMES[theme];

  return (
    <div style={{ minHeight:"100vh", color:"var(--text)", maxWidth:430, margin:"0 auto", display:"flex", flexDirection:"column" }}>

      {/* Header */}
      <header style={{ padding:"28px 20px 14px", background:"var(--navBg)", backdropFilter:"blur(14px)", WebkitBackdropFilter:"blur(14px)", position:"sticky", top:0, zIndex:10 }}>
        <div style={{ fontSize:12, fontWeight:600, letterSpacing:1.5, textTransform:"uppercase", color:"var(--accent)", marginBottom:2 }}>Pointeuse</div>
        <h1 key={tab} className="fade" style={{ fontSize:26, fontWeight:700, letterSpacing:-0.6, margin:0 }}>{TABS[tabIndex].title}</h1>
      </header>

      <main key={tab} className="view" style={{ flex:1, padding:"8px 20px 120px" }}>

        {/* ── CALENDRIER ── */}
        {tab==="calendar" && (<>
          {/* Taux horaire */}
          <div style={{ ...card, display:"flex", justifyContent:"space-between", alignItems:"center", gap:12 }}>
            {editingRate ? (
              <div style={{ display:"flex", gap:8, alignItems:"center", flex:1 }}>
                <input
                  type="number"
                  value={hourlyRate}
                  onChange={(e) => setHourlyRate(e.target.value)}
                  onBlur={(e) => setHourlyRate(parseFloat(parseFloat(e.target.value).toFixed(2)) || 0)}
                  step="0.01"
                  min="0"
                  aria-label="Taux horaire"
                  autoFocus
                  style={{...inputStyle, flex:1}}
                />
                <span style={{ color:"var(--muted)" }}>€/h</span>
                <button onClick={()=>setEditingRate(false)} className="tap" style={{ ...primaryBtn, width:"auto", padding:"12px 18px" }}>OK</button>
              </div>
            ) : (<>
              <div>
                <div style={{ ...label, marginBottom:2 }}>Taux horaire</div>
                <div className="num" style={{ fontSize:22, fontWeight:700 }}>{parseFloat(hourlyRate).toFixed(2)} <span style={{ fontSize:15, color:"var(--muted)", fontWeight:500 }}>€/h</span></div>
              </div>
              <button onClick={()=>setEditingRate(true)} className="tap" aria-label="Modifier le taux horaire" style={{ ...iconBtn, background:"var(--surface2)", color:"var(--text)" }}><Icon name="pencil" size={18} /></button>
            </>)}
          </div>

          {/* Mini Calendar */}
          <div style={card}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10 }}>
              <button onClick={prevMonth} className="tap" aria-label="Mois précédent" style={iconBtn}><Icon name="left" /></button>
              <span key={`${calYear}-${calMonth}`} className="fade" style={{ fontSize:15, fontWeight:600 }}>{MONTHS_FR[calMonth]} {calYear}</span>
              <button onClick={nextMonth} className="tap" aria-label="Mois suivant" style={iconBtn}><Icon name="right" /></button>
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"repeat(7,1fr)", gap:4, marginBottom:4 }}>
              {DAYS_FR.map((d,i)=><div key={i} style={{ textAlign:"center", fontSize:12, fontWeight:500, color:"var(--muted)", padding:"2px 0" }}>{d}</div>)}
            </div>
            <div key={`${calYear}-${calMonth}`} className="fade" style={{ display:"grid", gridTemplateColumns:"repeat(7,1fr)", gap:4 }}>
              {Array.from({length:firstDay}).map((_,i)=><div key={`e${i}`}/>)}
              {Array.from({length:daysInMonth}).map((_,i)=>{
                const day=i+1;
                const dateStr=`${calYear}-${String(calMonth+1).padStart(2,"0")}-${String(day).padStart(2,"0")}`;
                const isSelected=dateStr===selectedDate;
                const hasSession=sessionDays.has(dateStr);
                const isToday=dateStr===getTodayStr();
                return (
                  <button key={day} onClick={()=>setSelectedDate(dateStr)} className="tap num" aria-pressed={isSelected} style={{
                    aspectRatio:"1", border:"none", borderRadius:10, position:"relative", fontSize:14,
                    background:isSelected?"var(--text)":"transparent",
                    color:isSelected?"var(--bg)":isToday?"var(--accent)":"var(--text)",
                    fontWeight:(isSelected||isToday)?700:400,
                  }}>
                    {day}
                    {hasSession&&<span style={{ position:"absolute", bottom:5, left:"50%", transform:"translateX(-50%)", width:4, height:4, borderRadius:"50%", background:isSelected?"var(--bg)":"var(--accent)" }}/>}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Manual entry form */}
          <div style={card}>
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", gap:12, marginBottom:16 }}>
              <div>
                <div key={selectedDate} className="fade" style={{ fontSize:17, fontWeight:700, textTransform:"capitalize" }}>{formatDate(new Date(selectedDate+"T12:00:00"))}</div>
                <div style={{ fontSize:13, color:"var(--muted)", marginTop:2 }}>ou dis « aujourd'hui de 8h15 à 16h49 »</div>
              </div>
              {renderVoiceButton()}
            </div>

            {voiceSuccess && <div className="toast" style={toast(true)}>{voiceSuccess}</div>}
            {voiceError && <div className="toast" style={toast(false)}>{voiceError}</div>}

            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:14 }}>
              <label>
                <div style={label}>Début</div>
                <input type="time" value={manualStart} onChange={(e)=>setManualStart(e.target.value)} style={inputStyle} />
              </label>
              <label>
                <div style={label}>Fin</div>
                <input type="time" value={manualEnd} onChange={(e)=>setManualEnd(e.target.value)} style={inputStyle} />
              </label>
            </div>

            <label style={{ display:"block", marginBottom:16 }}>
              <div style={label}>Pause (minutes)</div>
              <input type="number" min={0} max={480} value={manualBreak} onChange={(e)=>setManualBreak(Math.max(0, Number(e.target.value) || 0))} style={inputStyle} placeholder="0" />
            </label>
            <div style={{ display:"grid", gridTemplateColumns:"repeat(5,1fr)", gap:6, marginTop:-8, marginBottom:16 }}>
              {[0,15,30,45,60].map(m=>(
                <button key={m} onClick={()=>setManualBreak(m)} className="tap num" style={chip(manualBreak===m)}>{m}</button>
              ))}
            </div>

            {/* Preview */}
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"baseline", padding:"4px 2px 16px" }}>
              <span style={{ fontSize:14, color:"var(--muted)" }}>Temps effectif</span>
              <span className="num" style={{ fontSize:24, fontWeight:700, letterSpacing:-0.5 }}>{previewDuration()}</span>
            </div>

            <button onClick={handleManualAdd} className="tap" style={{ ...primaryBtn, background:manualSuccess?"var(--accent)":"var(--text)", color:manualSuccess?"var(--accentInk)":"var(--bg)" }}>
              {manualSuccess ? <><Icon name="check" size={18} /> Enregistré</> : <><Icon name="plus" size={18} /> Enregistrer</>}
            </button>
          </div>

          {/* Sessions of selected day */}
          {(() => {
            const daySessions = sessions.filter(s => toDateStr(new Date(s.start))===selectedDate);
            if(daySessions.length===0) return <div style={{ textAlign:"center", color:"var(--muted)", fontSize:14, padding:"12px 0" }}>Aucune session ce jour</div>;
            return (
              <div>
                <div style={{ ...label, margin:"8px 2px 8px" }}>Sessions du jour</div>
                {daySessions.map(renderSession)}
              </div>
            );
          })()}
        </>)}

        {/* ── STATS ── */}
        {tab==="stats" && (<>
          {[
            { label:"Cette semaine", hours:(weekSeconds/3600).toFixed(1), earned:((weekSeconds/3600)*hourlyRate).toFixed(2), n:weekSessions.length },
            { label:"Ce mois", hours:(monthSeconds/3600).toFixed(1), earned:((monthSeconds/3600)*hourlyRate).toFixed(2), n:monthSessions.length },
          ].map((c,i)=>(
            <div key={i} style={{ ...card, padding:20 }}>
              <div style={{ ...label, marginBottom:12 }}>{c.label}</div>
              {renderTotals(c.hours, c.earned, c.n)}
            </div>
          ))}

          {/* TOTAL avec sélecteur mois/année */}
          {(() => {
            const filteredSessions = sessions.filter(s => {
              const d = new Date(s.start);
              return d.getMonth() === filterMonth && d.getFullYear() === filterYear;
            });
            const filteredSeconds = filteredSessions.reduce((acc,s) => acc + (s.duration||0), 0);
            return (
              <div style={{ ...card, padding:20 }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12 }}>
                  <div style={{ ...label, marginBottom:0 }}>Par période</div>
                  <div style={{ display:"flex", alignItems:"center", gap:2 }}>
                    <button onClick={()=>setFilterYear(y=>y-1)} className="tap" aria-label="Année précédente" style={{ ...iconBtn, width:32, height:32 }}><Icon name="left" size={18} /></button>
                    <span key={filterYear} className="fade num" style={{ fontSize:15, fontWeight:600, minWidth:44, textAlign:"center" }}>{filterYear}</span>
                    <button onClick={()=>setFilterYear(y=>y+1)} className="tap" aria-label="Année suivante" style={{ ...iconBtn, width:32, height:32 }}><Icon name="right" size={18} /></button>
                  </div>
                </div>

                <div style={{ display:"grid", gridTemplateColumns:"repeat(6,1fr)", gap:6, marginBottom:20 }}>
                  {MONTHS_FR.map((m,i) => (
                    <button key={i} onClick={()=>setFilterMonth(i)} className="tap" style={{ ...chip(filterMonth===i), fontSize:12 }}>{m.slice(0,3)}</button>
                  ))}
                </div>

                <div key={`${filterYear}-${filterMonth}`} className="fade">
                  {renderTotals((filteredSeconds/3600).toFixed(1), ((filteredSeconds/3600)*hourlyRate).toFixed(2), filteredSessions.length)}
                </div>
              </div>
            );
          })()}

          <div className="num" style={{ fontSize:13, color:"var(--muted)", textAlign:"center", marginTop:4 }}>Basé sur {parseFloat(hourlyRate).toFixed(2)} €/h</div>
        </>)}

        {/* ── HISTORIQUE ── */}
        {tab==="history" && (
          days.length===0 ? (
            <div style={{ textAlign:"center", color:"var(--muted)", padding:"48px 0", fontSize:14 }}>Aucune session enregistrée</div>
          ) : days.map((day,di)=>(
            <section key={di} style={{ marginBottom:22 }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"baseline", margin:"8px 2px 8px" }}>
                <div style={{ fontSize:14, fontWeight:600, textTransform:"capitalize" }}>{day.label}</div>
                <div className="num" style={{ fontSize:13, color:"var(--muted)" }}>{formatHM(day.total)} · <span style={{ color:"var(--accent)", fontWeight:600 }}>{((day.total/3600)*hourlyRate).toFixed(2)} €</span></div>
              </div>
              {day.sessions.map(renderSession)}
            </section>
          ))
        )}

        {/* ── SAUVEGARDE ── */}
        {tab==="save" && (<>
          {importMsg && <div className="toast" style={toast(importMsg.startsWith("✓"))}>{importMsg}</div>}

          <div style={{ ...card, padding:20 }}>
            <div style={{ fontSize:16, fontWeight:700, marginBottom:6 }}>Exporter</div>
            <div style={{ fontSize:14, color:"var(--sub)", marginBottom:16, lineHeight:1.55 }}>
              Télécharge un fichier avec toutes tes sessions et ton taux horaire. À faire avant de changer de téléphone ou réinstaller l'app.
            </div>
            <button onClick={handleExport} className="tap" style={primaryBtn}><Icon name="download" size={18} /> Télécharger la sauvegarde</button>
          </div>

          <div style={{ ...card, padding:20 }}>
            <div style={{ fontSize:16, fontWeight:700, marginBottom:6 }}>Importer</div>
            <div style={{ fontSize:14, color:"var(--sub)", marginBottom:16, lineHeight:1.55 }}>
              Restaure tes données depuis un fichier de sauvegarde. Attention, cela remplacera toutes les données actuelles.
            </div>
            <button onClick={()=>importRef.current.click()} className="tap" style={ghostBtn}><Icon name="upload" size={18} /> Restaurer une sauvegarde</button>
            <input ref={importRef} type="file" accept=".json" onChange={handleImport} style={{ display:"none" }} />
          </div>

          <div style={{ fontSize:13, color:"var(--muted)", lineHeight:1.7, padding:"4px 4px 0" }}>
            Tes données sont stockées sur ton téléphone et survivent aux mises à jour de l'app, mais elles sont perdues si tu la désinstalles. Exporte régulièrement pour ne rien perdre.
          </div>
        </>)}

        {/* ── PARAMÈTRES ── */}
        {tab==="settings" && (<>
          <div style={{ ...card, padding:20, display:"flex", justifyContent:"space-between", alignItems:"center", gap:12 }}>
            <div>
              <div style={{ fontSize:16, fontWeight:700, marginBottom:4 }}>{theme==="dark" ? "Thème sombre" : "Thème clair"}</div>
              <div style={{ fontSize:14, color:"var(--sub)" }}>Basculer entre clair et sombre</div>
            </div>
            <button
              onClick={()=>setTheme(t => t==="dark" ? "light" : "dark")}
              role="switch"
              aria-checked={theme==="light"}
              aria-label="Thème clair"
              style={{
                width:56, height:32, borderRadius:16, border:"none", cursor:"pointer", padding:0, flexShrink:0, position:"relative",
                background: theme==="dark" ? "var(--surface2)" : "var(--accent)", transition:"background-color .3s ease",
              }}
            >
              <span style={{
                position:"absolute", top:3, left:3, width:26, height:26, borderRadius:"50%",
                background: theme==="dark" ? "var(--text)" : "#ffffff", color: theme==="dark" ? "var(--bg)" : "var(--accent)",
                display:"flex", alignItems:"center", justifyContent:"center",
                transform:`translateX(${theme==="dark" ? 0 : 24}px)`, transition:"transform .3s cubic-bezier(.2,.8,.2,1)",
              }}><Icon name={theme==="dark" ? "moon" : "sun"} size={14} /></span>
            </button>
          </div>

          <div style={{ ...card, padding:20 }}>
            <div style={{ fontSize:16, fontWeight:700, marginBottom:6 }}>Commande vocale</div>
            <div style={{ fontSize:14, color:"var(--sub)", lineHeight:1.6 }}>
              Dans l'onglet Calendrier, utilise le bouton micro pour dicter une entrée complète en une phrase, ex. « aujourd'hui de 8h15 à 16h49 » ou « lundi 3 juin de 6h à 18h50 ».
            </div>
            <div style={{ ...toast(voiceSupported), textAlign:"left", margin:"14px 0 0", lineHeight:1.5 }}>
              {voiceSupported
                ? "Ton navigateur supporte la reconnaissance vocale. L'audio peut être traité par les serveurs de ton navigateur (Google, Apple) ; tes heures restent sur ton téléphone."
                : "Ton navigateur ne supporte pas la reconnaissance vocale."}
            </div>
          </div>
        </>)}
      </main>

      {/* Bottom Nav */}
      <nav style={{ position:"fixed", bottom:0, left:"50%", transform:"translateX(-50%)", width:"100%", maxWidth:430, background:"var(--navBg)", backdropFilter:"blur(14px)", WebkitBackdropFilter:"blur(14px)", borderTop:"1px solid var(--border)", padding:"8px 8px max(16px, env(safe-area-inset-bottom))", zIndex:10 }}>
        <div style={{ position:"relative", display:"flex" }}>
          {/* Pastille qui glisse sous l'onglet actif */}
          <div aria-hidden="true" style={{ position:"absolute", top:0, bottom:0, left:0, width:`${100/TABS.length}%`, transform:`translateX(${tabIndex*100}%)`, transition:"transform .35s cubic-bezier(.2,.8,.2,1)", padding:"0 6px" }}>
            <div style={{ height:"100%", borderRadius:14, background:"var(--surface2)" }} />
          </div>
          {TABS.map(t=>(
            <button key={t.id} onClick={()=>setTab(t.id)} className="tap" aria-current={tab===t.id ? "page" : undefined} style={{ flex:1, position:"relative", background:"transparent", border:"none", display:"flex", flexDirection:"column", alignItems:"center", gap:4, padding:"8px 0", color:tab===t.id?"var(--text)":"var(--muted)" }}>
              <Icon name={t.icon} size={22} />
              <span style={{ fontSize:11, fontWeight:tab===t.id?600:500 }}>{t.label}</span>
            </button>
          ))}
        </div>
      </nav>

      <style>{`
        :root {
          --bg:${v.bg}; --card:${v.card}; --navBg:${v.navBg}; --text:${v.text};
          --sub:${v.sub}; --muted:${v.muted}; --border:${v.border}; --surface2:${v.surface2};
          --accent:${v.accent}; --accentInk:${v.accentInk}; --danger:${v.danger};
          --successBg:${v.successBg}; --dangerBg:${v.dangerBg}; --shadow:${v.shadow};
          --scrollThumb:${v.scrollThumb};
        }
        * { box-sizing:border-box; }
        html, body, #root { background:var(--bg); transition:background-color .3s ease; }
        body { font-family:'Plus Jakarta Sans', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif; -webkit-font-smoothing:antialiased; -webkit-tap-highlight-color:transparent; }
        button, input { font-family:inherit; }
        .num { font-variant-numeric:tabular-nums; }
        .tap { cursor:pointer; transition:transform .15s ease, background-color .25s ease, color .25s ease, opacity .2s ease; }
        .tap:active { transform:scale(.96); }
        @media (hover:hover) { .tap:hover { opacity:.85; } }
        :focus-visible { outline:2px solid var(--accent); outline-offset:2px; }
        input { transition:border-color .2s ease; }
        input:focus { outline:none; border-color:var(--accent) !important; }
        input[type="time"]::-webkit-calendar-picker-indicator { filter:invert(0.5); }

        /* Animations : volontairement courtes et discrètes. */
        @keyframes rise { from { opacity:0; transform:translateY(10px); } }
        @keyframes fade { from { opacity:0; } }
        @keyframes toastIn { from { opacity:0; transform:translateY(-6px) scale(.98); } }
        @keyframes ring { from { box-shadow:0 0 0 0 rgba(248,113,113,.5); } to { box-shadow:0 0 0 14px rgba(248,113,113,0); } }
        .view > * { animation:rise .42s cubic-bezier(.2,.8,.2,1) both; }
        .view > *:nth-child(2) { animation-delay:.05s; }
        .view > *:nth-child(3) { animation-delay:.1s; }
        .view > *:nth-child(4) { animation-delay:.15s; }
        .view > *:nth-child(n+5) { animation-delay:.2s; }
        .item { animation:rise .35s cubic-bezier(.2,.8,.2,1) both; }
        .fade { animation:fade .3s ease both; }
        .toast { animation:toastIn .3s cubic-bezier(.2,.8,.2,1) both; }
        .listening { animation:ring 1.2s ease-out infinite; }

        ::-webkit-scrollbar{width:4px}
        ::-webkit-scrollbar-track{background:var(--bg)}
        ::-webkit-scrollbar-thumb{background:var(--scrollThumb);border-radius:2px}
      `}</style>
    </div>
  );
}
