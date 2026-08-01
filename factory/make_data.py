#!/usr/bin/env python3
"""Generate the sample data feed the factory renders from.

Deterministic: same --seed and --rows always produce a byte-identical CSV, so a
batch can be reproduced exactly. Includes deliberately hostile rows (long names,
non-ASCII, emoji, RTL, empty fields) because those are what break a real feed at
scale — the QA pass is supposed to catch them, not the viewer.
"""
import argparse
import csv
import random
import unicodedata

FIRST = [
    "Ana", "Ben", "Chloe", "Dmitri", "Elena", "Farid", "Grace", "Hana", "Ivan",
    "Jae", "Kofi", "Lena", "Marco", "Nadia", "Omar", "Priya", "Quinn", "Rafa",
    "Sofia", "Tomas", "Uma", "Viktor", "Wei", "Xiomara", "Yuki", "Zane",
]
LAST = [
    "Alvarez", "Baker", "Chen", "Dubois", "Eriksen", "Fontaine", "Gruber",
    "Haddad", "Ibrahim", "Jensen", "Kowalski", "Lindqvist", "Moreau", "Nakamura",
    "Okafor", "Petrov", "Rossi", "Silva", "Tanaka", "Ueda", "Varga", "Weber",
]
ARTISTS = [
    "Phoebe Bridgers", "Fred again..", "Little Simz", "Caroline Polachek",
    "Kendrick Lamar", "Jamie xx", "Rosalía", "Arca", "Sault", "Yaeji",
    "Overmono", "Charli XCX", "Burna Boy", "Tirzah", "Floating Points",
    "Black Midi", "Wet Leg", "Sudan Archives", "Skee Mask", "Alvvays",
]
SONGS = [
    "Motion Sickness", "Delete Forever", "Gorgeous", "Bunny Is a Rider",
    "Nights", "Gosh", "Saoko", "Prada", "Wildfires", "Raingurl",
    "So U Kno", "Von Dutch", "Last Last", "Devotion", "Birth4000",
]
GENRES = [
    "indie folk", "UK garage", "alté", "hyperpop", "ambient jazz",
    "deconstructed club", "bedroom pop", "drill", "shoegaze", "amapiano",
]
CITIES = [
    "Lisbon", "Tel Aviv", "Seoul", "Mexico City", "Lagos", "Berlin",
    "São Paulo", "Manchester", "Montréal", "Jakarta",
]

# Rows engineered to break naive layout. Every real feed has these.
EDGE_ROWS = [
    dict(name="Bartholomew Fitzgerald-Wintersmith III", top_artist="Godspeed You! Black Emperor",
         top_song="Storm/Static/Sleep (Live at the Hollywood Bowl, Extended Mix)",
         top_genre="post-rock", city="Wellington", note="overflow: long everything"),
    dict(name="José Ángel Peña", top_artist="Rosalía", top_song="Malamente",
         top_genre="flamenco pop", city="Sevilla", note="latin-1 diacritics"),
    dict(name="Zoë Ødegård", top_artist="Sigrid", top_song="Mine Right Now",
         top_genre="nordic pop", city="Bergen", note="diaeresis + slashed o"),
    dict(name="李伟", top_artist="窦唯", top_song="高级动物",
         top_genre="chinese rock", city="Beijing", note="CJK — needs a CJK font"),
    dict(name="نور الهدى", top_artist="Mashrou' Leila", top_song="Roman",
         top_genre="arabic indie", city="Beirut", note="RTL script"),
    dict(name="Ash 🎧", top_artist="Fred again..", top_song="Delilah (pull me out of this)",
         top_genre="UK garage", city="London", note="emoji in name"),
    dict(name="", top_artist="Aphex Twin", top_song="Xtal",
         top_genre="IDM", city="Cornwall", note="empty name — must fall back"),
    dict(name="Al", top_artist="Sault", top_song="Wildfires",
         top_genre="soul", city="Accra", note="2-char name — layout must not look broken"),
]


def build_rows(n, seed):
    rng = random.Random(seed)
    rows = []
    for i, edge in enumerate(EDGE_ROWS[:n]):
        row = dict(edge)
        row["id"] = f"E{i:04d}"
        row["minutes"] = rng.randrange(4_000, 120_000)
        row["top_pct"] = round(rng.uniform(0.01, 5.0), 2)
        rows.append(row)
    while len(rows) < n:
        i = len(rows)
        rows.append(dict(
            id=f"U{i:04d}",
            name=f"{rng.choice(FIRST)} {rng.choice(LAST)}",
            top_artist=rng.choice(ARTISTS),
            top_song=rng.choice(SONGS),
            top_genre=rng.choice(GENRES),
            city=rng.choice(CITIES),
            minutes=rng.randrange(2_000, 140_000),
            top_pct=round(rng.uniform(0.01, 12.0), 2),
            note="",
        ))
    return rows


FIELDS = ["id", "name", "top_artist", "top_song", "top_genre", "city",
          "minutes", "top_pct", "note"]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("-o", "--out", default="factory/data/audience.csv")
    ap.add_argument("-n", "--rows", type=int, default=500)
    ap.add_argument("--seed", type=int, default=1729)
    a = ap.parse_args()

    rows = build_rows(a.rows, a.seed)
    with open(a.out, "w", newline="", encoding="utf-8") as fh:
        w = csv.DictWriter(fh, fieldnames=FIELDS)
        w.writeheader()
        w.writerows(rows)

    hostile = sum(1 for r in rows if r["note"])
    non_ascii = sum(1 for r in rows
                    if any(unicodedata.category(c) != "Zs" and ord(c) > 127
                           for c in r["name"]))
    print(f"wrote {a.out}: {len(rows)} rows "
          f"({hostile} engineered edge cases, {non_ascii} with non-ASCII names)")


if __name__ == "__main__":
    main()
