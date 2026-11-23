# -*- coding: utf-8 -*-
"""
Produit Plaisirs-Intimes.xlsx à partir de plaisirs-data.js.

    python outils/export-plaisirs.py

Depuis le 23/11/2026 : DEUX onglets, « Ensemble » et « À distance », chacun avec
les questions puis les défis (colonne Type). Une carte jouable dans les deux cas
(l = '2') apparaît dans LES DEUX onglets avec le même ID.
Les lignes encore NOUVELLES (sans ID) du classeur actuel sont conservées.

À compléter dans Excel puis : python outils/import-plaisirs.py
"""
import os, openpyxl
from openpyxl.styles import Font, PatternFill, Alignment
from plaisirs_commun import lire, XLSX, ONGLETS, lire_nouvelles

data = lire()
nouvelles = lire_nouvelles() if os.path.exists(XLSX) else []   # [(onglet, type, texte, etat)]
# Une ligne sans ID dont le texte est déjà dans les données a été importée : on ne la recopie pas.
deja = {x["t"].strip().lower() for cle in ("questions", "defis") for x in data[cle]}
nouvelles = [n for n in nouvelles if n[2].strip().lower() not in deja]

ROUGE = PatternFill("solid", fgColor="C8102E")
ORANGE = PatternFill("solid", fgColor="FFD8A8")
JAUNE = PatternFill("solid", fgColor="FFF2B3")
BANDE = {"Question": PatternFill("solid", fgColor="FCE4EC"), "Défi": PatternFill("solid", fgColor="FFE0CC")}

wb = openpyxl.Workbook()
wb.remove(wb.active)
for onglet, lieu in ONGLETS:
    ws = wb.create_sheet(onglet)
    ws["A1"] = "🔥 Plaisirs Intimes — jouer " + onglet.lower()
    ws["A1"].font = Font(size=14, bold=True, color="C8102E")
    ws["A2"] = ("Questions puis défis jouables " + ("ENSEMBLE" if lieu == "e" else "À DISTANCE") + ". "
                "Nouvelle carte : ajoute une ligne, ID VIDE, Type = Question ou Défi. "
                "Une carte jouable dans les deux cas se met dans les DEUX onglets (même ID, ou même texte si l'ID est vide). "
                "Pour retirer une carte de cet onglet : SUPPRIMER dans la colonne Action. Ne modifie jamais un ID existant.")
    ws["A2"].alignment = Alignment(wrap_text=True)
    ws.merge_cells("A2:E2")
    ws.row_dimensions[2].height = 60
    for c, t in enumerate(["ID", "Type", "Texte", "Action", "État"], 1):
        cel = ws.cell(row=4, column=c, value=t)
        cel.font = Font(bold=True, color="FFFFFF"); cel.fill = ROUGE
    r = 5
    for cle, typ in [("questions", "Question"), ("defis", "Défi")]:
        for it in data[cle]:
            if it.get("l", "2") not in ("2", lieu):
                continue
            ws.cell(row=r, column=1, value=it["id"]).fill = BANDE[typ]
            ws.cell(row=r, column=2, value=typ).fill = BANDE[typ]
            ws.cell(row=r, column=3, value=it["t"]).alignment = Alignment(wrap_text=True, vertical="top")
            if not it.get("v"):
                e = ws.cell(row=r, column=5, value="À VALIDER"); e.fill = ORANGE
            r += 1
        for (o, t2, texte, etat) in nouvelles:
            if o != onglet or t2 != typ:
                continue
            for c, val in enumerate(["", typ, texte, "", etat or "NOUVEAU"], 1):
                cel = ws.cell(row=r, column=c, value=val); cel.fill = JAUNE
            ws.cell(row=r, column=3).alignment = Alignment(wrap_text=True, vertical="top")
            ws.cell(row=r, column=5).font = Font(bold=True)
            r += 1
    ws.column_dimensions["A"].width = 8
    ws.column_dimensions["B"].width = 11
    ws.column_dimensions["C"].width = 90
    ws.column_dimensions["D"].width = 12
    ws.column_dimensions["E"].width = 12
    ws.freeze_panes = "A5"
wb.save(XLSX)
for onglet, lieu in ONGLETS:
    nq = sum(1 for x in data["questions"] if x.get("l", "2") in ("2", lieu))
    nd = sum(1 for x in data["defis"] if x.get("l", "2") in ("2", lieu))
    nn = sum(1 for n in nouvelles if n[0] == onglet)
    print(f"{onglet} : {nq} questions, {nd} défis validés + {nn} nouvelles")
