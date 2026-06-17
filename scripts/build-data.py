#!/usr/bin/env python3
"""Convert CCCC_Vocabulary_2017.xls to JSON for the flashcard web app."""

import xlrd
import json
import os
import re

SRC = os.path.join(os.path.dirname(__file__), "..", "CCCC_Vocabulary_2017.xls")
OUT_DIR = os.path.join(os.path.dirname(__file__), "..", "data")

LEVEL_SHEETS = {
    "beginner":     "萌芽級",
    "intermediate": "成長級",
    "advanced":     "茁壯級",
}

POS_SHEET = "詞性縮寫對照表"

# Codes that appear in the data but not in the legend sheet
EXTRA_POS = {
    "Pron":    "Pronoun",
    "Ptc":     "Particle",
    "BA":      "Ba-construction",
    "Bei":     "Passive marker",
    "Adv":     "Adverb",       # variant capitalisation of ADV
    "affix":   "Affix",        # variant capitalisation
    "particle": "Particle",    # variant capitalisation
}


def read_pos(wb: xlrd.Book) -> dict:
    sh = wb.sheet_by_name(POS_SHEET)
    pos = {}
    for r in range(2, sh.nrows):
        abbr = str(sh.cell_value(r, 1)).strip()
        full_zh = str(sh.cell_value(r, 0)).strip()
        # Extract English from parentheses: "名詞(Noun)" → "Noun"
        m = re.search(r"\(([^)]+)\)", full_zh)
        full_en = m.group(1) if m else full_zh
        if abbr:
            pos[abbr] = full_en
    pos.update(EXTRA_POS)
    return pos


def clean_pinyin(s: str) -> str:
    return s.strip()


def read_level(wb: xlrd.Book, sheet_name: str, prefix: str) -> list:
    sh = wb.sheet_by_name(sheet_name)
    cards = []
    for r in range(2, sh.nrows):
        category    = str(sh.cell_value(r, 0)).strip()
        subcategory = str(sh.cell_value(r, 1)).strip()
        char        = str(sh.cell_value(r, 2)).strip()
        # col 3 = simplified — skipped
        pinyin      = clean_pinyin(str(sh.cell_value(r, 4)))
        pos         = str(sh.cell_value(r, 5)).strip()
        english     = str(sh.cell_value(r, 6)).strip()

        if not char or not english:
            continue

        idx = len(cards) + 1
        card_id = f"{prefix}{idx:04d}"

        cards.append({
            "id":          card_id,
            "char":        char,
            "pinyin":      pinyin,
            "english":     english,
            "pos":         pos,
            "category":    category,
            "subcategory": subcategory,
        })
    return cards


def main():
    wb = xlrd.open_workbook(SRC)

    pos = read_pos(wb)

    levels = {}
    prefixes = {"beginner": "b", "intermediate": "i", "advanced": "a"}
    for level_key, sheet_name in LEVEL_SHEETS.items():
        cards = read_level(wb, sheet_name, prefixes[level_key])
        levels[level_key] = cards
        print(f"  {level_key}: {len(cards)} cards")

    os.makedirs(OUT_DIR, exist_ok=True)

    vocab_path = os.path.join(OUT_DIR, "vocabulary.json")
    with open(vocab_path, "w", encoding="utf-8") as f:
        json.dump({"levels": levels}, f, ensure_ascii=False, indent=2)
    print(f"Wrote {vocab_path}")

    pos_path = os.path.join(OUT_DIR, "pos.json")
    with open(pos_path, "w", encoding="utf-8") as f:
        json.dump(pos, f, ensure_ascii=False, indent=2)
    print(f"Wrote {pos_path}")


if __name__ == "__main__":
    main()
