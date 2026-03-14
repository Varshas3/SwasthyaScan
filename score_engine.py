def calculate_score(answers, questions):

    scores = {}

    for q in questions:

        qid = q["id"]

        # identify deficiency safely from question id
        parts = qid.rsplit("_", 1)
        deficiency = parts[0] if len(parts) == 2 else qid

        if deficiency not in scores:
            scores[deficiency] = 0

        if qid in answers:

            selected_option = answers[qid]

            # ensure the selected option exists
            if selected_option in q["options"]:

                value = q["options"][selected_option]

                # ensure value is numeric before adding
                if isinstance(value, (int, float)):
                    scores[deficiency] += value

    return scores