# -*- coding: utf-8 -*-
"""Lecture / écriture de plaisirs-data.js (banque du mode « Plaisirs Intimes »)."""
import json, os

ICI = os.path.dirname(os.path.abspath(__file__))
RACINE = os.path.dirname(ICI)
JS = os.path.join(RACINE, "plaisirs-data.js")
XLSX = os.path.join(RACINE, "Plaisirs-Intimes.xlsx")
FEUILLES = [("Questions", "questions", "q"), ("Défis", "defis", "d")]   # (onglet, clé, préfixe d'id)

ENTETE = """/**
 * Nous Deux — banque du mode « Plaisirs Intimes » (questions et défis HOT).
 * ⚠️ FICHIER GÉNÉRÉ : ne pas éditer à la main.
 *   python outils/export-plaisirs.py  → Plaisirs-Intimes.xlsx (à compléter)
 *   python outils/import-plaisirs.py  → régénère ce fichier
 * Ne jamais modifier un id existant (il sert à ne pas resservir les mêmes cartes).
 */
const PLAISIRS = """

def lire():
    with open(JS, encoding="utf-8") as f:
        s = f.read()
    return json.loads(s.split("/*JSON*/", 1)[1].split("/*FIN*/", 1)[0])

def ecrire(data):
    with open(JS, "w", encoding="utf-8", newline="\n") as f:
        f.write(ENTETE + "/*JSON*/" + json.dumps(data, ensure_ascii=False, indent=1) + "/*FIN*/;\n")
