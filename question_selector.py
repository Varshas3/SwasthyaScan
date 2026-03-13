from backend.question_bank import question_bank

def get_questions(predicted_deficiencies):

    questions_to_ask = []

    for deficiency in predicted_deficiencies:

        if deficiency in question_bank:
            questions_to_ask.extend(question_bank[deficiency])

    return questions_to_ask