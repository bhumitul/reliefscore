"""
app.py - Optimized Flask backend
Scores are calculated ONCE at startup using the trained model,
then served instantly to the frontend.
"""

from flask import Flask, jsonify, request
from flask_cors import CORS
import pandas as pd
import numpy as np
import pickle
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "*"}})

# -----------------------------------------------------------
# EMAIL CONFIG — fill these in ⚠️
# -----------------------------------------------------------
SENDER_EMAIL = "jainpreetisha@gmail.com"       # ← your Gmail address
SENDER_PASSWORD = "ickl uixo bhhg nofx"     # ← 16-char App Password

def send_email(to_email, citizen_name, compensation_amount, aadhaar):
    subject = "Your Flood Relief Compensation Has Been Approved - ReliefScore"
    body = f"""Dear {citizen_name},

We are pleased to inform you that your flood relief compensation has been approved.

Compensation Amount : Rs.{compensation_amount:,}
Aadhaar (last 4)    : XXXX-XXXX-{str(aadhaar)[-4:]}
Status              : APPROVED

The amount will be credited to your registered bank account shortly.

If you have any questions, please contact your district relief office.

Regards,
ReliefScore Team
Government Flood Relief Portal
"""
    try:
        msg = MIMEMultipart()
        msg["From"] = SENDER_EMAIL
        msg["To"] = to_email
        msg["Subject"] = subject
        msg.attach(MIMEText(body, "plain"))

        with smtplib.SMTP_SSL("smtp.gmail.com", 465) as server:
            server.login(SENDER_EMAIL, SENDER_PASSWORD)
            server.sendmail(SENDER_EMAIL, to_email, msg.as_string())

        return {"success": True, "message": f"Email sent to {to_email}"}
    except Exception as e:
        return {"success": False, "error": str(e)}

# -----------------------------------------------------------
# LOAD MODEL AND DATA ON STARTUP
# -----------------------------------------------------------
print("Loading model and data...")

with open("model.pkl", "rb") as f:
    bundle = pickle.load(f)

model = bundle["model"]
FEATURES = bundle["features"]
le_livelihood = bundle["le_livelihood"]
le_house = bundle["le_house"]
feature_importance = bundle["feature_importance"]

df = pd.read_csv("citizens.csv")

# -----------------------------------------------------------
# PRE-CALCULATE ALL SCORES AT STARTUP
# -----------------------------------------------------------
print("Pre-calculating vulnerability scores for all citizens...")

def assign_tier(score):
    if score >= 75: return "Critical"
    if score >= 50: return "High"
    if score >= 25: return "Medium"
    return "Low"

def assign_compensation(score, income_cat):
    comp_table = {
        "poor":         [100000, 75000, 40000, 15000],
        "lower_middle": [ 75000, 50000, 30000, 10000],
        "middle":       [ 50000, 35000, 20000,  5000],
        "upper_middle": [ 25000, 15000, 10000,     0],
        "rich":         [ 10000,  5000,     0,     0],
    }
    tier_index = {"Critical": 0, "High": 1, "Medium": 2, "Low": 3}
    tier = assign_tier(score)
    return comp_table.get(income_cat, [0,0,0,0])[tier_index[tier]]

df["livelihood_encoded"] = le_livelihood.transform(df["livelihood"])
df["house_type_encoded"] = le_house.transform(df["house_type"])

X = df[FEATURES].values
all_scores = model.predict(X)
all_scores = np.clip(all_scores, 0, 100)

df["vulnerability_score"] = np.round(all_scores, 1)
df["priority_tier"] = df["vulnerability_score"].apply(assign_tier)
df["compensation_inr"] = df.apply(
    lambda r: assign_compensation(r["vulnerability_score"], r["income_category"]), axis=1
)

print(f"Done! {len(df)} citizens scored and ready.")

def row_to_dict(row):
    livelihood_raw = row["livelihood"]
    return {
        "aadhaar": row["aadhaar"],
        "name": row["name"],
        "age": int(row["age"]),
        "phone": str(row["phone"]),
        "email": str(row["email"]),
        "district": row["district"],
        "income_category": row["income_category"].replace("_", " ").title(),
        "annual_income": int(row["annual_income"]),
        "livelihood": livelihood_raw.replace("_", " ").title(),
        "land_owned": float(row["land_owned"]),
        "house_type": row["house_type"].replace("_", " ").title(),
        "house_ownership": row["house_ownership"],
        "dependents": int(row["dependents"]),
        "is_sole_earner": bool(row["is_sole_earner"]),
        "has_insurance": bool(row["has_insurance"]),
        "savings_months": float(row["savings_months"]),
        "employer_support": bool(row["employer_support"]),
        "family_support": bool(row["family_support"]),
        "previously_excluded": bool(row["previously_excluded"]),
        "flood_severity": int(row["flood_severity"]),
        "vulnerability_score": float(row["vulnerability_score"]),
        "priority_tier": row["priority_tier"],
        "compensation_inr": int(row["compensation_inr"]),
        "uniform_compensation": 25000,
        "score_breakdown": {
            "flood_zone_impact": int(row["flood_severity"]),
            "livelihood_loss": int(row["is_sole_earner"]) * 5 + (
                {"daily_wage": 20, "farmer": 17, "small_business": 14,
                 "salaried_private": 8, "salaried_govt": 3, "business_owner": 10}
                .get(livelihood_raw, 10)
            ),
            "dependent_burden": (
                15 if row["dependents"] >= 5
                else 10 if row["dependents"] >= 3
                else 5 if row["dependents"] >= 1 else 0
            ),
            "recovery_capacity_reduction": -(
                (15 if row["has_insurance"] else 0) +
                (10 if row["savings_months"] >= 6 else 5 if row["savings_months"] >= 3 else 0) +
                (8 if row["employer_support"] else 0) +
                (5 if row["family_support"] else 0)
            ),
        }
    }

ALL_CITIZENS = [row_to_dict(row) for _, row in df.iterrows()]
ALL_CITIZENS.sort(key=lambda x: x["vulnerability_score"], reverse=True)
print("Citizens list ready to serve instantly.")

# -----------------------------------------------------------
# ROUTES
# -----------------------------------------------------------

@app.route("/citizens", methods=["GET"])
def get_all_citizens():
    result = ALL_CITIZENS
    tier_filter = request.args.get("tier")
    district_filter = request.args.get("district")
    income_filter = request.args.get("income")
    if tier_filter:
        result = [c for c in result if c["priority_tier"] == tier_filter]
    if district_filter:
        result = [c for c in result if district_filter in c["district"]]
    if income_filter:
        result = [c for c in result if c["income_category"].lower().replace(" ", "_") == income_filter]
    return jsonify({"citizens": result, "total": len(result)})

@app.route("/predict", methods=["POST"])
def predict():
    data = request.get_json()
    aadhaar = data.get("aadhaar", "").strip()
    if not aadhaar:
        return jsonify({"error": "Aadhaar number is required"}), 400
    match = next((c for c in ALL_CITIZENS if c["aadhaar"] == aadhaar), None)
    if not match:
        return jsonify({"error": "Citizen not found. Please verify your Aadhaar number."}), 404
    return jsonify({"citizen": match})

# -----------------------------------------------------------
# ADMIN APPROVE ROUTE WITH EMAIL
# -----------------------------------------------------------
@app.route("/approve", methods=["POST"])
def approve_compensation():
    data = request.get_json()
    aadhaar = data.get("aadhaar", "").strip()

    if not aadhaar:
        return jsonify({"error": "Aadhaar number is required"}), 400

    citizen = next((c for c in ALL_CITIZENS if c["aadhaar"] == aadhaar), None)

    if not citizen:
        return jsonify({"error": "Citizen not found"}), 404

    email_result = send_email(
        to_email=citizen["email"],
        citizen_name=citizen["name"],
        compensation_amount=citizen["compensation_inr"],
        aadhaar=citizen["aadhaar"]
    )

    return jsonify({
        "status": "approved",
        "citizen": citizen["name"],
        "compensation_inr": citizen["compensation_inr"],
        "email_sent": email_result
    })

@app.route("/feature-importance", methods=["GET"])
def get_feature_importance():
    label_map = {
        "flood_severity": "Flood Zone Severity",
        "land_owned": "Land Ownership",
        "dependents": "Number of Dependents",
        "is_sole_earner": "Sole Earner Status",
        "has_insurance": "Insurance Coverage",
        "savings_months": "Savings Buffer",
        "employer_support": "Employer Support",
        "family_support": "Family Support Network",
        "previously_excluded": "Historical Exclusion",
        "livelihood_encoded": "Livelihood Type",
        "house_type_encoded": "Housing Type",
    }
    readable = [
        {"feature": label_map.get(item["feature"], item["feature"]),
         "importance": round(item["importance"] * 100, 1)}
        for item in feature_importance
    ]
    return jsonify({"feature_importance": readable})

@app.route("/stats", methods=["GET"])
def get_stats():
    total_compensation = sum(c["compensation_inr"] for c in ALL_CITIZENS)
    tier_counts = {}
    for c in ALL_CITIZENS:
        tier_counts[c["priority_tier"]] = tier_counts.get(c["priority_tier"], 0) + 1
    avg_score_by_income = {}
    for c in ALL_CITIZENS:
        cat = c["income_category"]
        if cat not in avg_score_by_income:
            avg_score_by_income[cat] = []
        avg_score_by_income[cat].append(c["vulnerability_score"])
    avg_score_by_income = {k: round(sum(v)/len(v), 1) for k, v in avg_score_by_income.items()}
    return jsonify({
        "total_citizens": len(ALL_CITIZENS),
        "total_relief_budget": total_compensation,
        "tier_distribution": tier_counts,
        "avg_score_by_income": avg_score_by_income,
        "uniform_total_cost": len(ALL_CITIZENS) * 25000,
    })

if __name__ == "__main__":
    print("\nStarting Flask server on http://localhost:5000")
    app.run(debug=True, port=5000)