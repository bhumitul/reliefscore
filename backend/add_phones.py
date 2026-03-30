import pandas as pd
import random

df = pd.read_csv("citizens.csv")

# Generate random 10-digit Indian mobile numbers
random.seed(42)
phone_numbers = [
    f"{random.choice(['6','7','8','9'])}{''.join([str(random.randint(0,9)) for _ in range(9)])}"
    for _ in range(len(df))
]

df["phone"] = phone_numbers
df.to_csv("citizens.csv", index=False)
print(f"✅ Done! Added phone numbers to {len(df)} citizens.")

