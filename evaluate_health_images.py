pip install tensorflow opencv-python matplotlib scikit-learn
import os
import cv2
import numpy as np
from tensorflow.keras.models import load_model
from tensorflow.keras.applications.mobilenet_v2 import preprocess_input

# 1. Define your updated classes (alphabetical order based on folder names)
classes = [
    "dehydration",             # Replaced protein with dehydration
    "iron_deficiency", 
    "vitamin_b12_deficiency", 
    "zinc_deficiency"
]

print("Loading model...")
model = load_model("health_model.keras")
print("Classes ready:", classes)

def preprocess_image(img_path):
    img = cv2.imread(img_path)
    if img is None:
        raise FileNotFoundError(f"Image not found: {img_path}")
    
    # Convert BGR to RGB and resize
    img = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
    img = cv2.resize(img, (224, 224))
    img = img.astype(np.float32)
    
    # Apply MobileNetV2 preprocessing [-1, 1]
    img = preprocess_input(img)
    return img

# 2. Simulate a single user uploading multiple body part images
# (e.g., their eyes, nails, and tongue)
user_uploaded_images = [
    'dataset/zinc_deficiency/1.jpg',
    'dataset/zinc_deficiency/12.jpg',
    'dataset/zinc_deficiency/6.jpg',
    'dataset/zinc_deficiency/25.jpg',
]

images, valid_paths = [], []
for path in user_uploaded_images:
    if os.path.exists(path):
        images.append(preprocess_image(path))
        valid_paths.append(path)
    else:
        print(f"⚠️ File does not exist: {path}")

if images:
    # 3. Predict all images at once
    batch = np.array(images, dtype=np.float32)
    raw_predictions = model.predict(batch)

    # 4. THE MAGIC: Average the probabilities across all uploaded images
    # axis=0 means we average down the columns (class by class)
    averaged_probs = np.mean(raw_predictions, axis=0)

    # 5. Display the final aggregated results
    print(f"\n🧠 Processed {len(valid_paths)} images.")
    print("=========================================")
    print("📊 OVERALL DEFICIENCY ANALYSIS (Averaged)")
    print("=========================================")
    
    # Sort the results so the highest probability is at the top
    results = {classes[i]: averaged_probs[i] for i in range(len(classes))}
    sorted_results = sorted(results.items(), key=lambda item: item[1], reverse=True)
    
    for deficiency, prob in sorted_results:
        # Convert to a readable percentage (e.g., 0.854 -> 85.4%)
        percentage = prob * 100
        print(f"👉 {deficiency.replace('_', ' ').title().ljust(25)}: {percentage:.1f}%")

    # Final definitive answer
    top_deficiency = sorted_results[0][0]
    print("\n⚠️ Primary Concern Identified:", top_deficiency.replace('_', ' ').title())
