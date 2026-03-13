from fastapi.middleware.cors import CORSMiddleware
from fastapi import FastAPI, UploadFile, File, Form
import json
from typing import Optional

from ai_selector import select_deficiencies
from question_selector import get_questions
from score_engine import calculate_score

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Temporary mock AI prediction
# Your AI teammate will replace this later with the TensorFlow model
def predict_deficiencies(image_bytes):

    return {
        "iron": 0.72,
        "b12": 0.63,
        "zinc": 0.21,
        "protein": 0.18
    }


@app.post("/analyze")
async def analyze_health(
    file: UploadFile = File(...),
    questionnaire: Optional[str] = Form(None)
):

    # Read uploaded image
    image_bytes = await file.read()

    # Step 1: AI prediction
    ai_prediction = predict_deficiencies(image_bytes)

    # Step 2: choose most likely deficiencies
    predicted_deficiencies = select_deficiencies(ai_prediction)

    # Step 3: fetch relevant questions
    questions = get_questions(predicted_deficiencies)

    # Step 4: parse questionnaire answers
    answers = {}

    if questionnaire:
        try:
            answers = json.loads(questionnaire)
        except Exception:
            answers = {}

    # Step 5: compute questionnaire scores
    questionnaire_scores = calculate_score(answers, questions)

    # Step 6: return results
    return {
        "ai_prediction": ai_prediction,
        "selected_deficiencies": predicted_deficiencies,
        "questions": questions,
        "questionnaire_scores": questionnaire_scores
    }
