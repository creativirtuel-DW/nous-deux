# -*- coding: utf-8 -*-
"""
Produit Plaisirs-Intimes.xlsx à partir de plaisirs-data.js (un onglet Questions, un onglet Défis).

    python outils/export-plaisirs.py

À compléter dans Excel puis : python outils/import-plaisirs.py
"""
import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment
from plaisirs_commun import lire, XLSX, FEUILLES

data = lire()
wb = openpyxl.Workbook()
wb.remove(wb.active)
ROUGE = PatternFill("solid", fgColor="C8102E")
ORANGE = PatternFill("solid", fgColor="FFD8A8")
for onglet, cle, pref in FEUILLES:
    ws = wb.create_sheet(onglet)
    ws["A1"] = "🔥 Plaisirs Intimes — " + onglet
    ws["A1"].font = Font(size=14, bold=True, color="C8102E")
    ws["A2"] = ("Ajoute tes " + onglet.lower() + " sur une nouvelle ligne en laissant l'ID VIDE (il sera attribué tout seul). "
                "Pour retirer une ligne : écris SUPPRIMER dans la colonne Action. Ne modifie jamais un ID existant. "
                "Colonne Lieu : Ensemble, Distance ou Les deux (choix « Jouer ensemble / à distance » dans l'appli).")
    ws["A2"].alignment = Alignment(wrap_text=True)
    ws.merge_cells("A2:E2")
    ws.row_dimensions[2].height = 45
    for c, t in enumerate(["ID", "Texte", "Action", "État", "Lieu"], 1):
        cel = ws.cell(row=4, column=c, value=t)
        cel.font = Font(bold=True, color="FFFFFF"); cel.fill = ROUGE
    r = 5
    for it in data[cle]:
        ws.cell(row=r, column=1, value=it["id"])
        ws.cell(row=r, column=2, value=it["t"]).alignment = Alignment(wrap_text=True, vertical="top")
        ws.cell(row=r, column=5, value={"e": "Ensemble", "d": "Distance", "2": "Les deux"}.get(it.get("l"), "Les deux" if cle == "questions" else "Ensemble"))
        if not it.get("v"):
            e = ws.cell(row=r, column=4, value="À VALIDER"); e.fill = ORANGE
        r += 1
    ws.column_dimensions["A"].width = 8
    ws.column_dimensions["B"].width = 90
    ws.column_dimensions["C"].width = 12
    ws.column_dimensions["D"].width = 12
    ws.column_dimensions["E"].width = 12
    ws.freeze_panes = "A5"
wb.save(XLSX)
print("Écrit :", XLSX, "-", len(data["questions"]), "questions,", len(data["defis"]), "défis")
