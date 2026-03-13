from question_selector import get_questions
from score_engine import calculate_score

def run_questionnaire(predicted_deficiencies, answers):

    # get relevant questions
    questions = get_questions(predicted_deficiencies)

    # calculate questionnaire score
    score = calculate_score(answers, questions)

    return score