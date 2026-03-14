# Run this before executing the script:
# pip install tensorflow opencv-python matplotlib scikit-learn

import os
import tensorflow as tf
from tensorflow.keras.preprocessing import image_dataset_from_directory
from tensorflow.keras import layers, models, regularizers
from tensorflow.keras.applications import MobileNetV2
from tensorflow.keras.applications.mobilenet_v2 import preprocess_input
from tensorflow.keras.callbacks import EarlyStopping, ReduceLROnPlateau
import matplotlib.pyplot as plt

# --- 1. Dataset Parameters ---
DATA_DIR = "dataset"   # Adjust to your dataset folder
IMG_SIZE = (224, 224)
BATCH_SIZE = 32

print("Loading datasets...")
# --- 2. Load Datasets ---
train_ds = image_dataset_from_directory(
    DATA_DIR,
    validation_split=0.2,
    subset="training",
    seed=123,
    image_size=IMG_SIZE,
    batch_size=BATCH_SIZE
)

val_ds = image_dataset_from_directory(
    DATA_DIR,
    validation_split=0.2,
    subset="validation",
    seed=123,
    image_size=IMG_SIZE,
    batch_size=BATCH_SIZE
)

classes = train_ds.class_names
print("Classes:", classes)

# --- 3. Preprocessing & Performance ---
# CRITICAL: Use MobileNetV2's exact [-1, 1] preprocessing
train_ds = train_ds.map(lambda x, y: (preprocess_input(x), y))
val_ds = val_ds.map(lambda x, y: (preprocess_input(x), y))

# Cache and prefetch for faster training
AUTOTUNE = tf.data.AUTOTUNE
train_ds = train_ds.cache().shuffle(1000).prefetch(buffer_size=AUTOTUNE)
val_ds = val_ds.cache().prefetch(buffer_size=AUTOTUNE)

# --- 4. Model Architecture ---
data_augmentation = tf.keras.Sequential([
    layers.RandomFlip("horizontal"),
    layers.RandomRotation(0.15),
    layers.RandomZoom(0.2),
    layers.RandomContrast(0.1),
])

base_model = MobileNetV2(input_shape=IMG_SIZE + (3,), include_top=False, weights="imagenet")
base_model.trainable = False  # Freeze entirely for Phase 1

# Build using Functional API to protect Batch Normalization
inputs = tf.keras.Input(shape=IMG_SIZE + (3,))
x = data_augmentation(inputs)
x = base_model(x, training=False)  # Safely bypass Batch Normalization updates
x = layers.GlobalAveragePooling2D()(x)
x = layers.Dense(128, activation="relu", kernel_regularizer=regularizers.l2(0.01))(x)
x = layers.Dropout(0.5)(x)
outputs = layers.Dense(len(classes), activation="softmax")(x)

model = tf.keras.Model(inputs, outputs)

# --- 5. Phase 1: Train the Head ---
print("\n--- Phase 1: Training custom classification head ---")
model.compile(optimizer=tf.keras.optimizers.Adam(learning_rate=1e-3),
              loss="sparse_categorical_crossentropy",
              metrics=["accuracy"])

early_stop_1 = EarlyStopping(monitor="val_loss", patience=5, restore_best_weights=True)
reduce_lr_1 = ReduceLROnPlateau(monitor="val_loss", factor=0.2, patience=3, min_lr=1e-6)

history1 = model.fit(
    train_ds,
    validation_data=val_ds,
    epochs=15,
    callbacks=[early_stop_1, reduce_lr_1]
)

# --- 6. Phase 2: Fine-Tuning ---
print("\n--- Phase 2: Fine-tuning top layers ---")
base_model.trainable = True
# Unfreeze only the top 15 layers
for layer in base_model.layers[:-15]:
    layer.trainable = False

# Recompile with a very low learning rate
model.compile(optimizer=tf.keras.optimizers.Adam(learning_rate=1e-5),
              loss="sparse_categorical_crossentropy",
              metrics=["accuracy"])

early_stop_2 = EarlyStopping(monitor="val_loss", patience=5, restore_best_weights=True)
reduce_lr_2 = ReduceLROnPlateau(monitor="val_loss", factor=0.2, patience=3, min_lr=1e-7)

history2 = model.fit(
    train_ds,
    validation_data=val_ds,
    epochs=15,
    callbacks=[early_stop_2, reduce_lr_2]
)

# --- 7. Save Model ---
model.save("health_model.keras")
print("\n✅ Model saved successfully as health_model.keras")

# --- 8. Plotting the Results ---
acc = history1.history['accuracy'] + history2.history['accuracy']
val_acc = history1.history['val_accuracy'] + history2.history['val_accuracy']
loss = history1.history['loss'] + history2.history['loss']
val_loss = history1.history['val_loss'] + history2.history['val_loss']

plt.figure(figsize=(12, 5))

# Plot Accuracy
plt.subplot(1, 2, 1)
plt.plot(acc, label='Training Accuracy')
plt.plot(val_acc, label='Validation Accuracy')
plt.plot([len(history1.history['accuracy'])-1, len(history1.history['accuracy'])-1],
          plt.ylim(), label='Start Fine Tuning', color='gray', linestyle='--')
plt.legend(loc='lower right')
plt.title('Training and Validation Accuracy')

# Plot Loss
plt.subplot(1, 2, 2)
plt.plot(loss, label='Training Loss')
plt.plot(val_loss, label='Validation Loss')
plt.plot([len(history1.history['loss'])-1, len(history1.history['loss'])-1],
          plt.ylim(), label='Start Fine Tuning', color='gray', linestyle='--')
plt.legend(loc='upper right')
plt.title('Training and Validation Loss')

plt.tight_layout()
plt.savefig('training_history.png')
print("✅ Training plot saved as training_history.png")
plt.show()