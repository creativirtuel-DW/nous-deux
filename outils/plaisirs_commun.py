# -*- coding: utf-8 -*-
"""Lecture / écriture de plaisirs-data.js (banque du mode « Plaisirs Intimes »)."""
import json, os

ICI = os.path.dirname(os.path.abspath(__file__))
RACINE = os.path.dirname(ICI)
JS = os.path.join(RACINE, "plaisirs-data.js")
XLSX = os.path.join(RACINE, "Plaisirs-Intimes.xlsx")
FEUILLES = [("Questions", "questions", "q"), ("Défis", "defis", "d")]   # ancien format (jusqu'au 23/11/2026)
# Format actuel : un onglet par lieu, questions ET défis dedans (colonne Type).
ONGLETS = [("Ensemble", "e"), ("À distance", "d")]                       # (onglet, lieu)
TYPES = {"question": ("questions", "q"), "défi": ("defis", "d"), "defi": ("defis", "d")}

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

def lire_nouvelles():
    """Lignes du classeur actuel SANS ID (nouvelles cartes pas encore importées) :
    [(onglet, 'Question'|'Défi', texte, etat)]. Comprend l'ancien format (onglets
    Questions / Défis + colonne Lieu) et le nouveau (onglets Ensemble / À distance)."""
    import openpyxl
    wb = openpyxl.load_workbook(XLSX, data_only=True)
    res = []
    v = lambda ws, r, c: (str(ws.cell(row=r, column=c).value).strip() if ws.cell(row=r, column=c).value is not None else "")
    if "Ensemble" in wb.sheetnames:
        for onglet, _ in ONGLETS:
            ws = wb[onglet]
            for r in range(5, ws.max_row + 1):
                if not v(ws, r, 1) and v(ws, r, 3) and not v(ws, r, 4).upper().startswith("SUPPR"):
                    res.append((onglet, "Défi" if v(ws, r, 2).lower().startswith("d") else "Question", v(ws, r, 3), v(ws, r, 5)))
    else:
        for onglet, cle, pref in FEUILLES:
            ws = wb[onglet]
            typ = "Question" if cle == "questions" else "Défi"
            for r in range(5, ws.max_row + 1):
                if v(ws, r, 1) or not v(ws, r, 2) or v(ws, r, 3).upper().startswith("SUPPR"):
                    continue
                lieu = v(ws, r, 5).lower()
                tabs = ["À distance"] if lieu.startswith("dist") else ["Ensemble"] if lieu.startswith("ens") else ["Ensemble", "À distance"]
                for o in tabs:
                    res.append((o, typ, v(ws, r, 2), v(ws, r, 4)))
    return res

def ecrire(data):
    with open(JS, "w", encoding="utf-8", newline="\n") as f:
        f.write(ENTETE + "/*JSON*/" + json.dumps(data, ensure_ascii=False, indent=1) + "/*FIN*/;\n")
