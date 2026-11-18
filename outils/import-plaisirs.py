# -*- coding: utf-8 -*-
"""
Régénère plaisirs-data.js à partir de Plaisirs-Intimes.xlsx.

    python outils/import-plaisirs.py

- ID vide + texte = nouvelle carte (id attribué automatiquement : q31, d31…)
- Action = SUPPRIMER : la carte est retirée
- Toute carte présente dans le classeur est considérée comme relue (date de validation).
Ne jamais modifier un ID existant. Penser ensuite à monter plaisirs-data.js?v= dans index.html.
"""
import datetime, re, openpyxl
from plaisirs_commun import lire, ecrire, XLSX, FEUILLES

AUJ = datetime.date.today().isoformat()
ancien = lire()
wb = openpyxl.load_workbook(XLSX, data_only=True)
nouveau, soucis = {}, []
for onglet, cle, pref in FEUILLES:
    connu = {x["id"]: x for x in ancien.get(cle, [])}
    num = max([int(re.sub(r"\D", "", i) or 0) for i in connu] + [0])
    ws = wb[onglet]
    res, vus = [], set()
    for r in range(5, ws.max_row + 1):
        val = lambda c: (str(ws.cell(row=r, column=c).value).strip() if ws.cell(row=r, column=c).value is not None else "")
        ident, texte, action = val(1), val(2), val(3).upper()
        if not ident and not texte:
            continue
        if action.startswith("SUPPR"):
            continue
        if not texte:
            soucis.append((onglet, r, "texte vide")); continue
        if not ident:
            num += 1; ident = pref + str(num).zfill(2)
        if ident in vus:
            soucis.append((onglet, r, "ID en double : " + ident)); continue
        vus.add(ident)
        avant = connu.get(ident)
        v = avant.get("v") if avant and avant["t"] == texte and avant.get("v") else AUJ
        res.append({"id": ident, "t": texte, "v": v})
    nouveau[cle] = res
for s in soucis:
    print("⚠️", *s)
ecrire(nouveau)
print("plaisirs-data.js :", len(nouveau["questions"]), "questions,", len(nouveau["defis"]), "défis")
