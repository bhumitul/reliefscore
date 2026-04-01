from flask import Flask, request, jsonify
from flask_cors import CORS
import pandas as pd
import numpy as np
import pickle
import os
import uuid
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from datetime import datetime

app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "*"}})

# ── Email Config ───────────────────────────────────────────────────────────────
SENDER_EMAIL    = "jainpreetisha@gmail.com"
SENDER_PASSWORD = "ickl uixo bhhg nofx"

def send_relief_email(to_email, citizen_name, compensation_amount, aadhaar):
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
        msg["From"]    = SENDER_EMAIL
        msg["To"]      = to_email
        msg["Subject"] = subject
        msg.attach(MIMEText(body, "plain"))
        with smtplib.SMTP_SSL("smtp.gmail.com", 465) as server:
            server.login(SENDER_EMAIL, SENDER_PASSWORD)
            server.sendmail(SENDER_EMAIL, to_email, msg.as_string())
        return {"success": True, "message": f"Email sent to {to_email}"}
    except Exception as e:
        return {"success": False, "error": str(e)}

def send_grievance_email(to_email, citizen_name, complaint_id, status, resolution_note):
    subject = f"Update on Your Complaint {complaint_id} - ReliefScore"
    body = f"""Dear {citizen_name},

Your complaint has been updated.

Complaint ID      : {complaint_id}
New Status        : {status}
"""
    if resolution_note:
        body += f"Official Response : {resolution_note}\n"
    body += """
If you have further questions, please contact your district relief office.

Regards,
ReliefScore Team
Government Flood Relief Portal
"""
    try:
        msg = MIMEMultipart()
        msg["From"]    = SENDER_EMAIL
        msg["To"]      = to_email
        msg["Subject"] = subject
        msg.attach(MIMEText(body, "plain"))
        with smtplib.SMTP_SSL("smtp.gmail.com", 465) as server:
            server.login(SENDER_EMAIL, SENDER_PASSWORD)
            server.sendmail(SENDER_EMAIL, to_email, msg.as_string())
        return {"success": True, "message": f"Email sent to {to_email}"}
    except Exception as e:
        return {"success": False, "error": str(e)}

# ── Load data & model ──────────────────────────────────────────────────────────
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
df = pd.read_csv(os.path.join(BASE_DIR, 'citizens.csv'))

pkl           = pickle.load(open(os.path.join(BASE_DIR, 'model.pkl'), 'rb'))
model         = pkl['model']
le_livelihood = pkl['le_livelihood']
le_house      = pkl['le_house']
FEATURES      = pkl['features']

TIER_BOUNDS  = {'Critical': (75, 100), 'High': (50, 74), 'Medium': (25, 49), 'Low': (0, 24)}
COMPENSATION = {
    'Critical': {'Poor': 100000, 'Lower Middle': 75000, 'Middle': 50000, 'Upper Middle': 25000, 'Rich': 0},
    'High':     {'Poor': 75000,  'Lower Middle': 50000, 'Middle': 35000, 'Upper Middle': 15000, 'Rich': 0},
    'Medium':   {'Poor': 50000,  'Lower Middle': 35000, 'Middle': 20000, 'Upper Middle': 10000, 'Rich': 0},
    'Low':      {'Poor': 25000,  'Lower Middle': 15000, 'Middle': 10000, 'Upper Middle': 5000,  'Rich': 0},
}

grievances = []

# ── Helpers ────────────────────────────────────────────────────────────────────
def encode_row(row):
    try:
        liv_enc = le_livelihood.transform([str(row.get('livelihood', ''))])[0]
    except Exception:
        liv_enc = 0
    try:
        house_enc = le_house.transform([str(row.get('house_type', ''))])[0]
    except Exception:
        house_enc = 0

    mapping = {
        'flood_severity':      float(row.get('flood_severity', 0)),
        'land_owned':          float(row.get('land_owned', 0)),
        'dependents':          float(row.get('dependents', 0)),
        'is_sole_earner':      float(row.get('is_sole_earner', 0)),
        'has_insurance':       float(row.get('has_insurance', 0)),
        'savings_months':      float(row.get('savings_months', 0)),
        'employer_support':    float(row.get('employer_support', 0)),
        'family_support':      float(row.get('family_support', 0)),
        'previously_excluded': float(row.get('previously_excluded', 0)),
        'livelihood_encoded':  float(liv_enc),
        'house_type_encoded':  float(house_enc),
    }
    return pd.DataFrame([mapping])

def score_row(row):
    X     = encode_row(row)
    score = float(model.predict(X)[0])
    score = max(0, min(100, score))
    tier  = 'Low'
    for t, (lo, hi) in TIER_BOUNDS.items():
        if lo <= score <= hi:
            tier = t
            break
    comp = COMPENSATION[tier].get(str(row.get('income_category', 'Poor')).title(), 0)
    return round(score, 1), tier, comp

def build_citizen(row):
    score, tier, comp = score_row(row)
    return {
        'aadhaar':             str(row.get('aadhaar', '')),
        'name':                str(row.get('name', '')),
        'age':                 int(row.get('age', 0)),
        'email':               str(row.get('email', '')),
        'phone':               str(row.get('phone', '')),
        'district':            str(row.get('district', '')),
        'income_category':     str(row.get('income_category', '')),
        'livelihood':          str(row.get('livelihood', '')),
        'dependents':          int(row.get('dependents', 0)),
        'vulnerability_score': score,
        'priority_tier':       tier,
        'compensation_inr':    comp,
        'score_breakdown': {
            'flood_zone_impact':           round(float(row.get('flood_severity', 0)) * 1.2, 1),
            'livelihood_loss':             round((1 - float(row.get('employer_support', 0))) * 15, 1),
            'dependent_burden':            round(float(row.get('dependents', 0)) * 2.5, 1),
            'recovery_capacity_reduction': round(
                (1 - float(row.get('has_insurance', 0))) * 10 +
                max(0, 3 - float(row.get('savings_months', 0))) * 3, 1),
        }
    }

print("Pre-computing vulnerability scores…")
all_citizens = [build_citizen(row) for _, row in df.iterrows()]
all_citizens.sort(key=lambda c: c['vulnerability_score'], reverse=True)
print(f"Done — {len(all_citizens)} citizens ready.")

# ── Routes ─────────────────────────────────────────────────────────────────────
@app.route('/predict', methods=['POST'])
def predict():
    data    = request.get_json()
    aadhaar = str(data.get('aadhaar', '')).strip()
    mask    = df['aadhaar'].astype(str).str.strip() == aadhaar
    if not mask.any():
        return jsonify({'error': 'Aadhaar not found. Please check the number and try again.'}), 404
    return jsonify({'citizen': build_citizen(df[mask].iloc[0])})

@app.route('/citizens')
def get_all_citizens():
    return jsonify({'citizens': all_citizens, 'total': len(all_citizens)})

@app.route('/stats')
def stats():
    total_ai    = sum(c['compensation_inr'] for c in all_citizens)
    tier_counts = {}
    for c in all_citizens:
        tier_counts[c['priority_tier']] = tier_counts.get(c['priority_tier'], 0) + 1
    poor = [c['vulnerability_score'] for c in all_citizens if c['income_category'] == 'Poor']
    rich = [c['vulnerability_score'] for c in all_citizens if c['income_category'] == 'Rich']
    return jsonify({
        'total_citizens':  len(all_citizens),
        'total_ai_budget': total_ai,
        'total_uniform':   len(all_citizens) * 25000,
        'tier_counts':     tier_counts,
        'poor_avg_score':  round(np.mean(poor), 1) if poor else 0,
        'rich_avg_score':  round(np.mean(rich), 1) if rich else 0,
    })

# ── Approve + send relief email ────────────────────────────────────────────────
@app.route('/approve', methods=['POST'])
def approve_compensation():
    data    = request.get_json()
    aadhaar = str(data.get('aadhaar', '')).strip()
    if not aadhaar:
        return jsonify({'error': 'Aadhaar number is required'}), 400
    citizen = next((c for c in all_citizens if c['aadhaar'] == aadhaar), None)
    if not citizen:
        return jsonify({'error': 'Citizen not found'}), 404
    email_result = send_relief_email(
        to_email=citizen['email'],
        citizen_name=citizen['name'],
        compensation_amount=citizen['compensation_inr'],
        aadhaar=citizen['aadhaar']
    )
    return jsonify({
        'status':           'approved',
        'citizen':          citizen['name'],
        'compensation_inr': citizen['compensation_inr'],
        'email_sent':       email_result
    })

# ── Grievances ─────────────────────────────────────────────────────────────────
@app.route('/grievance', methods=['POST'])
def submit_grievance():
    data = request.get_json()
    for field in ['aadhaar', 'name', 'category', 'description']:
        if not data.get(field, '').strip():
            return jsonify({'error': f'Missing required field: {field}'}), 400
    complaint_id = 'GRV-' + str(uuid.uuid4())[:8].upper()
    grievances.append({
        'complaint_id':    complaint_id,
        'aadhaar':         data['aadhaar'].strip(),
        'name':            data['name'].strip(),
        'phone':           data.get('phone', '').strip(),
        'category':        data['category'].strip(),
        'subcategory':     data.get('subcategory', '').strip(),
        'description':     data['description'].strip(),
        'is_urgent':       data.get('is_urgent', False),
        'documents':       data.get('documents', []),
        'status':          'Pending',
        'resolution_note': '',
        'submitted_at':    datetime.now().strftime('%d %b %Y, %I:%M %p'),
        'updated_at':      datetime.now().strftime('%d %b %Y, %I:%M %p'),
    })
    return jsonify({'success': True, 'complaint_id': complaint_id}), 201

@app.route('/grievance/track', methods=['POST'])
def track_grievance():
    aadhaar = request.get_json().get('aadhaar', '').strip()
    return jsonify({'complaints': [g for g in grievances if g['aadhaar'] == aadhaar]})

@app.route('/grievances', methods=['GET'])
def get_grievances():
    return jsonify({'grievances': grievances, 'total': len(grievances)})

@app.route('/grievance/<complaint_id>', methods=['PATCH'])
def update_grievance(complaint_id):
    data = request.get_json()
    for g in grievances:
        if g['complaint_id'] == complaint_id:
            if 'status'          in data: g['status']          = data['status']
            if 'resolution_note' in data: g['resolution_note'] = data['resolution_note']
            g['updated_at'] = datetime.now().strftime('%d %b %Y, %I:%M %p')

            # Auto-email citizen when grievance status is updated
            citizen = next((c for c in all_citizens if c['aadhaar'] == g['aadhaar']), None)
            if citizen and citizen.get('email'):
                send_grievance_email(
                    to_email=citizen['email'],
                    citizen_name=g['name'],
                    complaint_id=complaint_id,
                    status=g['status'],
                    resolution_note=g.get('resolution_note', '')
                )

            return jsonify({'success': True, 'grievance': g})
    return jsonify({'error': 'Complaint not found'}), 404

if __name__ == '__main__':
    print("Starting Flask server on http://localhost:5000")
    app.run(debug=True, port=5000)