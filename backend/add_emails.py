import pandas as pd
import random

df = pd.read_csv("citizens.csv")

first_names = df["name"].str.split().str[0].str.lower()
random.seed(99)
suffixes = [str(random.randint(10, 999)) for _ in range(len(df))]
domains = ["gmail.com", "yahoo.com", "outlook.com"]

df["email"] = [
    f"{name}{suffix}@{random.choice(domains)}"
    for name, suffix in zip(first_names, suffixes)
]

df.to_csv("citizens.csv", index=False)
print(f"✅ Done! Added emails to {len(df)} citizens.")