def calculate_score(answers, questions):

    scores = {}

    for q in questions:

        qid = q["id"]

        # identify deficiency from question id
        deficiency = qid.split("_")[0]

        if deficiency not in scores:
            scores[deficiency] = 0

        if qid in answers:

            selected_option = answers[qid]

            if selected_option in q["options"]:
                scores[deficiency] += q["options"][selected_option]

    return scores