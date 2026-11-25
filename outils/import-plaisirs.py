# -*- coding: utf-8 -*-
"""
Régénère plaisirs-data.js à partir de Plaisirs-Intimes.xlsx.

    python outils/import-plaisirs.py

Format (23/11/2026) : onglets « Ensemble » et « À distance », colonnes
ID | Type (Question / Défi) | Texte | Action | État | Réponse 1..4 (questions).
- Une carte présente dans les DEUX onglets (même ID, ou même texte sans ID) = jouable partout (l = '2').
- Présente dans un seul onglet = l = 'e' (Ensemble) ou 'd' (À distance).
- ID vide + texte = nouvelle carte (id attribué : q42, d36…).
- Action = SUPPRIMER : la carte est retirée de CET onglet (des deux = supprimée).
- Toute carte présente est considérée comme relue (date de validation).
Ne jamais modifier un ID existant.
Ensuite : outils/Chiffrer le contenu.bat (le contenu est publié chiffré), puis publier.
"""
import datetime, re, openpyxl
from plaisirs_commun import lire, ecrire, XLSX, ONGLETS, TYPES

AUJ = datetime.date.today().isoformat()
ancien = lire()
connu = {x["id"]: x for cle in ("questions", "defis") for x in ancien.get(cle, [])}
wb = openpyxl.load_workbook(XLSX, data_only=True)
soucis = []
cartes = {}        # clé de carte (id, ou « nouveau:<type>:<texte> ») -> {cle, id, t, lieux:set}
ordre = []

for onglet, lieu in ONGLETS:
    ws = wb[onglet]
    for r in range(5, ws.max_row + 1):
        val = lambda c: (str(ws.cell(row=r, column=c).value).strip() if ws.cell(row=r, column=c).value is not None else "")
        ident, typ, texte, action = val(1), val(2).lower(), val(3), val(4).upper()
        if not ident and not texte:
            continue
        if action.startswith("SUPPR"):
            continue
        if not texte:
            soucis.append((onglet, r, "texte vide")); continue
        if typ not in TYPES:
            soucis.append((onglet, r, "Type inconnu (Question ou Défi) : " + val(2))); continue
        cle, pref = TYPES[typ]
        if ident and not re.fullmatch(pref + r"\d+", ident):
            soucis.append((onglet, r, "ID « " + ident + " » ne correspond pas au type " + val(2))); continue
        k = ident or ("nouveau:" + cle + ":" + texte.lower())
        if k in cartes:
            if cartes[k]["t"] != texte:
                soucis.append((onglet, r, "texte différent entre les deux onglets pour " + (ident or texte[:40]) + " — celui d'« Ensemble » est gardé"))
            cartes[k]["lieux"].add(lieu)
        else:
            reps = [val(c) for c in range(6, 10)]
            if cle == "questions" and not all(reps):
                soucis.append((onglet, r, "question sans ses 4 réponses : " + (ident or texte[:40])))
            cartes[k] = {"cle": cle, "id": ident, "t": texte, "lieux": {lieu}, "a": reps if cle == "questions" else None}
            ordre.append(k)

nouveau = {"questions": [], "defis": []}
for cle, pref in (("questions", "q"), ("defis", "d")):
    num = max([int(i[1:]) for i in connu if i.startswith(pref) and i[1:].isdigit()]
              + [int(c["id"][1:]) for c in cartes.values() if c["id"].startswith(pref) and c["id"][1:].isdigit()] + [0])
    for k in ordre:
        c = cartes[k]
        if c["cle"] != cle:
            continue
        if not c["id"]:
            num += 1; c["id"] = pref + str(num).zfill(2)
        avant = connu.get(c["id"])
        v = avant.get("v") if avant and avant["t"] == c["t"] and avant.get("v") else AUJ
        l = "2" if len(c["lieux"]) == 2 else next(iter(c["lieux"]))
        avant_a = avant.get("a") if avant else None
        if cle == "questions" and avant_a != c["a"]: v = AUJ     # réponses changées = carte relue aujourd'hui
        carte = {"id": c["id"], "t": c["t"], "v": v, "l": l}
        if cle == "questions": carte["a"] = c["a"]
        nouveau[cle].append(carte)

for s in soucis:
    print("⚠️", *s)
ecrire(nouveau)
for cle in ("questions", "defis"):
    L = nouveau[cle]
    print(f"{cle} : {len(L)} (ensemble seulement {sum(x['l'] == 'e' for x in L)}, "
          f"distance seulement {sum(x['l'] == 'd' for x in L)}, les deux {sum(x['l'] == '2' for x in L)})")
