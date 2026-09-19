import { useState, useEffect, useRef } from "react";

const STORAGE_KEY = "work_tracker_sessions_v2";
const THEME_KEY = "work_tracker_theme";

const THEMES = {
  dark: {
    bg: "#0a0a0a", card: "#111111", navBg: "#0d0d0d", text: "#f0e8d8",
    muted: "#666666", muted2: "#555555", muted3: "#444444", muted4: "#333333", muted5: "#888888", muted6: "#cccccc",
    border: "#2a2a2a", borderSoft: "#1e1e1e", surface2: "#1a1a1a",
    accent: "#4ade80", danger: "#e05555", successBg: "#0d2b0d", dangerBg: "#2b0d0d",
    scrollThumb: "#222222",
  },
  light: {
    bg: "#f5f5f0", card: "#ffffff", navBg: "#ffffff", text: "#1a1a1a",
    muted: "#6b6960", muted2: "#7d7b72", muted3: "#9a988f", muted4: "#c4c2b8", muted5: "#55534c", muted6: "#333333",
    border: "#dedad0", borderSoft: "#ecebe4", surface2: "#eeece4",
    accent: "#16a34a", danger: "#dc2626", successBg: "#e6f7ea", dangerBg: "#fceaea",
    scrollThumb: "#ddd9cc",
  },
};

function formatDuration(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
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
  return null;
}

export default function App() {
  const [tab, setTab] = useState("calendar");
  const [running, setRunning] = useState(false);
  const [startTime, setStartTime] = useState(null);
  const [elapsed, setElapsed] = useState(0);
  const [sessions, setSessions] = useState([]);
  const [hourlyRate, setHourlyRate] = useState(() => { try { const s = localStorage.getItem("work_tracker_hourly_rate"); return s ? parseFloat(s) : 15; } catch { return 15; } });
  const [editingRate, setEditingRate] = useState(false);
  const [importMsg, setImportMsg] = useState(null);
  const importRef = useRef(null);
  const intervalRef = useRef(null);

  const [theme, setTheme] = useState(() => {
    try { return localStorage.getItem(THEME_KEY) || "dark"; } catch { return "dark"; }
  });
  const [listeningField, setListeningField] = useState(null);
  const [voiceError, setVoiceError] = useState(null);
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
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) setSessions(JSON.parse(saved));
    } catch {}
  }, []);

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
  }, [theme]);

  useEffect(() => {
    if (running) {
      intervalRef.current = setInterval(() => {
        setElapsed(Math.floor((Date.now() - startTime) / 1000));
      }, 1000);
    } else {
      clearInterval(intervalRef.current);
    }
    return () => clearInterval(intervalRef.current);
  }, [running, startTime]);

  const handleStart = () => {
    setStartTime(Date.now());
    setElapsed(0);
    setRunning(true);
  };

  const handleStop = () => {
    setRunning(false);
    const newSession = { id: Date.now(), start: startTime, end: Date.now(), duration: elapsed, type: "timer" };
    setSessions((prev) => [newSession, ...prev]);
    setElapsed(0);
  };

  const deleteSession = (id) => setSessions((prev) => prev.filter((s) => s.id !== id));

  const handleManualAdd = () => {
    const startSec = timeStrToSeconds(manualStart);
    const endSec = timeStrToSeconds(manualEnd);
    if (endSec <= startSec) return;
    const duration = Math.max(0, endSec - startSec - (manualBreak || 0) * 60);
    const [y, mo, d] = selectedDate.split("-").map(Number);
    const [sh, sm] = manualStart.split(":").map(Number);
    const [eh, em] = manualEnd.split(":").map(Number);
    const startTs = new Date(y, mo - 1, d, sh, sm).getTime();
    const endTs = new Date(y, mo - 1, d, eh, em).getTime();
    const newSession = { id: Date.now(), start: startTs, end: endTs, duration, breakMin: manualBreak || 0, type: "manual" };
    setSessions((prev) => [newSession, ...prev].sort((a, b) => b.start - a.start));
    setManualSuccess(true);
    setTimeout(() => setManualSuccess(false), 2000);
  };

  const startVoiceInput = (field) => {
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
      if (field === "date") {
        const dateStr = parseSpokenDate(transcript);
        if (dateStr) {
          setSelectedDate(dateStr);
          const [y, m] = dateStr.split("-").map(Number);
          setCalYear(y);
          setCalMonth(m - 1);
        } else {
          setVoiceError(`Date non reconnue : "${transcript}"`);
          setTimeout(() => setVoiceError(null), 3000);
        }
      } else {
        const timeStr = parseSpokenTime(transcript);
        if (timeStr) {
          if (field === "start") setManualStart(timeStr);
          else setManualEnd(timeStr);
        } else {
          setVoiceError(`Heure non reconnue : "${transcript}"`);
          setTimeout(() => setVoiceError(null), 3000);
        }
      }
    };
    recognition.onerror = () => {
      setVoiceError("Erreur de reconnaissance vocale, réessaie.");
      setTimeout(() => setVoiceError(null), 3000);
    };
    recognition.onend = () => setListeningField(null);

    setVoiceError(null);
    setListeningField(field);
    recognition.start();
  };

  const renderMicButton = (field, size = 40) => (
    <button
      type="button"
      onClick={() => startVoiceInput(field)}
      title={voiceSupported ? "Dicter au micro" : "Micro non supporté par ce navigateur"}
      style={{
        width: size, height: size, borderRadius: 4, flexShrink: 0, cursor: "pointer",
        border: "1px solid var(--border)",
        background: listeningField === field ? "var(--danger)" : "var(--surface-2)",
        color: listeningField === field ? "#ffffff" : "var(--text)",
        fontSize: size >= 40 ? 16 : 14,
        animation: listeningField === field ? "pulse 1s infinite" : "none",
      }}
    >🎤</button>
  );

  const totalSeconds = sessions.reduce((acc, s) => acc + (s.duration || 0), 0);
  const weekSessions = sessions.filter((s) => (Date.now() - s.start) / 86400000 <= 7);
  const weekSeconds = weekSessions.reduce((acc, s) => acc + (s.duration || 0), 0);
  const now = new Date();
  const monthSessions = sessions.filter((s) => { const d = new Date(s.start); return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear(); });
  const monthSeconds = monthSessions.reduce((acc, s) => acc + (s.duration || 0), 0);
  const sessionDays = new Set(sessions.map((s) => new Date(s.start).toISOString().slice(0, 10)));
  const days = groupByDay(sessions);


  const handleExport = () => {
    const data = { sessions, hourlyRate, exportedAt: new Date().toISOString() };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "pointeuse-sauvegarde-" + new Date().toLocaleDateString("fr-FR").split("/").join("-") + ".json";
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target.result);
        if (data.sessions) setSessions(data.sessions);
        if (data.hourlyRate) setHourlyRate(data.hourlyRate);
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
    const dur = Math.max(0, timeStrToSeconds(manualEnd) - timeStrToSeconds(manualStart) - (manualBreak||0)*60);
    return dur > 0 ? formatHM(dur) : "--";
  };

  const inputStyle = {
    background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 4,
    padding: "10px 12px", color: "var(--text)", fontSize: 15,
    fontFamily: "'Courier New', monospace", width: "100%",
  };

  const v = THEMES[theme];

  return (
    <div style={{ fontFamily:"'Courier New',monospace", background:"var(--bg)", minHeight:"100vh", color:"var(--text)", maxWidth:430, margin:"0 auto", display:"flex", flexDirection:"column" }}>

      {/* Header */}
      <div style={{ padding:"32px 24px 16px", borderBottom:"1px solid var(--border)", background:"var(--bg)", position:"sticky", top:0, zIndex:10 }}>
        <div style={{ fontSize:11, letterSpacing:4, color:"var(--muted)", marginBottom:4 }}>POINTEUSE</div>
        <div style={{ fontSize:26, fontWeight:"bold", letterSpacing:-1, color:"var(--text)" }}>Temps de Travail</div>
      </div>

      <div style={{ flex:1, overflowY:"auto", paddingBottom:100 }}>

        {/* ── TIMER ── */}
        {tab==="timer" && (
          <div style={{ padding:24 }}>

            {/* Recap entrée / sortie + heures du jour */}
            {(() => {
              const todayStr = getTodayStr();
              const todaySessions = sessions.filter(s => new Date(s.start).toISOString().slice(0,10) === todayStr);
              const todaySeconds = todaySessions.reduce((acc,s) => acc + (s.duration||0), 0);
              const lastSession = todaySessions[0] || null;
              return (
                <div style={{ background:"var(--card)", border:"1px solid var(--border)", borderRadius:4, padding:20, marginBottom:16 }}>
                  <div style={{ fontSize:10, letterSpacing:3, color:"var(--muted)", marginBottom:16 }}>RÉCAPITULATIF DU JOUR</div>
                  <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:12 }}>
                    <div style={{ background:"var(--bg)", borderRadius:4, padding:"14px 16px" }}>
                      <div style={{ fontSize:10, letterSpacing:2, color:"var(--muted2)", marginBottom:6 }}>ENTRÉE</div>
                      <div style={{ fontSize:26, fontWeight:"bold", color: lastSession ? "var(--text)" : "var(--muted4)", fontVariantNumeric:"tabular-nums" }}>
                        {lastSession ? formatTime(lastSession.start) : "--:--"}
                      </div>
                    </div>
                    <div style={{ background:"var(--bg)", borderRadius:4, padding:"14px 16px" }}>
                      <div style={{ fontSize:10, letterSpacing:2, color:"var(--muted2)", marginBottom:6 }}>SORTIE</div>
                      <div style={{ fontSize:26, fontWeight:"bold", color: lastSession ? "var(--text)" : "var(--muted4)", fontVariantNumeric:"tabular-nums" }}>
                        {lastSession ? formatTime(lastSession.end) : "--:--"}
                      </div>
                    </div>
                  </div>
                  <div style={{ background:"var(--bg)", borderRadius:4, padding:"12px 16px", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                    <span style={{ fontSize:11, color:"var(--muted2)" }}>Heures travaillées aujourd'hui</span>
                    <span style={{ fontSize:20, fontWeight:"bold", color: todaySeconds > 0 ? "var(--accent)" : "var(--muted4)" }}>
                      {todaySeconds > 0 ? formatHM(todaySeconds) : "--"}
                    </span>
                  </div>
                  {todaySessions.length > 1 && (
                    <div style={{ marginTop:6, fontSize:10, color:"var(--muted3)", textAlign:"right" }}>
                      {todaySessions.length} sessions aujourd'hui
                    </div>
                  )}
                </div>
              );
            })()}

          </div>
        )}

        {/* ── CALENDRIER ── */}
        {tab==="calendar" && (
          <div style={{ padding:24 }}>
            <div style={{ fontSize:10, letterSpacing:3, color:"var(--muted)", marginBottom:16 }}>SAISIE MANUELLE</div>

            {/* Taux horaire */}
            <div style={{ background:"var(--card)", border:"1px solid var(--border)", borderRadius:4, padding:16, marginBottom:20 }}>
              <div style={{ fontSize:10, letterSpacing:3, color:"var(--muted)", marginBottom:12 }}>TAUX HORAIRE</div>
              {editingRate ? (
                <div style={{ display:"flex", gap:8, alignItems:"center" }}>
                  <input
                    type="number"
                    value={hourlyRate}
                    onChange={(e) => setHourlyRate(e.target.value)}
                    onBlur={(e) => setHourlyRate(parseFloat(parseFloat(e.target.value).toFixed(2)) || 0)}
                    step="0.01"
                    min="0"
                    style={{...inputStyle, flex:1}}
                  />
                  <span style={{ color:"var(--muted)" }}>€/h</span>
                  <button onClick={()=>setEditingRate(false)} style={{ background:"var(--text)", color:"var(--bg)", border:"none", borderRadius:4, padding:"8px 16px", cursor:"pointer", fontFamily:"'Courier New',monospace", fontWeight:"bold" }}>OK</button>
                </div>
              ) : (
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                  <span style={{ fontSize:24, fontWeight:"bold" }}>{parseFloat(hourlyRate).toFixed(2)} €/h</span>
                  <button onClick={()=>setEditingRate(true)} style={{ background:"transparent", color:"var(--muted)", border:"1px solid var(--muted4)", borderRadius:4, padding:"6px 12px", cursor:"pointer", fontFamily:"'Courier New',monospace", fontSize:11, letterSpacing:2 }}>MODIFIER</button>
                </div>
              )}
            </div>

            {/* Mini Calendar */}
            <div style={{ background:"var(--card)", border:"1px solid var(--border)", borderRadius:4, padding:16, marginBottom:20 }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
                <button onClick={prevMonth} style={{ background:"none", border:"none", color:"var(--muted5)", fontSize:20, cursor:"pointer", padding:"0 4px" }}>‹</button>
                <span style={{ fontSize:13, letterSpacing:1, color:"var(--muted6)" }}>{MONTHS_FR[calMonth]} {calYear}</span>
                <button onClick={nextMonth} style={{ background:"none", border:"none", color:"var(--muted5)", fontSize:20, cursor:"pointer", padding:"0 4px" }}>›</button>
              </div>
              <div style={{ display:"grid", gridTemplateColumns:"repeat(7,1fr)", gap:2, marginBottom:4 }}>
                {DAYS_FR.map((d,i)=><div key={i} style={{ textAlign:"center", fontSize:10, color:"var(--muted2)", padding:"2px 0" }}>{d}</div>)}
              </div>
              <div style={{ display:"grid", gridTemplateColumns:"repeat(7,1fr)", gap:2 }}>
                {Array.from({length:firstDay}).map((_,i)=><div key={`e${i}`}/>)}
                {Array.from({length:daysInMonth}).map((_,i)=>{
                  const day=i+1;
                  const dateStr=`${calYear}-${String(calMonth+1).padStart(2,"0")}-${String(day).padStart(2,"0")}`;
                  const isSelected=dateStr===selectedDate;
                  const hasSession=sessionDays.has(dateStr);
                  const isToday=dateStr===getTodayStr();
                  return (
                    <button key={day} onClick={()=>setSelectedDate(dateStr)} style={{
                      aspectRatio:"1", border:"none", borderRadius:4, cursor:"pointer",
                      fontSize:12, fontFamily:"'Courier New',monospace", position:"relative",
                      background:isSelected?"var(--text)":isToday?"var(--borderSoft)":"transparent",
                      color:isSelected?"var(--bg)":isToday?"var(--text)":"var(--muted5)",
                      fontWeight:(isSelected||isToday)?"bold":"normal",
                      outline:(isToday&&!isSelected)?"1px solid var(--muted4)":"none",
                    }}>
                      {day}
                      {hasSession&&!isSelected&&<div style={{ position:"absolute", bottom:2, left:"50%", transform:"translateX(-50%)", width:4, height:4, borderRadius:"50%", background:"var(--accent)" }}/>}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Selected date */}
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", gap:8, marginBottom:16 }}>
              <div style={{ fontSize:11, color:"var(--muted5)", textTransform:"capitalize" }}>
                📅 {formatDate(new Date(selectedDate+"T12:00:00"))}
              </div>
              {renderMicButton("date", 32)}
            </div>

            {voiceError && (
              <div style={{ background:"var(--dangerBg)", border:"1px solid var(--danger)", color:"var(--danger)", borderRadius:4, padding:"10px 14px", marginBottom:16, fontSize:12, textAlign:"center" }}>
                🎤 {voiceError}
              </div>
            )}

            {/* Manual entry form */}
            <div style={{ background:"var(--card)", border:"1px solid var(--border)", borderRadius:4, padding:16, marginBottom:16 }}>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:14 }}>
                <div>
                  <div style={{ fontSize:10, letterSpacing:2, color:"var(--muted)", marginBottom:6 }}>DÉBUT</div>
                  <div style={{ display:"flex", gap:6 }}>
                    <input type="time" value={manualStart} onChange={(e)=>setManualStart(e.target.value)} style={{...inputStyle,colorScheme: theme==="dark" ? "dark" : "light"}} />
                    {renderMicButton("start")}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize:10, letterSpacing:2, color:"var(--muted)", marginBottom:6 }}>FIN</div>
                  <div style={{ display:"flex", gap:6 }}>
                    <input type="time" value={manualEnd} onChange={(e)=>setManualEnd(e.target.value)} style={{...inputStyle,colorScheme: theme==="dark" ? "dark" : "light"}} />
                    {renderMicButton("end")}
                  </div>
                </div>
              </div>

              <div style={{ marginBottom:16 }}>
                <div style={{ fontSize:10, letterSpacing:2, color:"var(--muted)", marginBottom:6 }}>PAUSE (minutes)</div>
                <input type="number" min={0} max={480} value={manualBreak} onChange={(e)=>setManualBreak(Number(e.target.value))} style={inputStyle} placeholder="0" />
                <div style={{ display:"flex", gap:6, marginTop:8 }}>
                  {[0,15,30,45,60].map(m=>(
                    <button key={m} onClick={()=>setManualBreak(m)} style={{
                      flex:1, padding:"6px 0", fontSize:11,
                      background:manualBreak===m?"var(--text)":"var(--surface2)",
                      color:manualBreak===m?"var(--bg)":"var(--muted)",
                      border:"1px solid var(--border)", borderRadius:4, cursor:"pointer",
                      fontFamily:"'Courier New',monospace",
                    }}>{m}m</button>
                  ))}
                </div>
              </div>

              {/* Preview */}
              <div style={{ background:"var(--bg)", borderRadius:4, padding:"10px 14px", display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
                <span style={{ fontSize:11, color:"var(--muted2)" }}>Temps effectif</span>
                <span style={{ fontSize:20, fontWeight:"bold", color:"var(--text)" }}>{previewDuration()}</span>
              </div>

              <button onClick={handleManualAdd} style={{
                width:"100%", padding:"14px", border:"none", borderRadius:4,
                fontSize:13, fontFamily:"'Courier New',monospace", letterSpacing:2,
                fontWeight:"bold", cursor:"pointer",
                background:manualSuccess?"var(--accent)":"var(--text)",
                color:"var(--bg)", transition:"background 0.3s",
              }}>
                {manualSuccess ? "✓ ENREGISTRÉ !" : "＋ ENREGISTRER"}
              </button>
            </div>

            {/* Sessions of selected day */}
            {(() => {
              const daySessions = sessions.filter(s => new Date(s.start).toISOString().slice(0,10)===selectedDate);
              if(daySessions.length===0) return <div style={{ textAlign:"center", color:"var(--muted4)", fontSize:12, padding:"16px 0" }}>Aucune session ce jour</div>;
              return (
                <div>
                  <div style={{ fontSize:10, letterSpacing:2, color:"var(--muted2)", marginBottom:8 }}>SESSIONS DU JOUR</div>
                  {daySessions.map(s=>(
                    <div key={s.id} style={{ background:"var(--card)", border:"1px solid var(--borderSoft)", borderRadius:4, padding:"10px 14px", marginBottom:6, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                      <div>
                        <div style={{ fontSize:13, color:"var(--muted6)" }}>
                          {formatTime(s.start)} → {formatTime(s.end)}
                          {s.type==="manual" && <span style={{ color:"var(--muted2)", fontSize:10, marginLeft:6 }}>manuel</span>}
                        </div>
                        <div style={{ fontSize:11, color:"var(--muted2)", marginTop:2 }}>
                          {formatHM(s.duration)}{s.breakMin>0&&` · pause ${s.breakMin}min`}
                        </div>
                      </div>
                      <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                        <span style={{ fontSize:13, color:"var(--accent)" }}>{((s.duration/3600)*hourlyRate).toFixed(2)}€</span>
                        <button onClick={()=>deleteSession(s.id)} style={{ background:"transparent", border:"none", color:"var(--muted3)", cursor:"pointer", fontSize:16, padding:4 }}>✕</button>
                      </div>
                    </div>
                  ))}
                </div>
              );
            })()}
          </div>
        )}

        {/* ── STATS ── */}
        {tab==="stats" && (
          <div style={{ padding:24 }}>
            <div style={{ fontSize:10, letterSpacing:3, color:"var(--muted)", marginBottom:16 }}>STATISTIQUES</div>

            {/* Cette semaine */}
            {[
              { label:"CETTE SEMAINE", hours:(weekSeconds/3600).toFixed(1), earned:((weekSeconds/3600)*hourlyRate).toFixed(2), n:weekSessions.length },
              { label:"CE MOIS", hours:(monthSeconds/3600).toFixed(1), earned:((monthSeconds/3600)*hourlyRate).toFixed(2), n:monthSessions.length },
            ].map((card,i)=>(
              <div key={i} style={{ background:"var(--card)", border:"1px solid var(--border)", borderRadius:4, padding:20, marginBottom:12 }}>
                <div style={{ fontSize:10, letterSpacing:3, color:"var(--muted)", marginBottom:12 }}>{card.label}</div>
                <div style={{ display:"flex", justifyContent:"space-between" }}>
                  <div>
                    <div style={{ fontSize:32, fontWeight:"bold", color:"var(--text)" }}>{card.hours}h</div>
                    <div style={{ fontSize:11, color:"var(--muted2)", marginTop:2 }}>{card.n} session(s)</div>
                  </div>
                  <div style={{ textAlign:"right" }}>
                    <div style={{ fontSize:32, fontWeight:"bold", color:"var(--accent)" }}>{card.earned}€</div>
                    <div style={{ fontSize:11, color:"var(--muted2)", marginTop:2 }}>salaire estimé</div>
                  </div>
                </div>
              </div>
            ))}

            {/* TOTAL avec sélecteur mois/année */}
            {(() => {
              const filteredSessions = sessions.filter(s => {
                const d = new Date(s.start);
                return d.getMonth() === filterMonth && d.getFullYear() === filterYear;
              });
              const filteredSeconds = filteredSessions.reduce((acc,s) => acc + (s.duration||0), 0);
              const availableYears = [...new Set(sessions.map(s => new Date(s.start).getFullYear()))].sort((a,b)=>b-a);
              if (!availableYears.includes(filterYear) && availableYears.length > 0) availableYears.push(filterYear);
              return (
                <div style={{ background:"var(--card)", border:"1px solid var(--border)", borderRadius:4, padding:20, marginBottom:12 }}>
                  <div style={{ fontSize:10, letterSpacing:3, color:"var(--muted)", marginBottom:12 }}>TOTAL PAR PÉRIODE</div>

                  {/* Sélecteur mois */}
                  <div style={{ marginBottom:10 }}>
                    <div style={{ fontSize:10, letterSpacing:2, color:"var(--muted2)", marginBottom:6 }}>MOIS</div>
                    <div style={{ display:"flex", gap:4, flexWrap:"wrap" }}>
                      {MONTHS_FR.map((m,i) => (
                        <button key={i} onClick={()=>setFilterMonth(i)} style={{
                          padding:"4px 8px", fontSize:10, borderRadius:4, cursor:"pointer", border:"none",
                          fontFamily:"'Courier New',monospace",
                          background: filterMonth===i ? "var(--text)" : "var(--surface2)",
                          color: filterMonth===i ? "var(--bg)" : "var(--muted)",
                        }}>{m.slice(0,3)}</button>
                      ))}
                    </div>
                  </div>

                  {/* Sélecteur année */}
                  <div style={{ marginBottom:16 }}>
                    <div style={{ fontSize:10, letterSpacing:2, color:"var(--muted2)", marginBottom:6 }}>ANNÉE</div>
                    <div style={{ display:"flex", gap:6 }}>
                      <button onClick={()=>setFilterYear(y=>y-1)} style={{ background:"var(--surface2)", border:"none", color:"var(--muted5)", fontSize:16, cursor:"pointer", borderRadius:4, padding:"4px 10px" }}>‹</button>
                      <div style={{ flex:1, background:"var(--bg)", borderRadius:4, display:"flex", alignItems:"center", justifyContent:"center", fontSize:16, fontWeight:"bold", color:"var(--text)" }}>{filterYear}</div>
                      <button onClick={()=>setFilterYear(y=>y+1)} style={{ background:"var(--surface2)", border:"none", color:"var(--muted5)", fontSize:16, cursor:"pointer", borderRadius:4, padding:"4px 10px" }}>›</button>
                    </div>
                  </div>

                  {/* Résultat */}
                  <div style={{ display:"flex", justifyContent:"space-between" }}>
                    <div>
                      <div style={{ fontSize:32, fontWeight:"bold", color:"var(--text)" }}>{(filteredSeconds/3600).toFixed(1)}h</div>
                      <div style={{ fontSize:11, color:"var(--muted2)", marginTop:2 }}>{filteredSessions.length} session(s)</div>
                    </div>
                    <div style={{ textAlign:"right" }}>
                      <div style={{ fontSize:32, fontWeight:"bold", color:"var(--accent)" }}>{((filteredSeconds/3600)*hourlyRate).toFixed(2)}€</div>
                      <div style={{ fontSize:11, color:"var(--muted2)", marginTop:2 }}>salaire estimé</div>
                    </div>
                  </div>
                </div>
              );
            })()}

            <div style={{ fontSize:11, color:"var(--muted3)", textAlign:"center", marginTop:8 }}>Basé sur {parseFloat(hourlyRate).toFixed(2)}€/h</div>
          </div>
        )}

        {/* ── HISTORIQUE ── */}
        {tab==="history" && (
          <div style={{ padding:24 }}>
            <div style={{ fontSize:10, letterSpacing:3, color:"var(--muted)", marginBottom:16 }}>HISTORIQUE</div>
            {days.length===0 ? (
              <div style={{ textAlign:"center", color:"var(--muted3)", padding:"40px 0", fontSize:13 }}>Aucune session enregistrée</div>
            ) : days.map((day,di)=>(
              <div key={di} style={{ marginBottom:24 }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8 }}>
                  <div style={{ fontSize:11, color:"var(--muted5)", textTransform:"capitalize" }}>{day.label}</div>
                  <div style={{ fontSize:11, color:"var(--accent)" }}>{formatHM(day.total)} · {((day.total/3600)*hourlyRate).toFixed(2)}€</div>
                </div>
                {day.sessions.map(s=>(
                  <div key={s.id} style={{ background:"var(--card)", border:"1px solid var(--borderSoft)", borderRadius:4, padding:"12px 16px", marginBottom:6, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                    <div>
                      <div style={{ fontSize:13, color:"var(--muted6)" }}>
                        {formatTime(s.start)} → {formatTime(s.end)}
                        {s.type==="manual"&&<span style={{ color:"var(--muted2)", fontSize:10, marginLeft:6 }}>manuel</span>}
                      </div>
                      <div style={{ fontSize:11, color:"var(--muted2)", marginTop:2 }}>{formatHM(s.duration)}{s.breakMin>0&&` · pause ${s.breakMin}min`}</div>
                    </div>
                    <div style={{ display:"flex", alignItems:"center", gap:12 }}>
                      <div style={{ fontSize:13, color:"var(--accent)" }}>{((s.duration/3600)*hourlyRate).toFixed(2)}€</div>
                      <button onClick={()=>deleteSession(s.id)} style={{ background:"transparent", border:"none", color:"var(--muted3)", cursor:"pointer", fontSize:16, padding:4 }}>✕</button>
                    </div>
                  </div>
                ))}
              </div>
            ))}


          </div>
        )}
      </div>

        {/* ── SAUVEGARDE ── */}
        {tab==="save" && (
          <div style={{ padding:24 }}>
            <div style={{ fontSize:12, letterSpacing:3, color:"var(--muted)", marginBottom:24 }}>SAUVEGARDE DES DONNÉES</div>

            <div style={{ background:"var(--card)", border:"1px solid var(--border)", borderRadius:4, padding:20, marginBottom:16 }}>
              <div style={{ fontSize:12, letterSpacing:2, color:"var(--muted5)", marginBottom:8 }}>EXPORTER</div>
              <div style={{ fontSize:13, color:"var(--muted2)", marginBottom:16, lineHeight:1.6 }}>
                Télécharge un fichier avec toutes tes sessions et ton taux horaire. À faire avant de changer de téléphone ou réinstaller l'app.
              </div>
              <button onClick={handleExport} style={{
                width:"100%", padding:"16px", border:"none", borderRadius:4, cursor:"pointer",
                background:"var(--text)", color:"var(--bg)", fontFamily:"'Courier New',monospace",
                fontSize:13, letterSpacing:2, fontWeight:"bold",
              }}>💾 TÉLÉCHARGER LA SAUVEGARDE</button>
            </div>

            <div style={{ background:"var(--card)", border:"1px solid var(--border)", borderRadius:4, padding:20, marginBottom:16 }}>
              <div style={{ fontSize:12, letterSpacing:2, color:"var(--muted5)", marginBottom:8 }}>IMPORTER</div>
              <div style={{ fontSize:13, color:"var(--muted2)", marginBottom:16, lineHeight:1.6 }}>
                Restaure tes données depuis un fichier de sauvegarde. Attention, cela remplacera toutes les données actuelles.
              </div>
              <button onClick={()=>importRef.current.click()} style={{
                width:"100%", padding:"16px", border:"1px solid var(--border)", borderRadius:4, cursor:"pointer",
                background:"transparent", color:"var(--muted5)", fontFamily:"'Courier New',monospace",
                fontSize:13, letterSpacing:2, fontWeight:"bold",
              }}>📂 RESTAURER UNE SAUVEGARDE</button>
              <input ref={importRef} type="file" accept=".json" onChange={handleImport} style={{ display:"none" }} />
            </div>

            {importMsg && (
              <div style={{
                background: importMsg.startsWith("✓") ? "var(--successBg)" : "var(--dangerBg)",
                border: "1px solid " + (importMsg.startsWith("✓") ? "var(--accent)" : "var(--danger)"),
                borderRadius:4, padding:16, textAlign:"center", marginBottom:16,
                fontSize:14, color: importMsg.startsWith("✓") ? "var(--accent)" : "var(--danger)",
                fontWeight:"bold",
              }}>
                {importMsg}
              </div>
            )}

            <div style={{ background:"var(--card)", border:"1px solid var(--border)", borderRadius:4, padding:20 }}>
              <div style={{ fontSize:12, letterSpacing:2, color:"var(--muted5)", marginBottom:12 }}>INFOS</div>
              <div style={{ fontSize:12, color:"var(--muted2)", lineHeight:1.8 }}>
                📱 Tes données sont stockées sur ton téléphone.<br/>
                🔄 Elles survivent aux mises à jour de l'app.<br/>
                ⚠️ Elles sont perdues si tu désinstalles l'app.<br/>
                ✅ Exporte régulièrement pour ne rien perdre.
              </div>
            </div>
          </div>
        )}

        {/* ── PARAMÈTRES ── */}
        {tab==="settings" && (
          <div style={{ padding:24 }}>
            <div style={{ fontSize:12, letterSpacing:3, color:"var(--muted)", marginBottom:24 }}>PARAMÈTRES</div>

            <div style={{ background:"var(--card)", border:"1px solid var(--border)", borderRadius:4, padding:20, marginBottom:16 }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", gap:12 }}>
                <div>
                  <div style={{ fontSize:14, fontWeight:"bold", color:"var(--text)", marginBottom:4 }}>
                    {theme==="dark" ? "🌙 Thème sombre" : "☀️ Thème clair"}
                  </div>
                  <div style={{ fontSize:12, color:"var(--muted2)" }}>Basculer entre thème clair et sombre</div>
                </div>
                <button
                  onClick={()=>setTheme(t => t==="dark" ? "light" : "dark")}
                  aria-label="Basculer le thème"
                  style={{
                    width:52, height:28, borderRadius:14, border:"1px solid var(--border)",
                    background: theme==="dark" ? "var(--surface2)" : "var(--accent)",
                    position:"relative", cursor:"pointer", padding:0, flexShrink:0,
                  }}
                >
                  <span style={{
                    position:"absolute", top:2, left: theme==="dark" ? 2 : 26,
                    width:22, height:22, borderRadius:"50%", background:"var(--text)",
                    transition:"left 0.2s",
                  }} />
                </button>
              </div>
            </div>

            <div style={{ background:"var(--card)", border:"1px solid var(--border)", borderRadius:4, padding:20 }}>
              <div style={{ fontSize:12, letterSpacing:2, color:"var(--muted5)", marginBottom:12 }}>COMMANDE VOCALE</div>
              <div style={{ fontSize:12, color:"var(--muted2)", lineHeight:1.8 }}>
                🎤 Utilise les boutons micro de l'onglet Calendrier pour dicter les heures ("8h30") et la date ("aujourd'hui", "hier", "lundi", "12 septembre").<br/>
                {voiceSupported
                  ? "✅ Ton navigateur supporte la reconnaissance vocale (100% native, aucune donnée envoyée à un service externe)."
                  : "⚠️ Ton navigateur ne supporte pas la reconnaissance vocale."}
              </div>
            </div>
          </div>
        )}

      {/* Bottom Nav */}
      <div style={{ position:"fixed", bottom:0, left:"50%", transform:"translateX(-50%)", width:"100%", maxWidth:430, background:"var(--navBg)", borderTop:"1px solid var(--borderSoft)", display:"flex", padding:"12px 0 24px" }}>
        {[
          { id:"calendar", icon:"📆", label:"Calendrier" },
          { id:"stats", icon:"📊", label:"Stats" },
          { id:"history", icon:"📋", label:"Historique" },
          { id:"save", icon:"💾", label:"Sauvegarde" },
          { id:"settings", icon:"⚙️", label:"Paramètres" },
        ].map(t=>(
          <button key={t.id} onClick={()=>setTab(t.id)} style={{ flex:1, background:"transparent", border:"none", cursor:"pointer", display:"flex", flexDirection:"column", alignItems:"center", gap:4, padding:"8px 0" }}>
            <span style={{ fontSize:18 }}>{t.icon}</span>
            <span style={{ fontSize:9, letterSpacing:0.5, color:tab===t.id?"var(--text)":"var(--muted3)", fontFamily:"'Courier New',monospace", transition:"color 0.2s" }}>{t.label.toUpperCase()}</span>
            {tab===t.id&&<div style={{ width:20, height:2, background:"var(--text)", borderRadius:1 }}/>}
          </button>
        ))}
      </div>

      <style>{`
        :root {
          --bg:${v.bg}; --card:${v.card}; --navBg:${v.navBg}; --text:${v.text};
          --muted:${v.muted}; --muted2:${v.muted2}; --muted3:${v.muted3}; --muted4:${v.muted4}; --muted5:${v.muted5}; --muted6:${v.muted6};
          --border:${v.border}; --borderSoft:${v.borderSoft}; --surface2:${v.surface2};
          --accent:${v.accent}; --danger:${v.danger}; --successBg:${v.successBg}; --dangerBg:${v.dangerBg};
          --scrollThumb:${v.scrollThumb};
        }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.3} }
        * { box-sizing:border-box; }
        input:focus { outline:none; }
        input[type="time"]::-webkit-calendar-picker-indicator { filter:invert(0.5); }
        ::-webkit-scrollbar{width:4px}
        ::-webkit-scrollbar-track{background:var(--bg)}
        ::-webkit-scrollbar-thumb{background:var(--scrollThumb);border-radius:2px}
      `}</style>
    </div>
  );
}
