"""
train_model.py
Trains a Random Forest model on the citizen dataset.
Run AFTER generate_data.py: python train_model.py

The model learns to predict vulnerability_score from citizen features.
We then use that score to assign tier + compensation.
"""

import pandas as pd
import numpy as np
import pickle
from sklearn.ensemble import RandomForestRegressor
from sklearn.model_selection import train_test_split
from sklearn.metrics import mean_absolute_error, r2_score
from sklearn.preprocessing import LabelEncoder

def train():
    print("Loading citizens.csv...")
    df = pd.read_csv("citizens.csv")

    # -----------------------------------------------------------
    # FEATURE ENGINEERING
    # These are the 11 signals our model uses to predict vulnerability
    # -----------------------------------------------------------
    FEATURES = [
        "flood_severity",      # Real NDMA district data
        "land_owned",          # 0 = most vulnerable
        "dependents",          # More dependents = higher burden
        "is_sole_earner",      # Binary — huge impact
        "has_insurance",       # Reduces vulnerability
        "savings_months",      # Months of savings buffer
        "employer_support",    # Employer keeps paying?
        "family_support",      # Support network?
        "previously_excluded", # Historical exclusion from schemes
        "livelihood_encoded",  # Encoded version of livelihood type
        "house_type_encoded",  # Encoded version of house type
    ]

    TARGET = "vulnerability_score"

    # -----------------------------------------------------------
    # ENCODE CATEGORICAL COLUMNS
    # Random Forest needs numbers, not strings
    # -----------------------------------------------------------
    le_livelihood = LabelEncoder()
    le_house = LabelEncoder()

    df["livelihood_encoded"] = le_livelihood.fit_transform(df["livelihood"])
    df["house_type_encoded"] = le_house.fit_transform(df["house_type"])

    X = df[FEATURES]
    y = df[TARGET]

    # -----------------------------------------------------------
    # TRAIN / TEST SPLIT (80% train, 20% test)
    # -----------------------------------------------------------
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42
    )

    print(f"Training on {len(X_train)} records, testing on {len(X_test)} records...")

    # -----------------------------------------------------------
    # RANDOM FOREST MODEL
    # n_estimators=100 means 100 decision trees vote together
    # max_depth=8 prevents overfitting on our small dataset
    # -----------------------------------------------------------
    model = RandomForestRegressor(
        n_estimators=100,
        max_depth=8,
        min_samples_split=5,
        random_state=42,
        n_jobs=-1  # use all CPU cores
    )

    model.fit(X_train, y_train)

    # -----------------------------------------------------------
    # EVALUATE THE MODEL
    # -----------------------------------------------------------
    y_pred = model.predict(X_test)
    mae = mean_absolute_error(y_test, y_pred)
    r2 = r2_score(y_test, y_pred)

    print(f"\nModel Performance:")
    print(f"  Mean Absolute Error: {mae:.2f} points (out of 100)")
    print(f"  R² Score: {r2:.3f} (1.0 = perfect)")

    # -----------------------------------------------------------
    # FEATURE IMPORTANCE — your secret weapon with judges
    # Shows WHICH factors the model found most important
    # -----------------------------------------------------------
    importances = model.feature_importances_
    importance_df = pd.DataFrame({
        "feature": FEATURES,
        "importance": importances
    }).sort_values("importance", ascending=False)

    print(f"\nFeature Importance (what the model learned matters most):")
    for _, row in importance_df.iterrows():
        bar = "█" * int(row["importance"] * 50)
        print(f"  {row['feature']:25s} {bar} {row['importance']:.3f}")

    # -----------------------------------------------------------
    # SAVE EVERYTHING
    # We save the model + encoders together so app.py can use them
    # -----------------------------------------------------------
    model_bundle = {
        "model": model,
        "features": FEATURES,
        "le_livelihood": le_livelihood,
        "le_house": le_house,
        "feature_importance": importance_df.to_dict("records"),
    }

    with open("model.pkl", "wb") as f:
        pickle.dump(model_bundle, f)

    print(f"\nModel saved to model.pkl")
    print("You can now run app.py")

if __name__ == "__main__":
    train()
