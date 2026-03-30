"""
generate_data.py
Generates 500 synthetic citizen records modelled on:
- SECC 2011 socio-economic patterns
- NDMA 2022-23 flood-affected district data
- RBI Household Finance Survey 2019 (savings behavior)
- IRDAI 2023 (insurance penetration by income bracket)

Run this ONCE: python generate_data.py
It creates citizens.csv which the model trains on.
"""

import pandas as pd
import numpy as np
import random

random.seed(42)
np.random.seed(42)

# -----------------------------------------------------------
# Real NDMA 2023 flood-affected districts + severity (0-30)
# -----------------------------------------------------------
DISTRICTS = {
    "Darbhanga, Bihar": 28,
    "Araria, Bihar": 26,
    "Morigaon, Assam": 25,
    "Srikakulam, Andhra Pradesh": 22,
    "Alappuzha, Kerala": 20,
}

# -----------------------------------------------------------
# Income categories and their realistic profile probabilities
# Based on India's actual income distribution in flood zones
# Source: RBI HFS 2019, Census 2011
# -----------------------------------------------------------
INCOME_CATEGORIES = ["poor", "lower_middle", "middle", "upper_middle", "rich"]

# Probability of each income group appearing in flood-prone rural/semi-urban areas
INCOME_WEIGHTS = [0.40, 0.28, 0.18, 0.10, 0.04]

# Livelihood type probabilities per income group
# Source: SECC 2011 - occupation distribution
LIVELIHOOD_MAP = {
    "poor":         ["daily_wage", "daily_wage", "daily_wage", "farmer"],
    "lower_middle": ["daily_wage", "farmer", "farmer", "small_business"],
    "middle":       ["farmer", "small_business", "salaried_private", "salaried_private"],
    "upper_middle": ["salaried_private", "salaried_govt", "small_business", "salaried_govt"],
    "rich":         ["salaried_govt", "business_owner", "business_owner", "salaried_govt"],
}

# Annual income ranges (INR) per category - NDMA/Census informed
INCOME_RANGE = {
    "poor":         (30000, 80000),
    "lower_middle": (80000, 180000),
    "middle":       (180000, 400000),
    "upper_middle": (400000, 800000),
    "rich":         (800000, 3000000),
}

# House type probabilities per income - Census 2011 Housing
HOUSE_TYPE_MAP = {
    "poor":         ["kutcha", "kutcha", "semi_pucca"],
    "lower_middle": ["kutcha", "semi_pucca", "semi_pucca"],
    "middle":       ["semi_pucca", "semi_pucca", "pucca"],
    "upper_middle": ["semi_pucca", "pucca", "pucca"],
    "rich":         ["pucca", "pucca", "pucca"],
}

# Insurance probability per income - IRDAI Annual Report 2023
INSURANCE_PROB = {
    "poor": 0.04,
    "lower_middle": 0.12,
    "middle": 0.31,
    "upper_middle": 0.58,
    "rich": 0.82,
}

# Savings (months of income saved) per income - RBI HFS 2019
SAVINGS_RANGE = {
    "poor":         (0, 1),
    "lower_middle": (0, 3),
    "middle":       (1, 6),
    "upper_middle": (3, 12),
    "rich":         (6, 24),
}

# -----------------------------------------------------------
# Name banks (realistic Indian names for each region)
# -----------------------------------------------------------
FIRST_NAMES = [
    "Ramesh", "Priya", "Suresh", "Anita", "Mohan", "Kavitha", "Rajan",
    "Meena", "Arvind", "Lakshmi", "Vijay", "Sunita", "Prakash", "Geetha",
    "Santosh", "Rekha", "Dinesh", "Pushpa", "Mahesh", "Saranya", "Babu",
    "Jyothi", "Krishnan", "Radha", "Murugan", "Selvi", "Govind", "Usha",
    "Deepak", "Parvathi", "Arun", "Nalini", "Rajesh", "Kamala", "Siva"
]
LAST_NAMES = [
    "Kumar", "Sharma", "Das", "Devi", "Singh", "Patel", "Nair", "Reddy",
    "Rao", "Pillai", "Mehta", "Jha", "Mishra", "Yadav", "Gupta", "Thakur",
    "Verma", "Iyer", "Menon", "Chaudhary"
]

def generate_aadhaar():
    """Generates a fake Aadhaar-style 12-digit number."""
    return f"{random.randint(1000,9999)} {random.randint(1000,9999)} {random.randint(1000,9999)}"

def generate_citizen(idx):
    """Generates a single realistic citizen record."""
    income_cat = np.random.choice(INCOME_CATEGORIES, p=INCOME_WEIGHTS)
    district = random.choice(list(DISTRICTS.keys()))
    flood_severity = DISTRICTS[district]

    livelihood = random.choice(LIVELIHOOD_MAP[income_cat])
    house_type = random.choice(HOUSE_TYPE_MAP[income_cat])
    house_ownership = (
        "rented" if income_cat in ["poor", "lower_middle"] and random.random() < 0.35
        else "owned"
    )

    annual_income = random.randint(*INCOME_RANGE[income_cat])
    dependents = np.random.choice([0, 1, 2, 3, 4, 5, 6],
                                   p=[0.05, 0.10, 0.20, 0.28, 0.20, 0.12, 0.05])
    is_sole_earner = random.random() < (0.70 if income_cat == "poor" else 0.40)

    land_owned = 0
    if livelihood in ["farmer", "business_owner"]:
        if income_cat == "poor":          land_owned = round(random.uniform(0, 1.0), 1)
        elif income_cat == "lower_middle":land_owned = round(random.uniform(0.5, 2.5), 1)
        elif income_cat == "middle":      land_owned = round(random.uniform(1.0, 5.0), 1)
        else:                             land_owned = round(random.uniform(3.0, 15.0), 1)

    has_insurance = random.random() < INSURANCE_PROB[income_cat]
    savings_months = round(random.uniform(*SAVINGS_RANGE[income_cat]), 1)

    # Employer keeps paying during disaster? (govt employees mostly yes)
    employer_support = livelihood == "salaried_govt" or (
        livelihood == "salaried_private" and random.random() < 0.20
    )

    # Family/community support network
    family_support = random.random() < 0.35

    # Historical exclusion from govt schemes - higher for marginalized
    previously_excluded = random.random() < (0.45 if income_cat in ["poor", "lower_middle"] else 0.10)

    name = f"{random.choice(FIRST_NAMES)} {random.choice(LAST_NAMES)}"

    return {
        "aadhaar": generate_aadhaar(),
        "name": name,
        "age": random.randint(22, 68),
        "district": district,
        "income_category": income_cat,
        "annual_income": annual_income,
        "livelihood": livelihood,
        "land_owned": land_owned,
        "house_type": house_type,
        "house_ownership": house_ownership,
        "dependents": int(dependents),
        "is_sole_earner": int(is_sole_earner),
        "has_insurance": int(has_insurance),
        "savings_months": savings_months,
        "employer_support": int(employer_support),
        "family_support": int(family_support),
        "previously_excluded": int(previously_excluded),
        "flood_severity": flood_severity,  # from NDMA district data
    }

# -----------------------------------------------------------
# VULNERABILITY SCORE FORMULA
# This is what the model LEARNS from. You calculate it here
# using domain knowledge, then the Random Forest learns the
# pattern. In production, real labels would come from field data.
# -----------------------------------------------------------
def calculate_vulnerability_score(row):
    score = 0

    # A. Flood Severity (0-30) — real NDMA district data
    score += row["flood_severity"]

    # B. Livelihood Loss (0-20)
    livelihood_score = {
        "daily_wage": 20, "farmer": 17, "small_business": 14,
        "salaried_private": 8, "salaried_govt": 3, "business_owner": 10
    }
    score += livelihood_score.get(row["livelihood"], 10)

    # C. Housing Loss (0-12)
    house_score = {"kutcha": 12, "semi_pucca": 7, "pucca": 3}
    score += house_score.get(row["house_type"], 5)
    if row["house_ownership"] == "rented":
        score += 5  # renters are more vulnerable (no asset, can be evicted)

    # D. Land (0-8)
    if row["land_owned"] == 0:       score += 8
    elif row["land_owned"] < 2:      score += 5
    else:                             score += 2

    # E. Dependents and sole earner burden (0-20)
    dep = row["dependents"]
    if dep >= 5:    score += 15
    elif dep >= 3:  score += 10
    elif dep >= 1:  score += 5
    if row["is_sole_earner"]:  score += 5

    # F. Historical exclusion bonus (0-5)
    if row["previously_excluded"]:  score += 5

    # G. Recovery capacity (subtract — these reduce vulnerability)
    if row["has_insurance"]:        score -= 15
    if row["savings_months"] >= 6:  score -= 10
    elif row["savings_months"] >= 3: score -= 5
    if row["employer_support"]:     score -= 8
    if row["family_support"]:       score -= 5

    return max(0, min(100, score))  # clamp between 0 and 100

def assign_tier(score):
    if score >= 75: return "Critical"
    if score >= 50: return "High"
    if score >= 25: return "Medium"
    return "Low"

def assign_compensation(score, income_cat):
    """
    Compensation is BOTH vulnerability-score AND income-category adjusted.
    This is the core fairness mechanic — same flood, different outcomes.
    """
    comp_table = {
        #            Critical    High    Medium   Low
        "poor":         [100000, 75000, 40000, 15000],
        "lower_middle": [ 75000, 50000, 30000, 10000],
        "middle":       [ 50000, 35000, 20000,  5000],
        "upper_middle": [ 25000, 15000, 10000,     0],
        "rich":         [ 10000,  5000,     0,     0],
    }
    tier_index = {"Critical": 0, "High": 1, "Medium": 2, "Low": 3}
    tier = assign_tier(score)
    return comp_table[income_cat][tier_index[tier]]

# -----------------------------------------------------------
# GENERATE AND SAVE
# -----------------------------------------------------------
if __name__ == "__main__":
    print("Generating 500 synthetic citizen records...")
    citizens = [generate_citizen(i) for i in range(500)]
    df = pd.DataFrame(citizens)

    # Calculate vulnerability scores using our formula
    df["vulnerability_score"] = df.apply(calculate_vulnerability_score, axis=1)
    df["priority_tier"] = df["vulnerability_score"].apply(assign_tier)
    df["compensation_inr"] = df.apply(
        lambda r: assign_compensation(r["vulnerability_score"], r["income_category"]), axis=1
    )

    df.to_csv("citizens.csv", index=False)

    print(f"Done! Saved 500 records to citizens.csv")
    print(f"\nScore distribution:")
    print(df["priority_tier"].value_counts())
    print(f"\nAverage score by income category:")
    print(df.groupby("income_category")["vulnerability_score"].mean().round(1))
    print(f"\nAverage compensation by income category:")
    print(df.groupby("income_category")["compensation_inr"].mean().round(0))
