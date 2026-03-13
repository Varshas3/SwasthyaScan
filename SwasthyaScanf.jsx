import { useState, useRef, useCallback, useEffect } from "react";

// ─── MOCK DATA ──────────────────────────────────────────────────────────────
const MOCK_RESULTS = {
  riskCards: [
    { id: "iron", label: "Iron Deficiency / Anemia", status: "High", level: 3, color: "#ef4444", bg: "#fef2f2", border: "#fecaca", icon: "🩸", detail: "Pale nail beds & tongue pallor detected" },
    { id: "vitamin", label: "Vitamin Deficiency (A & B12)", status: "Moderate", level: 2, color: "#f59e0b", bg: "#fffbeb", border: "#fde68a", icon: "💊", detail: "Dry skin & ocular dryness indicators" },
    { id: "hydration", label: "Hydration Status", status: "Low Risk", level: 1, color: "#10b981", bg: "#f0fdf4", border: "#a7f3d0", icon: "💧", detail: "Skin turgor within normal range" },
    { id: "protein", label: "Protein Deficiency", status: "Moderate", level: 2, color: "#f97316", bg: "#fff7ed", border: "#fed7aa", icon: "🥩", detail: "Nail brittleness & hair texture changes" },
    { id: "zinc", label: "Zinc Deficiency", status: "Low Risk", level: 1, color: "#06b6d4", bg: "#ecfeff", border: "#a5f3fc", icon: "⚡", detail: "No significant markers detected" },
    { id: "calcium", label: "Calcium Deficiency", status: "Moderate", level: 2, color: "#8b5cf6", bg: "#f5f3ff", border: "#ddd6fe", icon: "🦴", detail: "Nail ridging patterns observed" },
  ],
  confidence: { image: 78, symptom: 72, overall: 75 },
  imageAnalysis: [
    { part: "Fingernails", finding: "Pale nail beds detected", severity: "high", icon: "🖐️" },
    { part: "Eyes", finding: "Mild conjunctival pallor", severity: "moderate", icon: "👁️" },
    { part: "Tongue", finding: "Tongue discoloration noted", severity: "high", icon: "👅" },
    { part: "Skin Patch", finding: "Dry skin texture observed", severity: "moderate", icon: "🫧" },
  ],
  recommendations: [
    { category: "Immediate", text: "Consider checking hemoglobin and serum ferritin levels", icon: "🔬" },
    { category: "Diet", text: "Increase iron-rich foods: spinach, lentils, red meat, fortified cereals", icon: "🥗" },
    { category: "Supplements", text: "Discuss B12 and Vitamin A supplementation with your physician", icon: "💊" },
    { category: "Hydration", text: "Maintain 8–10 glasses of water daily; monitor skin elasticity", icon: "💧" },
    { category: "Follow-up", text: "Consult a physician if fatigue and pallor symptoms persist beyond 2 weeks", icon: "🏥" },
    { category: "Lifestyle", text: "Pair Vitamin C with iron-rich meals to enhance absorption", icon: "🍋" },
  ],
};

const QUESTIONS = [
  { id: 1, text: "Do you frequently feel fatigued or low on energy throughout the day?", category: "Energy" },
  { id: 2, text: "Do you experience dizziness, lightheadedness, or frequent headaches?", category: "Neurological" },
  { id: 3, text: "Have you noticed brittle nails, hair fall, or changes in hair texture?", category: "Physical Signs" },
  { id: 4, text: "Do you experience unusual skin dryness, flakiness, or rough patches?", category: "Skin" },
  { id: 5, text: "Do you feel dehydrated often, even after drinking water?", category: "Hydration" },
  { id: 6, text: "Have you noticed pale gums, inner eyelids, or tongue discoloration?", category: "Oral / Ocular" },
  { id: 7, text: "Do you experience muscle cramps, joint pain, or bone tenderness?", category: "Musculoskeletal" },
  { id: 8, text: "Have you had difficulty concentrating or experienced memory issues recently?", category: "Cognitive" },
];

const BODY_PARTS = [
  { id: "nails", label: "Fingernails", description: "Capture all 10 nails in good lighting", icon: "🖐️", hint: "Flat, well-lit photo" },
  { id: "eyes", label: "Eyes", description: "Pull lower eyelid down slightly", icon: "👁️", hint: "Clear, close-up shot" },
  { id: "tongue", label: "Tongue", description: "Extend tongue fully under natural light", icon: "👅", hint: "Daylight preferred" },
  { id: "skin", label: "Skin Patch", description: "Inner forearm or palm area works best", icon: "🫧", hint: "Clean, dry skin" },
];

// ─── HELPERS ────────────────────────────────────────────────────────────────
function cn(...classes) { return classes.filter(Boolean).join(" "); }

function CircularProgress({ value, size = 120, strokeWidth = 8, color = "#0ea5e9", label }) {
  const r = (size - strokeWidth) / 2;
  const circ = 2 * Math.PI * r;
  const [animated, setAnimated] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => setAnimated(value), 400);
    return () => clearTimeout(t);
  }, [value]);
  const offset = circ - (animated / 100) * circ;
  return (
    <div className="flex flex-col items-center gap-2">
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#e2e8f0" strokeWidth={strokeWidth} />
        <circle
          cx={size/2} cy={size/2} r={r} fill="none"
          stroke={color} strokeWidth={strokeWidth}
          strokeDasharray={circ} strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: "stroke-dashoffset 1.2s cubic-bezier(.4,0,.2,1)" }}
        />
        <text x={size/2} y={size/2} textAnchor="middle" dominantBaseline="central"
          style={{ transform: "rotate(90deg)", transformOrigin: `${size/2}px ${size/2}px`, fill: "#1e293b", fontWeight: 700, fontSize: size * 0.2 }}>
          {animated}%
        </text>
      </svg>
      {label && <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 12, color: "#64748b", fontWeight: 500 }}>{label}</span>}
    </div>
  );
}

function AnimatedBar({ value, color }) {
  const [w, setW] = useState(0);
  useEffect(() => { const t = setTimeout(() => setW(value), 300); return () => clearTimeout(t); }, [value]);
  return (
    <div style={{ background: "#e2e8f0", borderRadius: 999, height: 8, overflow: "hidden" }}>
      <div style={{ width: `${w}%`, background: color, height: "100%", borderRadius: 999, transition: "width 1.2s cubic-bezier(.4,0,.2,1)" }} />
    </div>
  );
}

// ─── STEP INDICATOR ─────────────────────────────────────────────────────────
function StepIndicator({ current }) {
  const steps = ["Upload Images", "Questionnaire", "Results"];
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 0, justifyContent: "center", padding: "24px 0 8px" }}>
      {steps.map((s, i) => (
        <div key={s} style={{ display: "flex", alignItems: "center" }}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
            <div style={{
              width: 36, height: 36, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
              background: i < current ? "#0ea5e9" : i === current ? "#0284c7" : "#e2e8f0",
              color: i <= current ? "#fff" : "#94a3b8",
              fontWeight: 700, fontSize: 14, boxShadow: i === current ? "0 0 0 4px rgba(14,165,233,.2)" : "none",
              transition: "all .3s",
              fontFamily: "'DM Sans', sans-serif",
            }}>
              {i < current ? "✓" : i + 1}
            </div>
            <span style={{ fontSize: 11, fontWeight: i === current ? 700 : 500, color: i === current ? "#0284c7" : "#94a3b8", fontFamily: "'DM Sans', sans-serif", whiteSpace: "nowrap" }}>{s}</span>
          </div>
          {i < steps.length - 1 && (
            <div style={{ width: 80, height: 2, background: i < current ? "#0ea5e9" : "#e2e8f0", margin: "0 4px", marginBottom: 20, transition: "background .3s" }} />
          )}
        </div>
      ))}
    </div>
  );
}

// ─── PAGE 1: UPLOAD ──────────────────────────────────────────────────────────
function UploadPage({ onNext }) {
  const [uploads, setUploads] = useState({});
  const [dragging, setDragging] = useState(null);

  const handleFile = (id, file) => {
    if (!file || !file.type.startsWith("image/")) return;
    const url = URL.createObjectURL(file);
    setUploads(u => ({ ...u, [id]: url }));
  };

  const onDrop = useCallback((id, e) => {
    e.preventDefault(); setDragging(null);
    const file = e.dataTransfer.files[0];
    handleFile(id, file);
  }, []);

  const hasAny = Object.keys(uploads).length > 0;

  return (
    <div style={{ minHeight: "100vh", background: "linear-gradient(135deg,#f0f9ff 0%,#e0f2fe 50%,#f0fdf4 100%)" }}>
      <link href="https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=DM+Sans:wght@400;500;600&display=swap" rel="stylesheet" />
      <div style={{ maxWidth: 900, margin: "0 auto", padding: "0 24px 48px" }}>
        {/* Header */}
        <div style={{ textAlign: "center", paddingTop: 40 }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 10, background: "rgba(14,165,233,.08)", border: "1px solid rgba(14,165,233,.2)", borderRadius: 999, padding: "6px 16px", marginBottom: 20 }}>
            <span style={{ fontSize: 18 }}>🏥</span>
            <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, fontWeight: 600, color: "#0284c7", letterSpacing: 1, textTransform: "uppercase" }}>HEAL-A-Thon 2026 · PES University</span>
          </div>
          <h1 style={{ fontFamily: "'Syne', sans-serif", fontSize: "clamp(2rem,5vw,3.2rem)", fontWeight: 800, color: "#0f172a", margin: 0, lineHeight: 1.1 }}>
            Vital<span style={{ color: "#0ea5e9" }}>View</span> <span style={{ color: "#10b981" }}>AI</span>
          </h1>
          <p style={{ fontFamily: "'DM Sans', sans-serif", color: "#64748b", marginTop: 10, fontSize: 16, maxWidth: 480, margin: "10px auto 0" }}>
            AI-powered health screening through visual biomarkers & symptom analysis
          </p>
        </div>

        <StepIndicator current={0} />

        <div style={{ background: "#fff", borderRadius: 20, padding: "32px", boxShadow: "0 4px 24px rgba(0,0,0,.07)", marginTop: 24, border: "1px solid #e2e8f0" }}>
          <div style={{ marginBottom: 24 }}>
            <h2 style={{ fontFamily: "'Syne', sans-serif", fontSize: 22, fontWeight: 700, color: "#0f172a", margin: 0 }}>Upload Health Indicator Images</h2>
            <p style={{ fontFamily: "'DM Sans', sans-serif", color: "#64748b", marginTop: 6, fontSize: 14 }}>Upload at least one image to continue. More images improve accuracy.</p>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(190px,1fr))", gap: 16 }}>
            {BODY_PARTS.map(part => {
              const img = uploads[part.id];
              const isDragging = dragging === part.id;
              return (
                <label key={part.id}
                  onDragOver={e => { e.preventDefault(); setDragging(part.id); }}
                  onDragLeave={() => setDragging(null)}
                  onDrop={e => onDrop(part.id, e)}
                  style={{
                    display: "block", cursor: "pointer", borderRadius: 16,
                    border: `2px dashed ${img ? "#10b981" : isDragging ? "#0ea5e9" : "#cbd5e1"}`,
                    background: img ? "#f0fdf4" : isDragging ? "#f0f9ff" : "#f8fafc",
                    padding: 0, overflow: "hidden", transition: "all .2s",
                    boxShadow: isDragging ? "0 0 0 4px rgba(14,165,233,.15)" : img ? "0 0 0 4px rgba(16,185,129,.1)" : "none",
                    minHeight: 200,
                  }}>
                  <input type="file" accept="image/*" style={{ display: "none" }} onChange={e => handleFile(part.id, e.target.files[0])} />
                  {img ? (
                    <div style={{ position: "relative" }}>
                      <img src={img} alt={part.label} style={{ width: "100%", height: 160, objectFit: "cover", display: "block" }} />
                      <div style={{ position: "absolute", top: 8, right: 8, background: "#10b981", borderRadius: 999, padding: "3px 10px", color: "#fff", fontSize: 11, fontWeight: 700, fontFamily: "'DM Sans', sans-serif" }}>✓ Uploaded</div>
                      <div style={{ padding: "12px 14px" }}>
                        <div style={{ fontFamily: "'DM Sans', sans-serif", fontWeight: 600, color: "#0f172a", fontSize: 14 }}>{part.icon} {part.label}</div>
                      </div>
                    </div>
                  ) : (
                    <div style={{ padding: 24, display: "flex", flexDirection: "column", alignItems: "center", gap: 12, minHeight: 200, justifyContent: "center" }}>
                      <div style={{ fontSize: 40 }}>{part.icon}</div>
                      <div style={{ textAlign: "center" }}>
                        <div style={{ fontFamily: "'DM Sans', sans-serif", fontWeight: 600, color: "#1e293b", fontSize: 14 }}>{part.label}</div>
                        <div style={{ fontFamily: "'DM Sans', sans-serif", color: "#94a3b8", fontSize: 12, marginTop: 4 }}>{part.description}</div>
                        <div style={{ display: "inline-block", marginTop: 8, background: "#e0f2fe", color: "#0284c7", borderRadius: 999, padding: "3px 10px", fontSize: 11, fontWeight: 600 }}>{part.hint}</div>
                      </div>
                      <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 12, color: "#cbd5e1" }}>Click or drag & drop</div>
                    </div>
                  )}
                </label>
              );
            })}
          </div>

          {!hasAny && (
            <div style={{ marginTop: 20, padding: "12px 16px", background: "#fef9c3", border: "1px solid #fde68a", borderRadius: 10, fontFamily: "'DM Sans', sans-serif", fontSize: 13, color: "#92400e", display: "flex", alignItems: "center", gap: 8 }}>
              <span>⚠️</span> Upload at least one image to proceed with the screening
            </div>
          )}

          <button onClick={onNext} disabled={!hasAny}
            style={{
              width: "100%", marginTop: 28, padding: "16px", borderRadius: 14,
              background: hasAny ? "linear-gradient(135deg,#0ea5e9,#0284c7)" : "#e2e8f0",
              color: hasAny ? "#fff" : "#94a3b8", border: "none", cursor: hasAny ? "pointer" : "not-allowed",
              fontFamily: "'DM Sans', sans-serif", fontWeight: 700, fontSize: 16,
              boxShadow: hasAny ? "0 4px 16px rgba(14,165,233,.35)" : "none",
              transition: "all .2s", letterSpacing: 0.3,
            }}>
            Continue to Symptom Questionnaire →
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── PAGE 2: QUESTIONNAIRE ───────────────────────────────────────────────────
function QuestionnairePage({ onNext, onBack }) {
  const [answers, setAnswers] = useState({});
  const answered = Object.keys(answers).length;
  const progress = Math.round((answered / QUESTIONS.length) * 100);

  return (
    <div style={{ minHeight: "100vh", background: "linear-gradient(135deg,#f0f9ff 0%,#e0f2fe 50%,#f0fdf4 100%)" }}>
      <link href="https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=DM+Sans:wght@400;500;600&display=swap" rel="stylesheet" />
      <div style={{ maxWidth: 740, margin: "0 auto", padding: "0 24px 48px" }}>
        <div style={{ textAlign: "center", paddingTop: 36 }}>
          <h1 style={{ fontFamily: "'Syne', sans-serif", fontSize: "clamp(1.6rem,4vw,2.4rem)", fontWeight: 800, color: "#0f172a", margin: 0 }}>
            Vital<span style={{ color: "#0ea5e9" }}>View</span> <span style={{ color: "#10b981" }}>AI</span>
          </h1>
        </div>

        <StepIndicator current={1} />

        <div style={{ background: "#fff", borderRadius: 20, padding: "32px", boxShadow: "0 4px 24px rgba(0,0,0,.07)", marginTop: 24, border: "1px solid #e2e8f0" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8, flexWrap: "wrap", gap: 8 }}>
            <div>
              <h2 style={{ fontFamily: "'Syne', sans-serif", fontSize: 22, fontWeight: 700, color: "#0f172a", margin: 0 }}>Symptom Questionnaire</h2>
              <p style={{ fontFamily: "'DM Sans', sans-serif", color: "#64748b", marginTop: 4, fontSize: 14, margin: "6px 0 0" }}>{answered} of {QUESTIONS.length} answered</p>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontFamily: "'DM Sans', sans-serif", fontWeight: 700, fontSize: 22, color: "#0ea5e9" }}>{progress}%</div>
              <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 11, color: "#94a3b8" }}>Complete</div>
            </div>
          </div>

          <div style={{ background: "#e2e8f0", borderRadius: 999, height: 6, marginBottom: 28, overflow: "hidden" }}>
            <div style={{ width: `${progress}%`, background: "linear-gradient(90deg,#0ea5e9,#10b981)", height: "100%", borderRadius: 999, transition: "width .5s ease" }} />
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {QUESTIONS.map((q, i) => (
              <div key={q.id} style={{ padding: "20px", borderRadius: 14, background: answers[q.id] ? "#f0f9ff" : "#f8fafc", border: `1.5px solid ${answers[q.id] ? "#bae6fd" : "#e2e8f0"}`, transition: "all .2s" }}>
                <div style={{ display: "flex", gap: 12, marginBottom: 14, alignItems: "flex-start" }}>
                  <div style={{ minWidth: 26, height: 26, background: answers[q.id] ? "#0ea5e9" : "#e2e8f0", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", color: answers[q.id] ? "#fff" : "#94a3b8", fontFamily: "'DM Sans', sans-serif", fontWeight: 700, fontSize: 12, transition: "all .2s" }}>
                    {answers[q.id] ? "✓" : i + 1}
                  </div>
                  <div>
                    <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 11, fontWeight: 600, color: "#0ea5e9", textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 4 }}>{q.category}</div>
                    <div style={{ fontFamily: "'DM Sans', sans-serif", fontWeight: 600, color: "#1e293b", fontSize: 15, lineHeight: 1.5 }}>{q.text}</div>
                  </div>
                </div>
                <div style={{ display: "flex", gap: 10, paddingLeft: 38, flexWrap: "wrap" }}>
                  {["Yes", "No", "Sometimes"].map(opt => (
                    <label key={opt} style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", padding: "8px 16px", borderRadius: 999, border: `2px solid ${answers[q.id] === opt ? (opt === "Yes" ? "#0ea5e9" : opt === "No" ? "#10b981" : "#f59e0b") : "#e2e8f0"}`, background: answers[q.id] === opt ? (opt === "Yes" ? "#e0f2fe" : opt === "No" ? "#f0fdf4" : "#fffbeb") : "#fff", transition: "all .15s" }}>
                      <input type="radio" name={`q${q.id}`} value={opt} checked={answers[q.id] === opt} onChange={() => setAnswers(a => ({ ...a, [q.id]: opt }))} style={{ display: "none" }} />
                      <div style={{ width: 14, height: 14, borderRadius: "50%", border: `2px solid ${answers[q.id] === opt ? (opt === "Yes" ? "#0ea5e9" : opt === "No" ? "#10b981" : "#f59e0b") : "#cbd5e1"}`, background: answers[q.id] === opt ? (opt === "Yes" ? "#0ea5e9" : opt === "No" ? "#10b981" : "#f59e0b") : "transparent", transition: "all .15s" }} />
                      <span style={{ fontFamily: "'DM Sans', sans-serif", fontWeight: 600, fontSize: 13, color: answers[q.id] === opt ? "#1e293b" : "#64748b" }}>{opt}</span>
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div style={{ display: "flex", gap: 12, marginTop: 28 }}>
            <button onClick={onBack} style={{ padding: "14px 28px", borderRadius: 12, border: "2px solid #e2e8f0", background: "#fff", fontFamily: "'DM Sans', sans-serif", fontWeight: 700, fontSize: 15, color: "#64748b", cursor: "pointer" }}>
              ← Back
            </button>
            <button onClick={onNext}
              style={{
                flex: 1, padding: "14px", borderRadius: 12,
                background: "linear-gradient(135deg,#0ea5e9,#0284c7)",
                color: "#fff", border: "none", cursor: "pointer",
                fontFamily: "'DM Sans', sans-serif", fontWeight: 700, fontSize: 16,
                boxShadow: "0 4px 16px rgba(14,165,233,.35)",
              }}>
              Analyze Results →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── LOADING SCREEN ──────────────────────────────────────────────────────────
function LoadingScreen() {
  const steps = ["Processing uploaded images…", "Running biomarker analysis…", "Evaluating symptom patterns…", "Generating risk assessment…", "Preparing your report…"];
  const [step, setStep] = useState(0);
  const [progress, setProgress] = useState(0);
  useEffect(() => {
    const iv = setInterval(() => setProgress(p => Math.min(p + 1.4, 100)), 50);
    const sv = setInterval(() => setStep(s => Math.min(s + 1, steps.length - 1)), 900);
    return () => { clearInterval(iv); clearInterval(sv); };
  }, []);
  return (
    <div style={{ minHeight: "100vh", background: "linear-gradient(135deg,#0f172a 0%,#0c2340 60%,#064e3b 100%)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 32 }}>
      <link href="https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=DM+Sans:wght@400;500;600&display=swap" rel="stylesheet" />
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: 56, marginBottom: 16, animation: "pulse 1.5s ease-in-out infinite" }}>🫀</div>
        <h1 style={{ fontFamily: "'Syne', sans-serif", fontSize: 32, fontWeight: 800, color: "#f0f9ff", margin: 0 }}>
          Vital<span style={{ color: "#38bdf8" }}>View</span> <span style={{ color: "#34d399" }}>AI</span>
        </h1>
        <p style={{ fontFamily: "'DM Sans', sans-serif", color: "#94a3b8", marginTop: 8, fontSize: 15 }}>Analyzing your health indicators</p>
      </div>
      <div style={{ width: 320, background: "rgba(255,255,255,.08)", borderRadius: 20, padding: 28, border: "1px solid rgba(255,255,255,.1)" }}>
        {steps.map((s, i) => (
          <div key={s} style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 0", opacity: i <= step ? 1 : 0.3, transition: "opacity .4s" }}>
            <div style={{ width: 20, height: 20, borderRadius: "50%", background: i < step ? "#34d399" : i === step ? "#38bdf8" : "rgba(255,255,255,.2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, transition: "all .4s", flexShrink: 0 }}>
              {i < step ? "✓" : i === step ? <span style={{ animation: "spin 1s linear infinite", display: "inline-block" }}>⟳</span> : "·"}
            </div>
            <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, color: i <= step ? "#e2e8f0" : "#64748b", fontWeight: i === step ? 600 : 400 }}>{s}</span>
          </div>
        ))}
        <div style={{ marginTop: 20, background: "rgba(255,255,255,.1)", borderRadius: 999, height: 6, overflow: "hidden" }}>
          <div style={{ width: `${progress}%`, background: "linear-gradient(90deg,#38bdf8,#34d399)", height: "100%", borderRadius: 999, transition: "width .3s linear" }} />
        </div>
        <div style={{ textAlign: "right", marginTop: 6, fontFamily: "'DM Sans', sans-serif", fontSize: 12, color: "#64748b" }}>{Math.round(progress)}%</div>
      </div>
      <style>{`@keyframes pulse{0%,100%{transform:scale(1)}50%{transform:scale(1.1)}}@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}

// ─── PAGE 3: DASHBOARD ───────────────────────────────────────────────────────
function DashboardPage({ onRestart }) {
  const statusColors = { "High": "#ef4444", "Moderate": "#f59e0b", "Low Risk": "#10b981" };
  const statusBgs = { "High": "#fef2f2", "Moderate": "#fffbeb", "Low Risk": "#f0fdf4" };

  return (
    <div style={{ minHeight: "100vh", background: "#f1f5f9" }}>
      <link href="https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=DM+Sans:wght@400;500;600&display=swap" rel="stylesheet" />

      {/* Top Bar */}
      <div style={{ background: "#fff", borderBottom: "1px solid #e2e8f0", padding: "16px 24px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1 style={{ fontFamily: "'Syne', sans-serif", fontSize: 24, fontWeight: 800, color: "#0f172a", margin: 0 }}>
            Vital<span style={{ color: "#0ea5e9" }}>View</span> <span style={{ color: "#10b981" }}>AI</span>
          </h1>
          <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, color: "#64748b", marginTop: 2 }}>Health Screening Report · {new Date().toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}</div>
        </div>
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <div style={{ padding: "6px 16px", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 999, fontFamily: "'DM Sans', sans-serif", fontSize: 13, fontWeight: 700, color: "#ef4444" }}>⚠️ High Risk Detected</div>
          <button onClick={onRestart} style={{ padding: "8px 20px", borderRadius: 10, border: "2px solid #e2e8f0", background: "#fff", fontFamily: "'DM Sans', sans-serif", fontWeight: 700, fontSize: 13, color: "#64748b", cursor: "pointer" }}>New Screening</button>
        </div>
      </div>

      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "28px 24px 60px" }}>
        <StepIndicator current={2} />

        {/* Risk Cards */}
        <div style={{ marginTop: 28 }}>
          <h2 style={{ fontFamily: "'Syne', sans-serif", fontSize: 18, fontWeight: 700, color: "#0f172a", margin: "0 0 14px" }}>Health Risk Indicators</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 14 }}>
            {MOCK_RESULTS.riskCards.map(card => (
              <div key={card.id} style={{ background: "#fff", borderRadius: 16, padding: "20px", border: `1.5px solid ${card.border}`, boxShadow: "0 2px 10px rgba(0,0,0,.05)", position: "relative", overflow: "hidden" }}>
                <div style={{ position: "absolute", top: 0, right: 0, width: 80, height: 80, background: card.bg, borderRadius: "0 16px 0 80px", display: "flex", alignItems: "flex-start", justifyContent: "flex-end", padding: "12px 14px", fontSize: 22 }}>{card.icon}</div>
                <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 12, color: "#64748b", fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 8 }}>{card.id.toUpperCase()}</div>
                <div style={{ fontFamily: "'DM Sans', sans-serif", fontWeight: 700, color: "#0f172a", fontSize: 15, lineHeight: 1.3, marginBottom: 12, paddingRight: 40 }}>{card.label}</div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                  <div style={{ padding: "4px 12px", borderRadius: 999, background: card.bg, border: `1.5px solid ${card.border}`, fontFamily: "'DM Sans', sans-serif", fontWeight: 800, fontSize: 13, color: card.color }}>{card.status}</div>
                </div>
                <div style={{ display: "flex", gap: 4 }}>
                  {[1, 2, 3].map(l => <div key={l} style={{ flex: 1, height: 5, borderRadius: 999, background: l <= card.level ? card.color : "#e2e8f0", transition: "background .3s" }} />)}
                </div>
                <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 11, color: "#94a3b8", marginTop: 8 }}>{card.detail}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Confidence Scores */}
        <div style={{ marginTop: 28, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          <div style={{ background: "#fff", borderRadius: 16, padding: "28px", border: "1.5px solid #e2e8f0", boxShadow: "0 2px 10px rgba(0,0,0,.05)" }}>
            <h3 style={{ fontFamily: "'Syne', sans-serif", fontSize: 16, fontWeight: 700, color: "#0f172a", margin: "0 0 20px" }}>Confidence Scores</h3>
            <div style={{ display: "flex", justifyContent: "space-around", flexWrap: "wrap", gap: 16 }}>
              <CircularProgress value={MOCK_RESULTS.confidence.image} color="#0ea5e9" label="Image Analysis" />
              <CircularProgress value={MOCK_RESULTS.confidence.symptom} color="#8b5cf6" label="Symptom Analysis" />
              <CircularProgress value={MOCK_RESULTS.confidence.overall} color="#ef4444" size={130} strokeWidth={10} label="Overall Risk" />
            </div>
          </div>

          <div style={{ background: "#fff", borderRadius: 16, padding: "28px", border: "1.5px solid #e2e8f0", boxShadow: "0 2px 10px rgba(0,0,0,.05)" }}>
            <h3 style={{ fontFamily: "'Syne', sans-serif", fontSize: 16, fontWeight: 700, color: "#0f172a", margin: "0 0 20px" }}>Risk Breakdown</h3>
            {MOCK_RESULTS.riskCards.map(card => (
              <div key={card.id} style={{ marginBottom: 14 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
                  <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, fontWeight: 600, color: "#1e293b" }}>{card.icon} {card.label.split(" ")[0]} {card.label.split(" ")[1] || ""}</span>
                  <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, fontWeight: 700, color: card.color }}>{card.level === 3 ? "82%" : card.level === 2 ? "61%" : "23%"}</span>
                </div>
                <AnimatedBar value={card.level === 3 ? 82 : card.level === 2 ? 61 : 23} color={card.color} />
              </div>
            ))}
          </div>
        </div>

        {/* Image Analysis Markers */}
        <div style={{ marginTop: 24 }}>
          <h2 style={{ fontFamily: "'Syne', sans-serif", fontSize: 18, fontWeight: 700, color: "#0f172a", margin: "0 0 14px" }}>Image Analysis Markers</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: 14 }}>
            {MOCK_RESULTS.imageAnalysis.map(item => (
              <div key={item.part} style={{ background: "#fff", borderRadius: 16, overflow: "hidden", border: "1.5px solid #e2e8f0", boxShadow: "0 2px 10px rgba(0,0,0,.05)" }}>
                <div style={{ height: 100, background: item.severity === "high" ? "linear-gradient(135deg,#fef2f2,#fee2e2)" : "linear-gradient(135deg,#fffbeb,#fde68a20)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 48 }}>{item.icon}</div>
                <div style={{ padding: "14px 16px" }}>
                  <div style={{ fontFamily: "'DM Sans', sans-serif", fontWeight: 700, color: "#0f172a", fontSize: 14, marginBottom: 6 }}>{item.part}</div>
                  <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 12, color: "#64748b", lineHeight: 1.5, marginBottom: 10 }}>{item.finding}</div>
                  <div style={{ display: "inline-block", padding: "3px 10px", borderRadius: 999, background: item.severity === "high" ? "#fef2f2" : "#fffbeb", color: item.severity === "high" ? "#ef4444" : "#f59e0b", fontFamily: "'DM Sans', sans-serif", fontWeight: 700, fontSize: 11, border: `1px solid ${item.severity === "high" ? "#fecaca" : "#fde68a"}` }}>
                    {item.severity === "high" ? "High Signal" : "Moderate Signal"}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Recommendations */}
        <div style={{ marginTop: 24 }}>
          <h2 style={{ fontFamily: "'Syne', sans-serif", fontSize: 18, fontWeight: 700, color: "#0f172a", margin: "0 0 14px" }}>Personalized Recommendations</h2>
          <div style={{ background: "#fff", borderRadius: 16, padding: "24px", border: "1.5px solid #e2e8f0", boxShadow: "0 2px 10px rgba(0,0,0,.05)" }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))", gap: 14 }}>
              {MOCK_RESULTS.recommendations.map((rec, i) => (
                <div key={i} style={{ display: "flex", gap: 14, padding: "16px", background: "#f8fafc", borderRadius: 12, border: "1px solid #e2e8f0", alignItems: "flex-start" }}>
                  <div style={{ fontSize: 24, flexShrink: 0 }}>{rec.icon}</div>
                  <div>
                    <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 11, fontWeight: 700, color: "#0ea5e9", textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 4 }}>{rec.category}</div>
                    <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 14, color: "#334155", lineHeight: 1.5 }}>{rec.text}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Disclaimer */}
        <div style={{ marginTop: 24, padding: "16px 20px", background: "#f0f9ff", border: "1px solid #bae6fd", borderRadius: 12, display: "flex", gap: 12, alignItems: "flex-start" }}>
          <span style={{ fontSize: 18, flexShrink: 0 }}>ℹ️</span>
          <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, color: "#0c4a6e", margin: 0, lineHeight: 1.6 }}>
            <strong>Disclaimer:</strong> VitalView AI is a prototype screening tool for HEAL-A-Thon 2026 and is not a substitute for professional medical diagnosis. Results are generated from mock data for demonstration purposes. Please consult a qualified healthcare professional for any health concerns.
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── APP SHELL ────────────────────────────────────────────────────────────────
export default function App() {
  const [page, setPage] = useState("upload");

  if (page === "upload") return <UploadPage onNext={() => setPage("questions")} />;
  if (page === "questions") return <QuestionnairePage onNext={() => setPage("loading")} onBack={() => setPage("upload")} />;
  if (page === "loading") {
    setTimeout(() => setPage("dashboard"), 5000);
    return <LoadingScreen />;
  }
  if (page === "dashboard") return <DashboardPage onRestart={() => setPage("upload")} />;
}
