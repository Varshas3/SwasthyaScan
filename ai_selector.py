def select_deficiencies(ai_prediction, threshold=0.45, max_deficiencies=3):

    # Step 1: filter based on threshold
    filtered = {
        deficiency: prob
        for deficiency, prob in ai_prediction.items()
        if prob >= threshold
    }

    # Step 2: sort by probability (highest first)
    sorted_def = sorted(
        filtered.items(),
        key=lambda x: x[1],
        reverse=True
    )

    # Step 3: select up to max_deficiencies
    selected = [d[0] for d in sorted_def[:max_deficiencies]]

    # Step 4: fallback if nothing passes threshold
    if not selected:
        sorted_all = sorted(
            ai_prediction.items(),
            key=lambda x: x[1],
            reverse=True
        )
        selected = [sorted_all[0][0]]

    return selected