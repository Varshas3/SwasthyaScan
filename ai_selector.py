def select_deficiencies(ai_prediction, threshold=0.45, max_deficiencies=3):
    """
    Select which deficiencies to screen for.

    Image-model deficiencies (iron, b12, zinc, dehydration) are chosen based on
    the model's predicted probabilities.

    Dehydration has no image-model class (visual biomarkers are too subtle to
    detect reliably from the five uploaded photos), so it is always appended as
    a symptom-only screener.  This means the questionnaire will always include
    the 5 dehydration questions regardless of image results.
    """

    # ── Step 1: filter image-model deficiencies by threshold ──────────────
    image_deficiencies = {
        deficiency: prob
        for deficiency, prob in ai_prediction.items()
        if prob >= threshold
    }

    # ── Step 2: sort by probability (highest first) ────────────────────────
    sorted_def = sorted(
        image_deficiencies.items(),
        key=lambda x: x[1],
        reverse=True,
    )

    # ── Step 3: take up to max_deficiencies from the image model ──────────
    selected = [d[0] for d in sorted_def[:max_deficiencies]]

    # ── Step 4: fallback — if nothing clears the threshold, take the top 1 ─
    if not selected:
        sorted_all = sorted(
            ai_prediction.items(),
            key=lambda x: x[1],
            reverse=True,
        )
        selected = [sorted_all[0][0]]

    # ── Step 5: always append dehydration as a symptom-only screener ──────
    if "dehydration" not in selected:
        selected.append("dehydration")

    return selected