# -*- coding: utf-8 -*-
"""
Régénère qdj-data.js à partir de Questions-du-jour.xlsx.

    python outils/import-qdj.py

Toute question présente dans le classeur est considérée comme relue : une
question inchangée garde sa date de validation (ou reçoit celle du jour si
elle n'en avait pas) ; une question modifiée ou ajoutée reçoit la date du jour.
Colonne Action : SUPPRIMER retire la question. Ne jamais modifier un id.
"""
import datetime, openpyxl
from qdj_commun import lire, ecrire, CATEGORIES, XLSX

AUJOURDHUI = datetime.date.today().isoformat()
connu = {x["id"]: x for x in lire()["questions"]}

wb = openpyxl.load_workbook(XLSX, data_only=True)
resultat, ids_vus, soucis = [], set(), []
compteurs = {"garde": 0, "modifie": 0, "ajoute": 0, "supprime": 0}

for nom, cat in CATEGORIES:
    ws = wb[nom]
    for r in range(5, ws.max_row + 1):
        def lire_cel(c):
            v = ws.cell(row=r, column=c).value
            return str(v).strip() if v is not None else ""
        ident, q, action = lire_cel(1), lire_cel(3), lire_cel(4).upper()
        if not ident and not q:
            continue
        if action.startswith("SUPPR"):
            compteurs["supprime"] += 1
            continue
        if not q:
            soucis.append((nom, r, "question vide")); continue
        if not ident:
            soucis.append((nom, r, "id manquant")); continue
        if ident in ids_vus:
            soucis.append((nom, r, "id en double : " + ident)); continue
        ids_vus.add(ident)

        ref = connu.get(ident)
        if ref is None:
            v = AUJOURDHUI; compteurs["ajoute"] += 1
        elif ref["q"] != q:
            v = AUJOURDHUI; compteurs["modifie"] += 1
        else:
            v = ref["v"] or AUJOURDHUI; compteurs["garde"] += 1
        resultat.append({"id": ident, "cat": cat, "v": v, "q": q})

if soucis:
    print("PROBLEMES, rien n'a ete ecrit :")
    for s in soucis:
        print("   ", s)
    raise SystemExit(1)

ecrire(resultat)
print("qdj-data.js regenere :", len(resultat), "questions (", len(resultat), "jours sans repetition )")
print("   inchangees", compteurs["garde"], "| modifiees", compteurs["modifie"],
      "| ajoutees", compteurs["ajoute"], "| supprimees", compteurs["supprime"])
print("   N'oublie pas d'incrementer qdj-data.js?v= dans index.html.")
