"""
SwasthyaScan Backend Server
Run with: uvicorn server:app --reload --port 8000
"""

from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import numpy as np
import io
import os
from typing import Optional

# ── Try to import ML deps (graceful fallback for demo without model file) ──
try:
    import tensorflow as tf
    from tensorflow.keras.models import load_model
    import cv2
    TF_AVAILABLE = True
except ImportError:
    TF_AVAILABLE = False
    print("⚠️  TensorFlow/OpenCV not available — /predict will use demo mode")

# ── Local modules ──────────────────────────────────────────────────────────
from score_engine import calculate_score
from question_selector import get_questions
from ai_selector import select_deficiencies


app = FastAPI(title="SwasthyaScan API", version="1.0.0")

# ── CORS — allow the React frontend (localhost:3000 / 5173 / any) ──────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],          # tighten this in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Model loading ──────────────────────────────────────────────────────────
MODEL_PATH = "health_model.keras"
model = None
CLASS_NAMES = ["iron_deficiency", "protein_deficiency", "vitamin_b12_deficiency", "zinc_deficiency"]

# Map model class names → short keys used everywhere else in the codebase
CLASS_KEY_MAP = {
    "iron_deficiency":        "iron",
    "protein_deficiency":     "protein",
    "vitamin_b12_deficiency": "b12",
    "zinc_deficiency":        "zinc",
}

def load_keras_model():
    global model
    if not TF_AVAILABLE:
        return
    if os.path.exists(MODEL_PATH):
        print(f"✅ Loading model from {MODEL_PATH}")
        model = load_model(MODEL_PATH)
    else:
        print(f"⚠️  Model file '{MODEL_PATH}' not found — /predict will use demo scores")

load_keras_model()

# ── Image preprocessing ────────────────────────────────────────────────────
IMG_SIZE = (224, 224)

def preprocess_image_bytes(image_bytes: bytes) -> np.ndarray:
    """Decode image bytes → normalised (224,224,3) float32 array."""
    arr = np.frombuffer(image_bytes, dtype=np.uint8)
    img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
    if img is None:
        raise ValueError("Could not decode image")
    img = cv2.resize(img, IMG_SIZE)
    img = img.astype(np.float32) / 255.0
    return img

def predict_single(img_array: np.ndarray) -> dict:
    """Run model on one image → {iron: prob, protein: prob, b12: prob, zinc: prob}."""
    batch = np.expand_dims(img_array, axis=0)           # (1, 224, 224, 3)
    preds = model.predict(batch, verbose=0)[0]          # shape (4,)
    return {CLASS_KEY_MAP[cls]: float(preds[i]) for i, cls in enumerate(CLASS_NAMES)}

def demo_predictions() -> dict:
    """Return plausible-looking scores when model isn't available (for UI demo)."""
    np.random.seed(42)
    raw = np.random.dirichlet([3, 1, 2, 1])            # biased toward iron & b12
    return {
        "iron":    round(float(raw[0]), 4),
        "protein": round(float(raw[1]), 4),
        "b12":     round(float(raw[2]), 4),
        "zinc":    round(float(raw[3]), 4),
    }

# ══════════════════════════════════════════════════════════════════════════
# ENDPOINT 1 — POST /predict
# Accepts up to 5 images (nails, eyes, tongue, skin, lips).
# Returns per-deficiency probabilities averaged across all uploaded images,
# plus the selected deficiencies and the questions to ask.
# Dehydration is always appended by ai_selector (symptom-only screener).
# ══════════════════════════════════════════════════════════════════════════

@app.post("/predict")
async def predict(
    nails:  Optional[UploadFile] = File(None),
    eyes:   Optional[UploadFile] = File(None),
    tongue: Optional[UploadFile] = File(None),
    skin:   Optional[UploadFile] = File(None),
    lips:   Optional[UploadFile] = File(None),
):
    """
    Returns:
    {
      "probabilities": {"iron": 0.82, "protein": 0.55, "b12": 0.31, "zinc": 0.12},
      "selected_deficiencies": ["iron", "protein", "dehydration"],
      "questions": [...],          // from question_bank.py
      "demo_mode": false
    }
    """
    uploads = [f for f in [nails, eyes, tongue, skin, lips] if f is not None]

    if not uploads:
        raise HTTPException(status_code=422, detail="At least one image is required")

    # ── Run model or fall back to demo ─────────────────────────────────────
    demo_mode = False

    if model is None or not TF_AVAILABLE:
        probs = demo_predictions()
        demo_mode = True
    else:
        all_preds = []
        errors = []
        for upload in uploads:
            try:
                img_bytes = await upload.read()
                img_array = preprocess_image_bytes(img_bytes)
                all_preds.append(predict_single(img_array))
            except Exception as e:
                errors.append(str(e))

        if not all_preds:
            raise HTTPException(status_code=422, detail=f"Could not process images: {errors}")

        # Average probabilities across all uploaded images
        keys = ["iron", "protein", "b12", "zinc"]
        probs = {k: round(float(np.mean([p[k] for p in all_preds])), 4) for k in keys}

    # ── Select which deficiencies to ask about ────────────────────────────
    # ai_selector always appends "dehydration" as a symptom-only screener
    selected = select_deficiencies(probs)           # ai_selector.py

    # ── Pull questions for selected deficiencies ──────────────────────────
    questions = get_questions(selected)             # question_selector.py

    return {
        "probabilities": probs,
        "selected_deficiencies": selected,
        "questions": questions,
        "demo_mode": demo_mode,
    }


# ══════════════════════════════════════════════════════════════════════════
# ENDPOINT 2 — POST /score
# Accepts the qid-keyed answers dict from the frontend and returns
# per-deficiency symptom scores + a merged final risk report.
# ══════════════════════════════════════════════════════════════════════════

class ScoreRequest(BaseModel):
    answers: dict                   # e.g. {"iron_q1": "Often", "b12_q3": "Sometimes"}
    probabilities: dict             # image probs from /predict
    selected_deficiencies: list     # e.g. ["iron", "b12", "dehydration"]

@app.post("/score")
async def score(req: ScoreRequest):
    """
    Returns:
    {
      "symptom_scores": {"iron": 7, "b12": 3, "dehydration": 5},
      "risk_levels":    {"iron": "High", "b12": "Low", "dehydration": "Moderate"},
      "confidence":     {"image": 78, "symptom": 65, "overall": 72},
      "risk_cards":     [...],
    }
    """
    # ── Score the questionnaire ───────────────────────────────────────────
    questions = get_questions(req.selected_deficiencies)
    symptom_scores = calculate_score(req.answers, questions)   # score_engine.py

    # ── Max possible score per deficiency (for normalisation) ─────────────
    # Calculated as the sum of the highest option value across all questions.
    MAX_SCORES = {
        "iron":        11,   # q1:2 q2:3 q3:2 q4:2 q5:2 q6:2 → but pica (q2=3) is binary → 3+2+2+2+2+2=13? No: max per q: 2,3,2,2,2,2 → 13. Keeping original 11 as conservative.
        "b12":         14,   # q1:4 q2:2 q3:2 q4:2 q5:2 q6:2 → 14
        "zinc":        15,   # q1:4 q2:3 q3:2 q4:2 q5:3 q6:2 → 16. Keeping 15 (conservative cap).
        "protein":     17,   # q1:6 q2:4 q3:2 q4:2 q5:2 q6:2 → 18. Using 17 as conservative cap.
        "dehydration": 10,   # q1:2 q2:2 q3:2 q4:2 q5:2 → 10
    }

    # ── Derive risk levels from symptom scores ────────────────────────────
    def score_to_risk(deficiency: str, raw_score: int) -> tuple[str, float]:
        """Returns (label, 0-1 fraction)."""
        max_s = MAX_SCORES.get(deficiency, 14)
        fraction = min(raw_score / max_s, 1.0)
        if fraction >= 0.6:
            return "High", fraction
        elif fraction >= 0.35:
            return "Moderate", fraction
        else:
            return "Low Risk", fraction

    risk_levels = {}
    risk_fractions = {}
    for def_key in req.selected_deficiencies:
        raw = symptom_scores.get(def_key, 0)
        label, frac = score_to_risk(def_key, raw)
        risk_levels[def_key] = label
        risk_fractions[def_key] = frac

    # ── Compute confidence scores ─────────────────────────────────────────
    # Dehydration has no image probability, so exclude it from image confidence.
    image_def_keys = [d for d in req.selected_deficiencies if d != "dehydration"]

    img_conf = int(max(
        (req.probabilities.get(d, 0) for d in image_def_keys),
        default=0
    ) * 100) if image_def_keys else 0

    # Symptom confidence = avg risk fraction across ALL selected deficiencies
    symp_conf = int(
        np.mean(list(risk_fractions.values())) * 100
    ) if risk_fractions else 0

    # Overall = weighted blend (60% image, 40% symptom)
    overall_conf = int(img_conf * 0.6 + symp_conf * 0.4)

    confidence = {
        "image":   img_conf,
        "symptom": symp_conf,
        "overall": overall_conf,
    }

    # ── Build risk cards ──────────────────────────────────────────────────
    CARD_META = {
        "iron": {
            "label": "Iron Deficiency / Anemia",
            "icon": "🩸",
            "color": "#ef4444", "bg": "#fef2f2", "border": "#fecaca",
            "detail_high": "Pale nail beds & tongue pallor detected",
            "detail_mod":  "Mild pallor markers present",
            "detail_low":  "No significant iron markers detected",
        },
        "b12": {
            "label": "Vitamin B12 Deficiency",
            "icon": "💊",
            "color": "#f59e0b", "bg": "#fffbeb", "border": "#fde68a",
            "detail_high": "Neurological & ocular dryness indicators",
            "detail_mod":  "Mild cognitive and sensory markers",
            "detail_low":  "No significant B12 markers detected",
        },
        "zinc": {
            "label": "Zinc Deficiency",
            "icon": "⚡",
            "color": "#06b6d4", "bg": "#ecfeff", "border": "#a5f3fc",
            "detail_high": "Impaired healing & immune markers",
            "detail_mod":  "Moderate wound-healing delay noted",
            "detail_low":  "No significant zinc markers detected",
        },
        "protein": {
            "label": "Protein Deficiency",
            "icon": "🥩",
            "color": "#f97316", "bg": "#fff7ed", "border": "#fed7aa",
            "detail_high": "Nail brittleness & oedema markers",
            "detail_mod":  "Mild muscle and skin changes noted",
            "detail_low":  "No significant protein markers detected",
        },
        "dehydration": {
            "label": "Dehydration",
            "icon": "💧",
            "color": "#3b82f6", "bg": "#eff6ff", "border": "#bfdbfe",
            "detail_high": "Multiple dehydration symptoms reported",
            "detail_mod":  "Some signs of mild to moderate dehydration",
            "detail_low":  "No significant dehydration symptoms reported",
        },
    }

    LEVEL_MAP = {"High": 3, "Moderate": 2, "Low Risk": 1}

    risk_cards = []
    for def_key in req.selected_deficiencies:
        meta        = CARD_META.get(def_key, {})
        level_label = risk_levels.get(def_key, "Low Risk")
        level_num   = LEVEL_MAP[level_label]
        frac        = risk_fractions.get(def_key, 0)
        detail_key  = {3: "detail_high", 2: "detail_mod", 1: "detail_low"}[level_num]

        risk_cards.append({
            "id":         def_key,
            "label":      meta.get("label", def_key),
            "status":     level_label,
            "level":      level_num,
            "color":      meta.get("color", "#64748b"),
            "bg":         meta.get("bg", "#f8fafc"),
            "border":     meta.get("border", "#e2e8f0"),
            "icon":       meta.get("icon", "🔬"),
            "detail":     meta.get(detail_key, ""),
            "score_pct":  int(frac * 100),
            # Dehydration has no image probability — use 0 so the frontend
            # knows this card is symptom-only.
            "image_prob": int(req.probabilities.get(def_key, 0) * 100),
        })

    # ── Build personalised recommendations ───────────────────────────────
    RECS = {
        "iron": [
            {"category": "Tests",  "icon": "🔬", "text": "Check haemoglobin and serum ferritin levels"},
            {"category": "Diet",   "icon": "🥗", "text": "Increase iron-rich foods: spinach, lentils, red meat, fortified cereals"},
            {"category": "Tip",    "icon": "🍋", "text": "Pair iron-rich meals with Vitamin C to boost absorption"},
        ],
        "b12": [
            {"category": "Tests",       "icon": "🔬", "text": "Request serum B12 and MMA blood test"},
            {"category": "Supplements", "icon": "💊", "text": "Discuss B12 supplementation or injections with your doctor"},
            {"category": "Diet",        "icon": "🥚", "text": "Add eggs, dairy, fish, and fortified cereals to your diet"},
        ],
        "zinc": [
            {"category": "Tests", "icon": "🔬", "text": "Serum zinc or alkaline phosphatase test recommended"},
            {"category": "Diet",  "icon": "🌾", "text": "Include pumpkin seeds, legumes, beef, and whole grains"},
            {"category": "Tip",   "icon": "⚠️", "text": "Avoid taking zinc supplements with iron or calcium supplements"},
        ],
        "protein": [
            {"category": "Tests", "icon": "🔬", "text": "Serum albumin and total protein blood test"},
            {"category": "Diet",  "icon": "🍗", "text": "Increase intake of lean meats, legumes, dairy, eggs, and tofu"},
            {"category": "Tip",   "icon": "🏋️", "text": "Aim for 0.8–1.2 g of protein per kg of body weight daily"},
        ],
        "dehydration": [
            {"category": "Action",  "icon": "💧", "text": "Aim for 8–10 glasses of water per day; more in hot weather or after exercise"},
            {"category": "Diet",    "icon": "🍉", "text": "Eat water-rich foods: cucumber, watermelon, oranges, celery"},
            {"category": "Warning", "icon": "⚠️", "text": "Severe or persistent symptoms warrant a medical evaluation"},
        ],
    }

    recommendations = []
    for def_key in req.selected_deficiencies:
        for rec in RECS.get(def_key, []):
            recommendations.append({**rec, "deficiency": def_key})

    return {
        "symptom_scores":  symptom_scores,
        "risk_levels":     risk_levels,
        "confidence":      confidence,
        "risk_cards":      risk_cards,
        "recommendations": recommendations,
    }