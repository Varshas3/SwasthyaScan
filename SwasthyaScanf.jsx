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
    { part: "Lips", finding: "Lip pallor & mild dryness noted", severity: "moderate", icon: "👄" },
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

// Keys map exactly to the model's expected JSON payload
const QUESTIONS = [
  {
    key: "fatigue_breath",
    text: "How often do you feel fatigued, short of breath, or low on energy during daily activities?",
    category: "Energy & Breathing",
    icon: "😮‍💨",
    options: ["Often", "Sometimes", "Never"],
  },
  {
    key: "pica",
    text: "Do you have unusual cravings for non-food items like ice, chalk, clay, or dirt?",
    category: "Pica Symptoms",
    icon: "🧊",
    options: ["Yes", "No"],
  },
  {
    key: "restless_legs",
    text: "Do you experience an uncomfortable urge to move your legs, especially at night or when resting?",
    category: "Restless Legs",
    icon: "🦵",
    options: ["Often", "Sometimes", "Never"],
  },
  {
    key: "tongue_change",
    text: "Have you noticed any changes in your tongue — soreness, smoothness, swelling, or discoloration?",
    category: "Tongue Changes",
    icon: "👅",
    options: ["Yes", "No"],
  },
  {
    key: "pale_skin",
    text: "How often do people notice or you observe paleness in your skin, gums, or inner eyelids?",
    category: "Pallor / Pale Skin",
    icon: "🫠",
    options: ["Often", "Sometimes", "Never"],
  },
  {
    key: "tinnitus",
    text: "Do you experience ringing, buzzing, or whooshing sounds in your ears (tinnitus)?",
    category: "Tinnitus",
    icon: "👂",
    options: ["Often", "Sometimes", "Never"],
  },
  {
    key: "hair_nail_brittle",
    text: "Have you noticed increased hair fall, thinning, or brittle/spoon-shaped nails recently?",
    category: "Hair & Nails",
    icon: "💅",
    options: ["Often", "Sometimes", "Never"],
  },
  {
    key: "cold_extremities",
    text: "Do your hands or feet feel unusually cold even in normal or warm temperatures?",
    category: "Circulation",
    icon: "🥶",
    options: ["Often", "Sometimes", "Never"],
  },
  {
    key: "muscle_cramps",
    text: "Do you experience muscle cramps, bone tenderness, or joint aches without obvious physical cause?",
    category: "Musculoskeletal",
    icon: "🦴",
    options: ["Often", "Sometimes", "Never"],
  },
  {
    key: "poor_wound_healing",
    text: "Do minor cuts, bruises, or skin wounds take longer than usual to heal?",
    category: "Wound Healing",
    icon: "🩹",
    options: ["Yes", "No", "Sometimes"],
  },
];

const BODY_PARTS = [
  { id: "nails", label: "Fingernails", description: "Capture all 10 nails in good lighting", icon: "🖐️", hint: "Flat, well-lit photo", required: true },
  { id: "eyes", label: "Eyes", description: "Pull lower eyelid down slightly", icon: "👁️", hint: "Clear, close-up shot", required: true },
  { id: "tongue", label: "Tongue", description: "Extend tongue fully under natural light", icon: "👅", hint: "Daylight preferred", required: true },
  { id: "skin", label: "Skin Patch", description: "Inner forearm or palm area works best", icon: "🫧", hint: "Clean, dry skin", required: true },
  { id: "lips", label: "Lips", description: "Relax lips naturally under good lighting", icon: "👄", hint: "Clear, natural light", required: true },
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
    handleFile(id, e.dataTransfer.files[0]);
  }, []);

  const requiredParts = BODY_PARTS.filter(p => p.required);
  const optionalParts = BODY_PARTS.filter(p => !p.required);
  const uploadedRequired = requiredParts.filter(p => uploads[p.id]).length;
  const canProceed = uploadedRequired > 0;

  const renderCard = (part) => {
    const img = uploads[part.id];
    const isDragging = dragging === part.id;
    const borderColor = img ? "#10b981" : isDragging ? "#0ea5e9" : part.required ? "#cbd5e1" : "#e2e8f0";
    const bgColor = img ? "#f0fdf4" : isDragging ? "#f0f9ff" : part.required ? "#f8fafc" : "#fafbfc";

    return (
      <label key={part.id}
        onDragOver={e => { e.preventDefault(); setDragging(part.id); }}
        onDragLeave={() => setDragging(null)}
        onDrop={e => onDrop(part.id, e)}
        style={{
          display: "block", cursor: "pointer", borderRadius: 16,
          border: `2px dashed ${borderColor}`,
          background: bgColor,
          padding: 0, overflow: "hidden", transition: "all .2s",
          boxShadow: isDragging ? "0 0 0 4px rgba(14,165,233,.15)" : img ? "0 0 0 4px rgba(16,185,129,.1)" : "none",
          minHeight: 200, position: "relative",
        }}>
        <input type="file" accept="image/*" style={{ display: "none" }} onChange={e => handleFile(part.id, e.target.files[0])} />

        {/* Required badge top-left when not uploaded */}
        {!img && (
          <div style={{
            position: "absolute", top: 10, left: 10,
            background: "#fef2f2", color: "#ef4444",
            border: "1px solid #fecaca",
            borderRadius: 999, padding: "2px 8px",
            fontFamily: "'DM Sans', sans-serif", fontSize: 10, fontWeight: 700,
            textTransform: "uppercase", letterSpacing: 0.6,
          }}>
            Required
          </div>
        )}

        {img ? (
          <div style={{ position: "relative" }}>
            <img src={img} alt={part.label} style={{ width: "100%", height: 160, objectFit: "cover", display: "block" }} />
            <div style={{ position: "absolute", top: 8, right: 8, background: "#10b981", borderRadius: 999, padding: "3px 10px", color: "#fff", fontSize: 11, fontWeight: 700, fontFamily: "'DM Sans', sans-serif" }}>✓ Uploaded</div>
            <div style={{ padding: "12px 14px" }}>
              <div style={{ fontFamily: "'DM Sans', sans-serif", fontWeight: 600, color: "#0f172a", fontSize: 14 }}>{part.icon} {part.label}</div>
            </div>
          </div>
        ) : (
          <div style={{ padding: "28px 20px 20px", display: "flex", flexDirection: "column", alignItems: "center", gap: 12, minHeight: 200, justifyContent: "center" }}>
            <div style={{ fontSize: 40 }}>{part.icon}</div>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontFamily: "'DM Sans', sans-serif", fontWeight: 600, color: "#1e293b", fontSize: 14 }}>{part.label}</div>
              <div style={{ fontFamily: "'DM Sans', sans-serif", color: "#94a3b8", fontSize: 12, marginTop: 4 }}>{part.description}</div>
              <div style={{
                display: "inline-block", marginTop: 8,
                background: "#e0f2fe", color: "#0284c7",
                borderRadius: 999, padding: "3px 10px", fontSize: 11, fontWeight: 600,
              }}>{part.hint}</div>
            </div>
            <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 12, color: "#cbd5e1" }}>Click or drag & drop</div>
          </div>
        )}
      </label>
    );
  };

  return (
    <div style={{ minHeight: "100vh", background: "linear-gradient(135deg,#f0f9ff 0%,#e0f2fe 50%,#f0fdf4 100%)" }}>
      <link href="https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=DM+Sans:wght@400;500;600&display=swap" rel="stylesheet" />
      <div style={{ maxWidth: 900, margin: "0 auto", padding: "0 24px 48px" }}>
        {/* Header */}
        <div style={{ textAlign: "center", paddingTop: 40 }}>

          <h1 style={{ fontFamily: "'Syne', sans-serif", fontSize: "clamp(2rem,5vw,3.2rem)", fontWeight: 800, color: "#0f172a", margin: 0, lineHeight: 1.1 }}>
            Swasthya<span style={{ color: "#0ea5e9" }}>Scan</span>
          </h1>
          <p style={{ fontFamily: "'DM Sans', sans-serif", color: "#64748b", marginTop: 10, fontSize: 16, maxWidth: 480, margin: "10px auto 0" }}>
            AI-powered health screening through visual biomarkers & symptom analysis
          </p>
        </div>

        <StepIndicator current={0} />

        <div style={{ background: "#fff", borderRadius: 20, padding: "32px", boxShadow: "0 4px 24px rgba(0,0,0,.07)", marginTop: 24, border: "1px solid #e2e8f0" }}>
          <div style={{ marginBottom: 24 }}>
            <h2 style={{ fontFamily: "'Syne', sans-serif", fontSize: 22, fontWeight: 700, color: "#0f172a", margin: 0 }}>Upload Health Indicator Images</h2>
            <p style={{ fontFamily: "'DM Sans', sans-serif", color: "#64748b", marginTop: 6, fontSize: 14 }}>
              Upload at least one image to continue. All 5 photos are required for full screening accuracy.
            </p>
            <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
              <div style={{ padding: "4px 12px", borderRadius: 999, background: uploadedRequired === requiredParts.length ? "#f0fdf4" : "#fef2f2", border: `1px solid ${uploadedRequired === requiredParts.length ? "#a7f3d0" : "#fecaca"}`, fontFamily: "'DM Sans', sans-serif", fontSize: 12, fontWeight: 600, color: uploadedRequired === requiredParts.length ? "#10b981" : "#ef4444" }}>
                {uploadedRequired === requiredParts.length ? "✓" : "⚠️"} {uploadedRequired}/{requiredParts.length} photos uploaded
              </div>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(190px,1fr))", gap: 16 }}>
            {BODY_PARTS.map(renderCard)}
          </div>

          {!canProceed && (
            <div style={{ marginTop: 20, padding: "12px 16px", background: "#fef9c3", border: "1px solid #fde68a", borderRadius: 10, fontFamily: "'DM Sans', sans-serif", fontSize: 13, color: "#92400e", display: "flex", alignItems: "center", gap: 8 }}>
              <span>⚠️</span> Upload at least one required image to proceed with the screening
            </div>
          )}

          <button onClick={onNext} disabled={!canProceed}
            style={{
              width: "100%", marginTop: 28, padding: "16px", borderRadius: 14,
              background: canProceed ? "linear-gradient(135deg,#0ea5e9,#0284c7)" : "#e2e8f0",
              color: canProceed ? "#fff" : "#94a3b8", border: "none", cursor: canProceed ? "pointer" : "not-allowed",
              fontFamily: "'DM Sans', sans-serif", fontWeight: 700, fontSize: 16,
              boxShadow: canProceed ? "0 4px 16px rgba(14,165,233,.35)" : "none",
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
  const [copied, setCopied] = useState(false);
  const answered = Object.keys(answers).length;
  const allAnswered = answered === QUESTIONS.length;
  const progress = Math.round((answered / QUESTIONS.length) * 100);

  // Build the exact JSON payload the model expects
  const modelPayload = QUESTIONS.reduce((acc, q) => {
    acc[q.key] = answers[q.key] ?? null;
    return acc;
  }, {});

  const handleAnalyze = () => {
    // Log to console for teammate B to verify
    console.log("📤 Model Payload:", JSON.stringify(modelPayload, null, 2));
    onNext(modelPayload);
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(JSON.stringify(modelPayload, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Color logic per option value
  const optionColor = (opt) => {
    if (opt === "Yes" || opt === "Often") return { border: "#ef4444", bg: "#fef2f2", dot: "#ef4444" };
    if (opt === "Sometimes") return { border: "#f59e0b", bg: "#fffbeb", dot: "#f59e0b" };
    if (opt === "No" || opt === "Never") return { border: "#10b981", bg: "#f0fdf4", dot: "#10b981" };
    return { border: "#0ea5e9", bg: "#e0f2fe", dot: "#0ea5e9" };
  };

  return (
    <div style={{ minHeight: "100vh", background: "linear-gradient(135deg,#f0f9ff 0%,#e0f2fe 50%,#f0fdf4 100%)" }}>
      <link href="https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=DM+Sans:wght@400;500;600&display=swap" rel="stylesheet" />
      <div style={{ maxWidth: 740, margin: "0 auto", padding: "0 24px 48px" }}>
        <div style={{ textAlign: "center", paddingTop: 36 }}>
          <h1 style={{ fontFamily: "'Syne', sans-serif", fontSize: "clamp(1.6rem,4vw,2.4rem)", fontWeight: 800, color: "#0f172a", margin: 0 }}>
            Swasthya<span style={{ color: "#0ea5e9" }}>Scan</span>
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
            {QUESTIONS.map((q, i) => {
              const isAnswered = !!answers[q.key];
              return (
                <div key={q.key} style={{ padding: "20px", borderRadius: 14, background: isAnswered ? "#f0f9ff" : "#f8fafc", border: `1.5px solid ${isAnswered ? "#bae6fd" : "#e2e8f0"}`, transition: "all .2s" }}>
                  <div style={{ display: "flex", gap: 12, marginBottom: 14, alignItems: "flex-start" }}>
                    <div style={{ minWidth: 28, height: 28, background: isAnswered ? "#0ea5e9" : "#e2e8f0", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", color: isAnswered ? "#fff" : "#94a3b8", fontFamily: "'DM Sans', sans-serif", fontWeight: 700, fontSize: 12, transition: "all .2s", flexShrink: 0 }}>
                      {isAnswered ? "✓" : i + 1}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                        <span style={{ fontSize: 16 }}>{q.icon}</span>
                        <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 11, fontWeight: 600, color: "#0ea5e9", textTransform: "uppercase", letterSpacing: 0.8 }}>{q.category}</div>
                        {/* Show the model key as a subtle badge */}
                        <div style={{ marginLeft: "auto", fontFamily: "monospace", fontSize: 10, color: "#94a3b8", background: "#f1f5f9", padding: "2px 8px", borderRadius: 4, border: "1px solid #e2e8f0" }}>{q.key}</div>
                      </div>
                      <div style={{ fontFamily: "'DM Sans', sans-serif", fontWeight: 600, color: "#1e293b", fontSize: 15, lineHeight: 1.5 }}>{q.text}</div>
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 10, paddingLeft: 40, flexWrap: "wrap" }}>
                    {q.options.map(opt => {
                      const selected = answers[q.key] === opt;
                      const c = optionColor(opt);
                      return (
                        <label key={opt} style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", padding: "8px 18px", borderRadius: 999, border: `2px solid ${selected ? c.border : "#e2e8f0"}`, background: selected ? c.bg : "#fff", transition: "all .15s" }}>
                          <input type="radio" name={q.key} value={opt} checked={selected} onChange={() => setAnswers(a => ({ ...a, [q.key]: opt }))} style={{ display: "none" }} />
                          <div style={{ width: 14, height: 14, borderRadius: "50%", border: `2px solid ${selected ? c.dot : "#cbd5e1"}`, background: selected ? c.dot : "transparent", transition: "all .15s" }} />
                          <span style={{ fontFamily: "'DM Sans', sans-serif", fontWeight: 600, fontSize: 13, color: selected ? "#1e293b" : "#64748b" }}>{opt}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Live JSON Payload Preview — for dev/demo transparency */}
          {answered > 0 && (
            <div style={{ marginTop: 24, borderRadius: 12, border: "1px solid #e2e8f0", overflow: "hidden" }}>
              <div style={{ background: "#0f172a", padding: "10px 16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontFamily: "monospace", fontSize: 12, color: "#94a3b8" }}>📤 model_payload.json — {answered}/{QUESTIONS.length} filled</span>
                <button onClick={handleCopy} style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 11, fontWeight: 700, color: copied ? "#34d399" : "#38bdf8", background: "transparent", border: "none", cursor: "pointer" }}>
                  {copied ? "✓ Copied!" : "Copy JSON"}
                </button>
              </div>
              <pre style={{ background: "#1e293b", color: "#e2e8f0", fontFamily: "monospace", fontSize: 12, padding: "16px", margin: 0, overflowX: "auto", lineHeight: 1.7 }}>
                {JSON.stringify(modelPayload, null, 2)}
              </pre>
            </div>
          )}

          {!allAnswered && answered > 0 && (
            <div style={{ marginTop: 16, padding: "10px 16px", background: "#fef9c3", border: "1px solid #fde68a", borderRadius: 10, fontFamily: "'DM Sans', sans-serif", fontSize: 13, color: "#92400e" }}>
              ⚠️ {QUESTIONS.length - answered} question{QUESTIONS.length - answered > 1 ? "s" : ""} remaining — you can still proceed with partial answers
            </div>
          )}

          <div style={{ display: "flex", gap: 12, marginTop: 24 }}>
            <button onClick={onBack} style={{ padding: "14px 28px", borderRadius: 12, border: "2px solid #e2e8f0", background: "#fff", fontFamily: "'DM Sans', sans-serif", fontWeight: 700, fontSize: 15, color: "#64748b", cursor: "pointer" }}>
              ← Back
            </button>
            <button onClick={handleAnalyze} disabled={answered === 0}
              style={{
                flex: 1, padding: "14px", borderRadius: 12,
                background: answered > 0 ? "linear-gradient(135deg,#0ea5e9,#0284c7)" : "#e2e8f0",
                color: answered > 0 ? "#fff" : "#94a3b8", border: "none",
                cursor: answered > 0 ? "pointer" : "not-allowed",
                fontFamily: "'DM Sans', sans-serif", fontWeight: 700, fontSize: 16,
                boxShadow: answered > 0 ? "0 4px 16px rgba(14,165,233,.35)" : "none",
                transition: "all .2s",
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
          Swasthya<span style={{ color: "#38bdf8" }}>Scan</span>
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
function DashboardPage({ onRestart, modelPayload }) {
  const statusColors = { "High": "#ef4444", "Moderate": "#f59e0b", "Low Risk": "#10b981" };
  const statusBgs = { "High": "#fef2f2", "Moderate": "#fffbeb", "Low Risk": "#f0fdf4" };

  return (
    <div style={{ minHeight: "100vh", background: "#f1f5f9" }}>
      <link href="https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=DM+Sans:wght@400;500;600&display=swap" rel="stylesheet" />

      {/* Top Bar */}
      <div style={{ background: "#fff", borderBottom: "1px solid #e2e8f0", padding: "16px 24px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1 style={{ fontFamily: "'Syne', sans-serif", fontSize: 24, fontWeight: 800, color: "#0f172a", margin: 0 }}>
            Swasthya<span style={{ color: "#0ea5e9" }}>Scan</span>
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

        {/* Model Payload Panel — shows what was sent to teammate B's model */}
        {modelPayload && (
          <div style={{ marginTop: 24, borderRadius: 16, border: "1.5px solid #e2e8f0", overflow: "hidden", boxShadow: "0 2px 10px rgba(0,0,0,.05)" }}>
            <div style={{ background: "#0f172a", padding: "14px 20px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <span style={{ fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: 14, color: "#f0f9ff" }}>📤 Submitted Symptom Payload</span>
                <span style={{ fontFamily: "monospace", fontSize: 11, color: "#64748b", marginLeft: 12 }}>— sent to prediction model</span>
              </div>
            </div>
            <div style={{ background: "#1e293b", padding: "20px", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 10 }}>
              {Object.entries(modelPayload).map(([key, val]) => (
                <div key={key} style={{ background: "rgba(255,255,255,.05)", borderRadius: 10, padding: "10px 14px", border: "1px solid rgba(255,255,255,.08)" }}>
                  <div style={{ fontFamily: "monospace", fontSize: 11, color: "#64748b", marginBottom: 4 }}>{key}</div>
                  <div style={{ fontFamily: "'DM Sans', sans-serif", fontWeight: 700, fontSize: 15, color: val === "Often" || val === "Yes" ? "#f87171" : val === "Sometimes" ? "#fbbf24" : val === "Never" || val === "No" ? "#34d399" : "#94a3b8" }}>
                    {val ?? <span style={{ color: "#475569", fontStyle: "italic" }}>unanswered</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Disclaimer */}
        <div style={{ marginTop: 24, padding: "16px 20px", background: "#f0f9ff", border: "1px solid #bae6fd", borderRadius: 12, display: "flex", gap: 12, alignItems: "flex-start" }}>
          <span style={{ fontSize: 18, flexShrink: 0 }}>ℹ️</span>
          <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, color: "#0c4a6e", margin: 0, lineHeight: 1.6 }}>
            <strong>Disclaimer:</strong> SwasthyaScan is a prototype screening tool and is not a substitute for professional medical diagnosis. Results are generated from mock data for demonstration purposes. Please consult a qualified healthcare professional for any health concerns.
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── APP SHELL ────────────────────────────────────────────────────────────────
export default function App() {
  const [page, setPage] = useState("upload");
  const [modelPayload, setModelPayload] = useState(null);

  const handleQuestionnaireNext = (payload) => {
    setModelPayload(payload);
    setPage("loading");
  };

  if (page === "upload") return <UploadPage onNext={() => setPage("questions")} />;
  if (page === "questions") return <QuestionnairePage onNext={handleQuestionnaireNext} onBack={() => setPage("upload")} />;
  if (page === "loading") {
    setTimeout(() => setPage("dashboard"), 5000);
    return <LoadingScreen />;
  }
  if (page === "dashboard") return <DashboardPage onRestart={() => { setModelPayload(null); setPage("upload"); }} modelPayload={modelPayload} />;
}