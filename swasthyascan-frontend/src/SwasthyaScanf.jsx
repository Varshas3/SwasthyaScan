import { useState, useRef, useCallback, useEffect } from "react";

// ─── CONFIG ──────────────────────────────────────────────────────────────────
// Change this to your server address if running on a different machine/port
const API_BASE = "http://localhost:8000";

// ─── STATIC QUESTION DEFINITIONS ─────────────────────────────────────────────
// Used to render questions returned by /predict. Keyed by qid for fast lookup.
const QUESTION_META = {
  iron_q1: { text: "How often do you feel extreme fatigue or shortness of breath during mild activities like walking?", category: "Fatigue & Breathing",  deficiency: "iron",    icon: "😮‍💨", options: ["Often","Sometimes","Never"] },
  iron_q2: { text: "Do you have strong cravings for non-food items such as ice, dirt, paper, or clay (pica)?",          category: "Pica Symptoms",      deficiency: "iron",    icon: "🧊", options: ["Yes","No"] },
  iron_q3: { text: "Do you feel a restless sensation in your legs that worsens at night?",                               category: "Restless Legs",      deficiency: "iron",    icon: "🦵", options: ["Often","Sometimes","Never"] },
  iron_q4: { text: "Have you noticed your tongue becoming sore, smooth, or unusually red?",                              category: "Tongue Changes",     deficiency: "iron",    icon: "👅", options: ["Yes","No"] },
  iron_q5: { text: "Is the skin under your fingernails or inside your lower eyelids noticeably pale?",                  category: "Pallor / Pale Skin", deficiency: "iron",    icon: "🫠", options: ["Often","Sometimes","Never"] },
  iron_q6: { text: "Do you experience ringing or buzzing in your ears (tinnitus)?",                                     category: "Tinnitus",           deficiency: "iron",    icon: "👂", options: ["Often","Sometimes","Never"] },
  b12_q1:  { text: "Do you feel tingling, numbness, or 'pins and needles' in your hands or feet?",                      category: "Nerve Sensation",    deficiency: "b12",     icon: "🫳", options: ["Often","Sometimes","Never"] },
  b12_q2:  { text: "Do you feel unsteady while walking or find yourself losing balance more often?",                     category: "Balance",            deficiency: "b12",     icon: "🚶", options: ["Often","Sometimes","Never"] },
  b12_q3:  { text: "Have you noticed a decline in memory, difficulty thinking, or persistent brain fog?",               category: "Cognitive Function", deficiency: "b12",     icon: "🧠", options: ["Often","Sometimes","Never"] },
  b12_q4:  { text: "Have you felt unusually irritable, depressed, or experienced sudden mood changes?",                  category: "Mood Changes",       deficiency: "b12",     icon: "😔", options: ["Often","Sometimes","Never"] },
  b12_q5:  { text: "Is your tongue sore, red, or does it appear unusually smooth and shiny?",                           category: "Tongue Changes",     deficiency: "b12",     icon: "👅", options: ["Yes","No"] },
  b12_q6:  { text: "Do you feel persistent dizziness or lightheadedness when standing up?",                             category: "Dizziness",          deficiency: "b12",     icon: "💫", options: ["Often","Sometimes","Never"] },
  zinc_q1: { text: "Have you noticed food tastes bland or that your sense of smell has weakened?",                      category: "Taste & Smell",      deficiency: "zinc",    icon: "👃", options: ["Often","Sometimes","Never"] },
  zinc_q2: { text: "Do small cuts, scrapes, or sores take more than two weeks to heal completely?",                     category: "Wound Healing",      deficiency: "zinc",    icon: "🩹", options: ["Often","Sometimes","Never"] },
  zinc_q3: { text: "Have you experienced sudden thinning of your hair or patches of hair loss?",                        category: "Hair Loss",          deficiency: "zinc",    icon: "💇", options: ["Often","Sometimes","Never"] },
  zinc_q4: { text: "Do you have white spots, ridges, or horizontal lines on your fingernails?",                         category: "Nail Changes",       deficiency: "zinc",    icon: "💅", options: ["Yes","No"] },
  zinc_q5: { text: "Do you seem to catch colds or infections more easily than those around you?",                       category: "Immunity",           deficiency: "zinc",    icon: "🤧", options: ["Often","Sometimes","Never"] },
  zinc_q6: { text: "Do you have persistent skin rashes or acne that does not respond to typical treatments?",           category: "Skin Issues",        deficiency: "zinc",    icon: "🫧", options: ["Often","Sometimes","Never"] },
  protein_q1: { text: "Have you noticed unusual swelling or puffiness in your feet, ankles, or legs (edema)?",         category: "Edema / Swelling",   deficiency: "protein", icon: "🦶", options: ["Often","Sometimes","Never"] },
  protein_q2: { text: "Do you experience muscle weakness, cramps, or find physical tasks harder than before?",          category: "Muscle Weakness",    deficiency: "protein", icon: "💪", options: ["Often","Sometimes","Never"] },
  protein_q3: { text: "Has your hair become noticeably brittle, thin, or are you losing more hair than usual?",         category: "Hair & Nails",       deficiency: "protein", icon: "💅", options: ["Often","Sometimes","Never"] },
  protein_q4: { text: "Do your fingernails break easily, grow slowly, or show unusual ridges or discoloration?",        category: "Nail Changes",       deficiency: "protein", icon: "🖐️", options: ["Yes","No"] },
  protein_q5: { text: "Do you feel hungry shortly after eating, or find it difficult to feel satisfied after meals?",   category: "Appetite & Satiety", deficiency: "protein", icon: "🍽️", options: ["Often","Sometimes","Never"] },
  protein_q6: { text: "Has your skin become noticeably flaky, dry, or developed unusual rashes recently?",              category: "Skin Changes",       deficiency: "protein", icon: "🫧", options: ["Often","Sometimes","Never"] },
};

const DEFICIENCY_LABELS = {
  iron: "Iron Deficiency", b12: "Vitamin B12 Deficiency",
  zinc: "Zinc Deficiency", protein: "Protein Deficiency",
};
const OPTION_ORDER = ["Never", "Sometimes", "Often", "Yes", "No"];
const BODY_PARTS = [
  { id: "nails",  label: "Fingernails", description: "Capture all 10 nails in good lighting", icon: "🖐️", hint: "Flat, well-lit photo",  required: true },
  { id: "eyes",   label: "Eyes",        description: "Pull lower eyelid down slightly",         icon: "👁️", hint: "Clear, close-up shot",  required: true },
  { id: "tongue", label: "Tongue",      description: "Extend tongue fully under natural light", icon: "👅", hint: "Daylight preferred",     required: true },
  { id: "skin",   label: "Skin Patch",  description: "Inner forearm or palm area works best",  icon: "🫧", hint: "Clean, dry skin",        required: true },
  { id: "lips",   label: "Lips",        description: "Relax lips naturally under good lighting",icon: "👄", hint: "Clear, natural light",   required: true },
];

// ─── HELPERS ─────────────────────────────────────────────────────────────────
function CircularProgress({ value, size = 120, strokeWidth = 8, color = "#0ea5e9", label }) {
  const r = (size - strokeWidth) / 2;
  const circ = 2 * Math.PI * r;
  const [animated, setAnimated] = useState(0);
  useEffect(() => { const t = setTimeout(() => setAnimated(value), 400); return () => clearTimeout(t); }, [value]);
  const offset = circ - (animated / 100) * circ;
  return (
    <div className="flex flex-col items-center gap-2">
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#e2e8f0" strokeWidth={strokeWidth} />
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={strokeWidth}
          strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
          style={{ transition: "stroke-dashoffset 1.2s cubic-bezier(.4,0,.2,1)" }} />
        <text x={size/2} y={size/2} textAnchor="middle" dominantBaseline="central"
          style={{ transform: `rotate(90deg)`, transformOrigin: `${size/2}px ${size/2}px`,
            fill: "#1e293b", fontWeight: 700, fontSize: size * 0.2 }}>{animated}%</text>
      </svg>
      {label && <span style={{ fontFamily:"'DM Sans',sans-serif", fontSize:12, color:"#64748b", fontWeight:500 }}>{label}</span>}
    </div>
  );
}

function AnimatedBar({ value, color }) {
  const [w, setW] = useState(0);
  useEffect(() => { const t = setTimeout(() => setW(value), 300); return () => clearTimeout(t); }, [value]);
  return (
    <div style={{ background:"#e2e8f0", borderRadius:999, height:8, overflow:"hidden" }}>
      <div style={{ width:`${w}%`, background:color, height:"100%", borderRadius:999, transition:"width 1.2s cubic-bezier(.4,0,.2,1)" }} />
    </div>
  );
}

function StepIndicator({ current }) {
  const steps = ["Upload Images","Questionnaire","Results"];
  return (
    <div style={{ display:"flex", alignItems:"center", gap:0, justifyContent:"center", padding:"24px 0 8px" }}>
      {steps.map((s, i) => (
        <div key={s} style={{ display:"flex", alignItems:"center" }}>
          <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:6 }}>
            <div style={{
              width:36, height:36, borderRadius:"50%", display:"flex", alignItems:"center", justifyContent:"center",
              background: i < current ? "#0ea5e9" : i === current ? "#0284c7" : "#e2e8f0",
              color: i <= current ? "#fff" : "#94a3b8", fontWeight:700, fontSize:14,
              boxShadow: i === current ? "0 0 0 4px rgba(14,165,233,.2)" : "none",
              transition:"all .3s", fontFamily:"'DM Sans',sans-serif",
            }}>{i < current ? "✓" : i+1}</div>
            <span style={{ fontSize:11, fontWeight:i===current?700:500, color:i===current?"#0284c7":"#94a3b8", fontFamily:"'DM Sans',sans-serif", whiteSpace:"nowrap" }}>{s}</span>
          </div>
          {i < steps.length-1 && <div style={{ width:80, height:2, background:i<current?"#0ea5e9":"#e2e8f0", margin:"0 4px", marginBottom:20, transition:"background .3s" }} />}
        </div>
      ))}
    </div>
  );
}

// ─── PAGE 1: UPLOAD ───────────────────────────────────────────────────────────
function UploadPage({ onNext }) {
  const [uploads, setUploads] = useState({});        // { nails: File, ... }
  const [previews, setPreviews] = useState({});      // { nails: objectURL, ... }
  const [dragging, setDragging] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleFile = (id, file) => {
    if (!file || !file.type.startsWith("image/")) return;
    setUploads(u => ({ ...u, [id]: file }));
    setPreviews(p => ({ ...p, [id]: URL.createObjectURL(file) }));
    setError(null);
  };

  const onDrop = useCallback((id, e) => {
    e.preventDefault(); setDragging(null);
    handleFile(id, e.dataTransfer.files[0]);
  }, []);

  const requiredParts = BODY_PARTS.filter(p => p.required);
  const uploadedRequired = requiredParts.filter(p => uploads[p.id]).length;
  const canProceed = uploadedRequired > 0 && !loading;

  const handleSubmit = async () => {
    setLoading(true);
    setError(null);
    try {
      const formData = new FormData();
      for (const part of BODY_PARTS) {
        if (uploads[part.id]) formData.append(part.id, uploads[part.id]);
      }

      const res = await fetch(`${API_BASE}/predict`, { method:"POST", body:formData });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || `Server error ${res.status}`);
      }
      const data = await res.json();
      // data = { probabilities, selected_deficiencies, questions, demo_mode }
      onNext(data);
    } catch (e) {
      setError(e.message || "Could not reach the server. Make sure it's running on port 8000.");
    } finally {
      setLoading(false);
    }
  };

  const renderCard = (part) => {
    const img = previews[part.id];
    const isDragging = dragging === part.id;
    const borderColor = img ? "#10b981" : isDragging ? "#0ea5e9" : "#cbd5e1";
    const bgColor     = img ? "#f0fdf4" : isDragging ? "#f0f9ff" : "#f8fafc";

    return (
      <label key={part.id}
        onDragOver={e => { e.preventDefault(); setDragging(part.id); }}
        onDragLeave={() => setDragging(null)}
        onDrop={e => onDrop(part.id, e)}
        style={{ display:"block", cursor:"pointer", borderRadius:16, border:`2px dashed ${borderColor}`,
          background:bgColor, padding:0, overflow:"hidden", transition:"all .2s",
          boxShadow: isDragging ? "0 0 0 4px rgba(14,165,233,.15)" : img ? "0 0 0 4px rgba(16,185,129,.1)" : "none",
          minHeight:200, position:"relative" }}>
        <input type="file" accept="image/*" style={{ display:"none" }} onChange={e => handleFile(part.id, e.target.files[0])} />
        {!img && (
          <div style={{ position:"absolute", top:10, left:10, background:"#fef2f2", color:"#ef4444",
            border:"1px solid #fecaca", borderRadius:999, padding:"2px 8px",
            fontFamily:"'DM Sans',sans-serif", fontSize:10, fontWeight:700, textTransform:"uppercase", letterSpacing:0.6 }}>Required</div>
        )}
        {img ? (
          <div style={{ position:"relative" }}>
            <img src={img} alt={part.label} style={{ width:"100%", height:160, objectFit:"cover", display:"block" }} />
            <div style={{ position:"absolute", top:8, right:8, background:"#10b981", borderRadius:999,
              padding:"3px 10px", color:"#fff", fontSize:11, fontWeight:700, fontFamily:"'DM Sans',sans-serif" }}>✓ Uploaded</div>
            <div style={{ padding:"12px 14px" }}>
              <div style={{ fontFamily:"'DM Sans',sans-serif", fontWeight:600, color:"#0f172a", fontSize:14 }}>{part.icon} {part.label}</div>
            </div>
          </div>
        ) : (
          <div style={{ padding:"28px 20px 20px", display:"flex", flexDirection:"column", alignItems:"center", gap:12, minHeight:200, justifyContent:"center" }}>
            <div style={{ fontSize:40 }}>{part.icon}</div>
            <div style={{ textAlign:"center" }}>
              <div style={{ fontFamily:"'DM Sans',sans-serif", fontWeight:600, color:"#1e293b", fontSize:14 }}>{part.label}</div>
              <div style={{ fontFamily:"'DM Sans',sans-serif", color:"#94a3b8", fontSize:12, marginTop:4 }}>{part.description}</div>
              <div style={{ display:"inline-block", marginTop:8, background:"#e0f2fe", color:"#0284c7",
                borderRadius:999, padding:"3px 10px", fontSize:11, fontWeight:600 }}>{part.hint}</div>
            </div>
            <div style={{ fontFamily:"'DM Sans',sans-serif", fontSize:12, color:"#cbd5e1" }}>Click or drag & drop</div>
          </div>
        )}
      </label>
    );
  };

  return (
    <div style={{ minHeight:"100vh", background:"linear-gradient(135deg,#f0f9ff 0%,#e0f2fe 50%,#f0fdf4 100%)" }}>
      <link href="https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=DM+Sans:wght@400;500;600&display=swap" rel="stylesheet" />
      <div style={{ maxWidth:900, margin:"0 auto", padding:"0 24px 48px" }}>
        <div style={{ textAlign:"center", paddingTop:40 }}>
          <h1 style={{ fontFamily:"'Syne',sans-serif", fontSize:"clamp(2rem,5vw,3.2rem)", fontWeight:800, color:"#0f172a", margin:0, lineHeight:1.1 }}>
            Swasthya<span style={{ color:"#0ea5e9" }}>Scan</span>
          </h1>
          <p style={{ fontFamily:"'DM Sans',sans-serif", color:"#64748b", marginTop:10, fontSize:16, maxWidth:480, margin:"10px auto 0" }}>
            AI-powered health screening through visual biomarkers & symptom analysis
          </p>
        </div>

        <StepIndicator current={0} />

        <div style={{ background:"#fff", borderRadius:20, padding:"32px", boxShadow:"0 4px 24px rgba(0,0,0,.07)", marginTop:24, border:"1px solid #e2e8f0" }}>
          <div style={{ marginBottom:24 }}>
            <h2 style={{ fontFamily:"'Syne',sans-serif", fontSize:22, fontWeight:700, color:"#0f172a", margin:0 }}>Upload Health Indicator Images</h2>
            <p style={{ fontFamily:"'DM Sans',sans-serif", color:"#64748b", marginTop:6, fontSize:14 }}>
              Upload at least one image to continue. All 5 photos give the highest accuracy.
            </p>
            <div style={{ display:"flex", gap:8, marginTop:12, flexWrap:"wrap" }}>
              <div style={{ padding:"4px 12px", borderRadius:999,
                background: uploadedRequired===requiredParts.length?"#f0fdf4":"#fef2f2",
                border:`1px solid ${uploadedRequired===requiredParts.length?"#a7f3d0":"#fecaca"}`,
                fontFamily:"'DM Sans',sans-serif", fontSize:12, fontWeight:600,
                color: uploadedRequired===requiredParts.length?"#10b981":"#ef4444" }}>
                {uploadedRequired===requiredParts.length?"✓":"⚠️"} {uploadedRequired}/{requiredParts.length} photos uploaded
              </div>
            </div>
          </div>

          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(190px,1fr))", gap:16 }}>
            {BODY_PARTS.map(renderCard)}
          </div>

          {error && (
            <div style={{ marginTop:20, padding:"12px 16px", background:"#fef2f2", border:"1px solid #fecaca",
              borderRadius:10, fontFamily:"'DM Sans',sans-serif", fontSize:13, color:"#991b1b" }}>
              ❌ {error}
            </div>
          )}

          {!canProceed && !loading && (
            <div style={{ marginTop:20, padding:"12px 16px", background:"#fef9c3", border:"1px solid #fde68a",
              borderRadius:10, fontFamily:"'DM Sans',sans-serif", fontSize:13, color:"#92400e" }}>
              ⚠️ Upload at least one image to proceed
            </div>
          )}

          <button onClick={handleSubmit} disabled={!canProceed}
            style={{
              width:"100%", marginTop:28, padding:"16px", borderRadius:14,
              background: canProceed ? "linear-gradient(135deg,#0ea5e9,#0284c7)" : "#e2e8f0",
              color: canProceed ? "#fff" : "#94a3b8", border:"none", cursor:canProceed?"pointer":"not-allowed",
              fontFamily:"'DM Sans',sans-serif", fontWeight:700, fontSize:16,
              boxShadow: canProceed?"0 4px 16px rgba(14,165,233,.35)":"none", transition:"all .2s",
            }}>
            {loading ? "🔄 Analysing images…" : "Continue to Symptom Questionnaire →"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── PAGE 2: QUESTIONNAIRE ────────────────────────────────────────────────────
function QuestionnairePage({ onNext, onBack, predictResult }) {
  const [answers, setAnswers] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Build active questions from /predict response
  // predictResult.questions is [{id, text, options}] from question_bank.py
  // We merge with QUESTION_META for icon/category display
  const activeQuestions = (predictResult?.questions || []).map(q => ({
    ...q,
    qid: q.id,
    ...(QUESTION_META[q.id] || {}),
  }));

  const answered   = Object.keys(answers).length;
  const progress   = activeQuestions.length > 0 ? Math.round((answered / activeQuestions.length) * 100) : 0;
  const deficiencyOrder = ["iron", "b12", "zinc", "protein"];

  const optionColor = (opt) => {
    if (opt==="Yes"||opt==="Often")   return { border:"#ef4444", bg:"#fef2f2", dot:"#ef4444" };
    if (opt==="Sometimes")             return { border:"#f59e0b", bg:"#fffbeb", dot:"#f59e0b" };
    if (opt==="No"||opt==="Never")    return { border:"#10b981", bg:"#f0fdf4", dot:"#10b981" };
    return { border:"#0ea5e9", bg:"#e0f2fe", dot:"#0ea5e9" };
  };

  const handleAnalyze = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/score`, {
        method:"POST",
        headers:{ "Content-Type":"application/json" },
        body: JSON.stringify({
          answers,
          probabilities:          predictResult.probabilities,
          selected_deficiencies:  predictResult.selected_deficiencies,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || `Server error ${res.status}`);
      }
      const scoreData = await res.json();
      onNext(scoreData);
    } catch (e) {
      setError(e.message || "Could not reach the server.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight:"100vh", background:"linear-gradient(135deg,#f0f9ff 0%,#e0f2fe 50%,#f0fdf4 100%)" }}>
      <link href="https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=DM+Sans:wght@400;500;600&display=swap" rel="stylesheet" />
      <div style={{ maxWidth:740, margin:"0 auto", padding:"0 24px 48px" }}>
        <div style={{ textAlign:"center", paddingTop:36 }}>
          <h1 style={{ fontFamily:"'Syne',sans-serif", fontSize:"clamp(1.6rem,4vw,2.4rem)", fontWeight:800, color:"#0f172a", margin:0 }}>
            Swasthya<span style={{ color:"#0ea5e9" }}>Scan</span>
          </h1>
        </div>

        <StepIndicator current={1} />

        {/* Show which deficiencies were detected from images */}
        {predictResult?.selected_deficiencies?.length > 0 && (
          <div style={{ background:"#f0f9ff", border:"1px solid #bae6fd", borderRadius:12,
            padding:"12px 16px", marginTop:16, display:"flex", gap:10, flexWrap:"wrap", alignItems:"center" }}>
            <span style={{ fontFamily:"'DM Sans',sans-serif", fontSize:13, color:"#0c4a6e", fontWeight:600 }}>
              🔍 Image analysis detected:
            </span>
            {predictResult.selected_deficiencies.map(d => (
              <span key={d} style={{ background:"#0ea5e9", color:"#fff", borderRadius:999,
                padding:"3px 12px", fontSize:12, fontWeight:700, fontFamily:"'DM Sans',sans-serif" }}>
                {DEFICIENCY_LABELS[d] || d}
              </span>
            ))}
            {predictResult.demo_mode && (
              <span style={{ fontFamily:"'DM Sans',sans-serif", fontSize:11, color:"#64748b", fontStyle:"italic" }}>
                (demo mode — model not loaded)
              </span>
            )}
          </div>
        )}

        <div style={{ background:"#fff", borderRadius:20, padding:"32px", boxShadow:"0 4px 24px rgba(0,0,0,.07)", marginTop:16, border:"1px solid #e2e8f0" }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:8, flexWrap:"wrap", gap:8 }}>
            <div>
              <h2 style={{ fontFamily:"'Syne',sans-serif", fontSize:22, fontWeight:700, color:"#0f172a", margin:0 }}>Symptom Questionnaire</h2>
              <p style={{ fontFamily:"'DM Sans',sans-serif", color:"#64748b", marginTop:4, fontSize:14, margin:"6px 0 0" }}>
                {answered} of {activeQuestions.length} answered — tailored to your image results
              </p>
            </div>
            <div style={{ textAlign:"right" }}>
              <div style={{ fontFamily:"'DM Sans',sans-serif", fontWeight:700, fontSize:22, color:"#0ea5e9" }}>{progress}%</div>
              <div style={{ fontFamily:"'DM Sans',sans-serif", fontSize:11, color:"#94a3b8" }}>Complete</div>
            </div>
          </div>

          <div style={{ background:"#e2e8f0", borderRadius:999, height:6, marginBottom:28, overflow:"hidden" }}>
            <div style={{ width:`${progress}%`, background:"linear-gradient(90deg,#0ea5e9,#10b981)", height:"100%", borderRadius:999, transition:"width .5s ease" }} />
          </div>

          {deficiencyOrder.map(def => {
            const group = activeQuestions.filter(q => q.deficiency === def);
            if (group.length === 0) return null;
            return (
              <div key={def} style={{ marginBottom:28 }}>
                <div style={{ fontFamily:"'Syne',sans-serif", fontWeight:700, fontSize:14, color:"#0f172a",
                  marginBottom:12, paddingBottom:8, borderBottom:"1.5px solid #e2e8f0",
                  display:"flex", alignItems:"center", gap:8 }}>
                  <span style={{ background:"#e0f2fe", color:"#0284c7", borderRadius:999, padding:"2px 10px", fontSize:11, fontWeight:700 }}>
                    {DEFICIENCY_LABELS[def]}
                  </span>
                </div>
                <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
                  {group.map((q, i) => {
                    const isAnswered = !!answers[q.qid];
                    const opts = q.options && typeof q.options === 'object' && !Array.isArray(q.options)
                     ? OPTION_ORDER.filter(o => Object.keys(q.options).includes(o))
                     : (QUESTION_META[q.qid]?.options || q.options || []);
                    return (
                      <div key={q.qid} style={{ padding:"18px", borderRadius:14,
                        background:isAnswered?"#f0f9ff":"#f8fafc",
                        border:`1.5px solid ${isAnswered?"#bae6fd":"#e2e8f0"}`, transition:"all .2s" }}>
                        <div style={{ display:"flex", gap:12, marginBottom:12, alignItems:"flex-start" }}>
                          <div style={{ minWidth:26, height:26, background:isAnswered?"#0ea5e9":"#e2e8f0",
                            borderRadius:"50%", display:"flex", alignItems:"center", justifyContent:"center",
                            color:isAnswered?"#fff":"#94a3b8", fontFamily:"'DM Sans',sans-serif",
                            fontWeight:700, fontSize:11, transition:"all .2s", flexShrink:0 }}>
                            {isAnswered?"✓":i+1}
                          </div>
                          <div style={{ flex:1 }}>
                            <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:4, flexWrap:"wrap" }}>
                              <span style={{ fontSize:15 }}>{q.icon || "🔍"}</span>
                              <div style={{ fontFamily:"'DM Sans',sans-serif", fontSize:11, fontWeight:600,
                                color:"#0ea5e9", textTransform:"uppercase", letterSpacing:0.8 }}>{q.category || ""}</div>
                            </div>
                            <div style={{ fontFamily:"'DM Sans',sans-serif", fontWeight:600, color:"#1e293b", fontSize:14, lineHeight:1.5 }}>{q.text}</div>
                          </div>
                        </div>
                        <div style={{ display:"flex", gap:10, paddingLeft:38, flexWrap:"wrap" }}>
                          {opts.map(opt => {
                            const selected = answers[q.qid]===opt;
                            const c = optionColor(opt);
                            return (
                              <label key={opt} style={{ display:"flex", alignItems:"center", gap:8, cursor:"pointer",
                                padding:"7px 16px", borderRadius:999, border:`2px solid ${selected?c.border:"#e2e8f0"}`,
                                background:selected?c.bg:"#fff", transition:"all .15s" }}>
                                <input type="radio" name={q.qid} value={opt} checked={selected}
                                  onChange={() => setAnswers(a => ({ ...a, [q.qid]:opt }))} style={{ display:"none" }} />
                                <div style={{ width:13, height:13, borderRadius:"50%", border:`2px solid ${selected?c.dot:"#cbd5e1"}`,
                                  background:selected?c.dot:"transparent", transition:"all .15s" }} />
                                <span style={{ fontFamily:"'DM Sans',sans-serif", fontWeight:600, fontSize:13,
                                  color:selected?"#1e293b":"#64748b" }}>{opt}</span>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}

          {error && (
            <div style={{ marginTop:16, padding:"12px 16px", background:"#fef2f2", border:"1px solid #fecaca",
              borderRadius:10, fontFamily:"'DM Sans',sans-serif", fontSize:13, color:"#991b1b" }}>
              ❌ {error}
            </div>
          )}

          <div style={{ display:"flex", gap:12, marginTop:24 }}>
            <button onClick={onBack} style={{ padding:"14px 28px", borderRadius:12, border:"2px solid #e2e8f0",
              background:"#fff", fontFamily:"'DM Sans',sans-serif", fontWeight:700, fontSize:15, color:"#64748b", cursor:"pointer" }}>
              ← Back
            </button>
            <button onClick={handleAnalyze} disabled={answered===0||loading}
              style={{ flex:1, padding:"14px", borderRadius:12,
                background: answered>0&&!loading ? "linear-gradient(135deg,#0ea5e9,#0284c7)" : "#e2e8f0",
                color: answered>0&&!loading?"#fff":"#94a3b8", border:"none",
                cursor: answered>0&&!loading?"pointer":"not-allowed",
                fontFamily:"'DM Sans',sans-serif", fontWeight:700, fontSize:16,
                boxShadow: answered>0?"0 4px 16px rgba(14,165,233,.35)":"none", transition:"all .2s" }}>
              {loading ? "🔄 Calculating scores…" : "Analyze Results →"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── LOADING SCREEN ───────────────────────────────────────────────────────────
function LoadingScreen() {
  const steps = ["Processing uploaded images…","Running biomarker analysis…","Evaluating symptom patterns…","Generating risk assessment…","Preparing your report…"];
  const [step, setStep] = useState(0);
  const [progress, setProgress] = useState(0);
  useEffect(() => {
    const iv = setInterval(() => setProgress(p => Math.min(p+1.4,100)), 50);
    const sv = setInterval(() => setStep(s => Math.min(s+1,steps.length-1)), 900);
    return () => { clearInterval(iv); clearInterval(sv); };
  }, []);
  return (
    <div style={{ minHeight:"100vh", background:"linear-gradient(135deg,#0f172a 0%,#0c2340 60%,#064e3b 100%)",
      display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:32 }}>
      <link href="https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=DM+Sans:wght@400;500;600&display=swap" rel="stylesheet" />
      <div style={{ textAlign:"center" }}>
        <div style={{ fontSize:56, marginBottom:16 }}>🫀</div>
        <h1 style={{ fontFamily:"'Syne',sans-serif", fontSize:32, fontWeight:800, color:"#f0f9ff", margin:0 }}>
          Swasthya<span style={{ color:"#38bdf8" }}>Scan</span>
        </h1>
        <p style={{ fontFamily:"'DM Sans',sans-serif", color:"#94a3b8", marginTop:8, fontSize:15 }}>Analysing your health indicators</p>
      </div>
      <div style={{ width:320, background:"rgba(255,255,255,.08)", borderRadius:20, padding:28, border:"1px solid rgba(255,255,255,.1)" }}>
        {steps.map((s, i) => (
          <div key={s} style={{ display:"flex", alignItems:"center", gap:12, padding:"8px 0", opacity:i<=step?1:0.3, transition:"opacity .4s" }}>
            <div style={{ width:20, height:20, borderRadius:"50%", background:i<step?"#34d399":i===step?"#38bdf8":"rgba(255,255,255,.2)",
              display:"flex", alignItems:"center", justifyContent:"center", fontSize:10, transition:"all .4s", flexShrink:0 }}>
              {i<step?"✓":"·"}
            </div>
            <span style={{ fontFamily:"'DM Sans',sans-serif", fontSize:13, color:i<=step?"#e2e8f0":"#64748b", fontWeight:i===step?600:400 }}>{s}</span>
          </div>
        ))}
        <div style={{ marginTop:20, background:"rgba(255,255,255,.1)", borderRadius:999, height:6, overflow:"hidden" }}>
          <div style={{ width:`${progress}%`, background:"linear-gradient(90deg,#38bdf8,#34d399)", height:"100%", borderRadius:999, transition:"width .3s linear" }} />
        </div>
        <div style={{ textAlign:"right", marginTop:6, fontFamily:"'DM Sans',sans-serif", fontSize:12, color:"#64748b" }}>{Math.round(progress)}%</div>
      </div>
    </div>
  );
}

// ─── PAGE 3: DASHBOARD ────────────────────────────────────────────────────────
function DashboardPage({ onRestart, scoreResult }) {
  const { risk_cards = [], confidence = {}, recommendations = [], symptom_scores = {} } = scoreResult || {};

  const hasHighRisk = risk_cards.some(c => c.level === 3);

  return (
    <div style={{ minHeight:"100vh", background:"#f1f5f9" }}>
      <link href="https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=DM+Sans:wght@400;500;600&display=swap" rel="stylesheet" />

      <div style={{ background:"#fff", borderBottom:"1px solid #e2e8f0", padding:"16px 24px",
        display:"flex", justifyContent:"space-between", alignItems:"center", flexWrap:"wrap", gap:12 }}>
        <div>
          <h1 style={{ fontFamily:"'Syne',sans-serif", fontSize:24, fontWeight:800, color:"#0f172a", margin:0 }}>
            Swasthya<span style={{ color:"#0ea5e9" }}>Scan</span>
          </h1>
          <div style={{ fontFamily:"'DM Sans',sans-serif", fontSize:13, color:"#64748b", marginTop:2 }}>
            Health Screening Report · {new Date().toLocaleDateString("en-IN",{day:"numeric",month:"long",year:"numeric"})}
          </div>
        </div>
        <div style={{ display:"flex", gap:12, alignItems:"center" }}>
          {hasHighRisk && (
            <div style={{ padding:"6px 16px", background:"#fef2f2", border:"1px solid #fecaca",
              borderRadius:999, fontFamily:"'DM Sans',sans-serif", fontSize:13, fontWeight:700, color:"#ef4444" }}>
              ⚠️ High Risk Detected
            </div>
          )}
          <button onClick={onRestart} style={{ padding:"8px 20px", borderRadius:10, border:"2px solid #e2e8f0",
            background:"#fff", fontFamily:"'DM Sans',sans-serif", fontWeight:700, fontSize:13, color:"#64748b", cursor:"pointer" }}>
            New Screening
          </button>
        </div>
      </div>

      <div style={{ maxWidth:1200, margin:"0 auto", padding:"28px 24px 60px" }}>
        <StepIndicator current={2} />

        {/* Risk Cards — live from API */}
        <div style={{ marginTop:28 }}>
          <h2 style={{ fontFamily:"'Syne',sans-serif", fontSize:18, fontWeight:700, color:"#0f172a", margin:"0 0 14px" }}>Health Risk Indicators</h2>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(220px,1fr))", gap:14 }}>
            {risk_cards.map(card => (
              <div key={card.id} style={{ background:"#fff", borderRadius:16, padding:"20px",
                border:`1.5px solid ${card.border}`, boxShadow:"0 2px 10px rgba(0,0,0,.05)", position:"relative", overflow:"hidden" }}>
                <div style={{ position:"absolute", top:0, right:0, width:80, height:80,
                  background:card.bg, borderRadius:"0 16px 0 80px",
                  display:"flex", alignItems:"flex-start", justifyContent:"flex-end", padding:"12px 14px", fontSize:22 }}>{card.icon}</div>
                <div style={{ fontFamily:"'DM Sans',sans-serif", fontSize:12, color:"#64748b",
                  fontWeight:600, textTransform:"uppercase", letterSpacing:0.8, marginBottom:8 }}>{card.id.toUpperCase()}</div>
                <div style={{ fontFamily:"'DM Sans',sans-serif", fontWeight:700, color:"#0f172a",
                  fontSize:15, lineHeight:1.3, marginBottom:12, paddingRight:40 }}>{card.label}</div>
                <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:10 }}>
                  <div style={{ padding:"4px 12px", borderRadius:999, background:card.bg,
                    border:`1.5px solid ${card.border}`, fontFamily:"'DM Sans',sans-serif",
                    fontWeight:800, fontSize:13, color:card.color }}>{card.status}</div>
                  <div style={{ fontFamily:"'DM Sans',sans-serif", fontSize:12, color:"#94a3b8" }}>
                    img: {card.image_prob}%
                  </div>
                </div>
                <div style={{ display:"flex", gap:4 }}>
                  {[1,2,3].map(l => <div key={l} style={{ flex:1, height:5, borderRadius:999,
                    background:l<=card.level?card.color:"#e2e8f0", transition:"background .3s" }} />)}
                </div>
                <div style={{ fontFamily:"'DM Sans',sans-serif", fontSize:11, color:"#94a3b8", marginTop:8 }}>{card.detail}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Confidence + Breakdown */}
        <div style={{ marginTop:28, display:"grid", gridTemplateColumns:"1fr 1fr", gap:16 }}>
          <div style={{ background:"#fff", borderRadius:16, padding:"28px", border:"1.5px solid #e2e8f0", boxShadow:"0 2px 10px rgba(0,0,0,.05)" }}>
            <h3 style={{ fontFamily:"'Syne',sans-serif", fontSize:16, fontWeight:700, color:"#0f172a", margin:"0 0 20px" }}>Confidence Scores</h3>
            <div style={{ display:"flex", justifyContent:"space-around", flexWrap:"wrap", gap:16 }}>
              <CircularProgress value={confidence.image   || 0} color="#0ea5e9" label="Image Analysis" />
              <CircularProgress value={confidence.symptom || 0} color="#8b5cf6" label="Symptom Analysis" />
              <CircularProgress value={confidence.overall || 0} color="#ef4444" size={130} strokeWidth={10} label="Overall Risk" />
            </div>
          </div>

          <div style={{ background:"#fff", borderRadius:16, padding:"28px", border:"1.5px solid #e2e8f0", boxShadow:"0 2px 10px rgba(0,0,0,.05)" }}>
            <h3 style={{ fontFamily:"'Syne',sans-serif", fontSize:16, fontWeight:700, color:"#0f172a", margin:"0 0 20px" }}>Risk Breakdown</h3>
            {risk_cards.map(card => (
              <div key={card.id} style={{ marginBottom:14 }}>
                <div style={{ display:"flex", justifyContent:"space-between", marginBottom:5 }}>
                  <span style={{ fontFamily:"'DM Sans',sans-serif", fontSize:13, fontWeight:600, color:"#1e293b" }}>{card.icon} {card.label}</span>
                  <span style={{ fontFamily:"'DM Sans',sans-serif", fontSize:13, fontWeight:700, color:card.color }}>{card.score_pct}%</span>
                </div>
                <AnimatedBar value={card.score_pct} color={card.color} />
              </div>
            ))}
          </div>
        </div>

        {/* Recommendations — live from API */}
        <div style={{ marginTop:24 }}>
          <h2 style={{ fontFamily:"'Syne',sans-serif", fontSize:18, fontWeight:700, color:"#0f172a", margin:"0 0 14px" }}>Personalised Recommendations</h2>
          <div style={{ background:"#fff", borderRadius:16, padding:"24px", border:"1.5px solid #e2e8f0", boxShadow:"0 2px 10px rgba(0,0,0,.05)" }}>
            <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(280px,1fr))", gap:14 }}>
              {recommendations.map((rec, i) => (
                <div key={i} style={{ display:"flex", gap:14, padding:"16px", background:"#f8fafc", borderRadius:12, border:"1px solid #e2e8f0", alignItems:"flex-start" }}>
                  <div style={{ fontSize:24, flexShrink:0 }}>{rec.icon}</div>
                  <div>
                    <div style={{ fontFamily:"'DM Sans',sans-serif", fontSize:11, fontWeight:700,
                      color:"#0ea5e9", textTransform:"uppercase", letterSpacing:0.8, marginBottom:4 }}>{rec.category}</div>
                    <div style={{ fontFamily:"'DM Sans',sans-serif", fontSize:14, color:"#334155", lineHeight:1.5 }}>{rec.text}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Disclaimer */}
        <div style={{ marginTop:24, padding:"16px 20px", background:"#f0f9ff", border:"1px solid #bae6fd",
          borderRadius:12, display:"flex", gap:12, alignItems:"flex-start" }}>
          <span style={{ fontSize:18, flexShrink:0 }}>ℹ️</span>
          <p style={{ fontFamily:"'DM Sans',sans-serif", fontSize:13, color:"#0c4a6e", margin:0, lineHeight:1.6 }}>
            <strong>Medical Disclaimer:</strong> SwasthyaScan is an AI-assisted screening tool and is <strong>not a substitute</strong> for professional medical diagnosis or advice.
            Results should be used as a preliminary indicator only. Please consult a qualified healthcare professional before making any dietary, supplement, or lifestyle changes.
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── APP SHELL ────────────────────────────────────────────────────────────────
export default function App() {
  const [page, setPage]               = useState("upload");
  const [predictResult, setPredictResult] = useState(null);   // from /predict
  const [scoreResult, setScoreResult]     = useState(null);   // from /score

  const handleUploadNext = (data) => {
    setPredictResult(data);
    setPage("questions");
  };

  const handleQuestionnaireNext = (data) => {
    setScoreResult(data);
    setPage("loading");
    setTimeout(() => setPage("dashboard"), 4000);
  };

  const handleRestart = () => {
    setPredictResult(null);
    setScoreResult(null);
    setPage("upload");
  };

  if (page==="upload")    return <UploadPage onNext={handleUploadNext} />;
  if (page==="questions") return <QuestionnairePage onNext={handleQuestionnaireNext} onBack={() => setPage("upload")} predictResult={predictResult} />;
  if (page==="loading")   return <LoadingScreen />;
  if (page==="dashboard") return <DashboardPage onRestart={handleRestart} scoreResult={scoreResult} />;
}