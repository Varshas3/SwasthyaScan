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
from question_selector import get_questions


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
# ══════════════════════════════════════════════════════════════════════════

@app.post("/predict")
async def predict(
    nails: Optional[UploadFile] = File(None),
    eyes:  Optional[UploadFile] = File(None),
    tongue: Optional[UploadFile] = File(None),
    skin:  Optional[UploadFile] = File(None),
    lips:  Optional[UploadFile] = File(None),
):
    """
    Returns:
    {
      "probabilities": {"iron": 0.82, "protein": 0.55, "b12": 0.31, "zinc": 0.12},
      "selected_deficiencies": ["iron", "protein"],
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
    selected_deficiencies: list     # e.g. ["iron", "b12"]

@app.post("/score")
async def score(req: ScoreRequest):
    """
    Returns:
    {
      "symptom_scores": {"iron": 7, "b12": 3},
      "risk_levels":    {"iron": "High", "b12": "Low"},
      "confidence":     {"image": 78, "symptom": 65, "overall": 72},
      "risk_cards":     [...],        // ready to render in the dashboard
    }
    """
    # ── Score the questionnaire ───────────────────────────────────────────
    questions = get_questions(req.selected_deficiencies)
    symptom_scores = calculate_score(req.answers, questions)   # score_engine.py

    # ── Max possible score per deficiency (for normalisation) ─────────────
    MAX_SCORES = {
        "iron":    11,   # sum of all max option values in question_bank.py
        "b12":     14,
        "zinc":    15,
        "protein": 14,   # update once teammate adds protein questions
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
    # Image confidence = max probability across selected deficiencies (0-100)
    img_conf = int(max(
        (req.probabilities.get(d, 0) for d in req.selected_deficiencies),
        default=0
    ) * 100)

    # Symptom confidence = avg risk fraction across selected deficiencies
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

    # ── Build risk cards (matches frontend MOCK_RESULTS.riskCards shape) ──
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
    }

    LEVEL_MAP = {"High": 3, "Moderate": 2, "Low Risk": 1}

    risk_cards = []
    for def_key in req.selected_deficiencies:
        meta  = CARD_META.get(def_key, {})
        level_label = risk_levels.get(def_key, "Low Risk")
        level_num   = LEVEL_MAP[level_label]
        frac        = risk_fractions.get(def_key, 0)

        detail_key = {3: "detail_high", 2: "detail_mod", 1: "detail_low"}[level_num]
        risk_cards.append({
            "id":     def_key,
            "label":  meta.get("label", def_key),
            "status": level_label,
            "level":  level_num,
            "color":  meta.get("color", "#64748b"),
            "bg":     meta.get("bg", "#f8fafc"),
            "border": meta.get("border", "#e2e8f0"),
            "icon":   meta.get("icon", "🔬"),
            "detail": meta.get(detail_key, ""),
            "score_pct": int(frac * 100),
            "image_prob": int(req.probabilities.get(def_key, 0) * 100),
        })

    # ── Build personalised recommendations ───────────────────────────────
    RECS = {
        "iron": [
            {"category": "Tests",      "icon": "🔬", "text": "Check haemoglobin and serum ferritin levels"},
            {"category": "Diet",       "icon": "🥗", "text": "Increase iron-rich foods: spinach, lentils, red meat, fortified cereals"},
            {"category": "Tip",        "icon": "🍋", "text": "Pair iron-rich meals with Vitamin C to boost absorption"},
        ],
        "b12": [
            {"category": "Tests",      "icon": "🔬", "text": "Request serum B12 and MMA blood test"},
            {"category": "Supplements","icon": "💊", "text": "Discuss B12 supplementation or injections with your doctor"},
            {"category": "Diet",       "icon": "🥚", "text": "Add eggs, dairy, fish, and fortified cereals to your diet"},
        ],
        "zinc": [
            {"category": "Tests",      "icon": "🔬", "text": "Serum zinc or alkaline phosphatase test recommended"},
            {"category": "Diet",       "icon": "🌾", "text": "Include pumpkin seeds, meat, chickpeas, and cashews"},
            {"category": "Tip",        "icon": "⚠️",  "text": "Avoid excessive zinc supplements — toxicity is possible"},
        ],
        "protein": [
            {"category": "Diet",       "icon": "🥩", "text": "Target 0.8–1g of protein per kg of body weight daily"},
            {"category": "Diet",       "icon": "🫘", "text": "Include eggs, legumes, tofu, dairy, and lean meats"},
            {"category": "Follow-up",  "icon": "🏥", "text": "If oedema is present, consult a doctor promptly"},
        ],
    }

    recommendations = []
    for def_key in req.selected_deficiencies:
        recommendations.extend(RECS.get(def_key, []))

    # Always add a follow-up rec
    recommendations.append({
        "category": "Always",
        "icon": "🏥",
        "text": "Consult a qualified healthcare professional before making any dietary or supplement changes"
    })

    return {
        "symptom_scores":       symptom_scores,
        "risk_levels":          risk_levels,
        "confidence":           confidence,
        "risk_cards":           risk_cards,
        "recommendations":      recommendations,
    }


# ── Health check ───────────────────────────────────────────────────────────
@app.get("/health")
def health():
    return {
        "status": "ok",
        "model_loaded": model is not None,
        "tf_available": TF_AVAILABLE,
    }


# ── Run directly ───────────────────────────────────────────────────────────
if __name__ == "__main__":
    import uvicorn
    uvicorn.run("server:app", host="0.0.0.0", port=8000, reload=True)
