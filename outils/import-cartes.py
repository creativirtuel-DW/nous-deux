# -*- coding: utf-8 -*-
"""
Regenere cards-data.js a partir de Cartes.xlsx.

    python outils/import-cartes.py

Colonne Action : SUPPRIMER retire la carte. Une ligne sans id est une nouvelle
carte : elle recoit un id neuf (dNNN) jamais utilise auparavant. Les id
existants ne doivent jamais etre modifies : ce sont eux que Firebase stocke
pour le masquage et les modifications faites depuis l'appli.
"""
import io, os, re, openpyxl

RACINE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
JS = os.path.join(RACINE, "cards-data.js")
XL = os.path.join(RACINE, "Cartes.xlsx")
ONGLETS = [("gage", "Cap ou pas"), ("question", "Question"), ("defi", "Defi")]

ancien = io.open(JS, encoding="utf-8").read()
LIGNE = re.compile(r"^(\s*)\{ id:'([^']+)', cat:'([^']+)', text:\"(.*)\", pts:(\d+)(, photo:true)? \},\s*$")

# plus grand numero deja utilise, pour ne jamais recycler un id
maxnum = max([int(n) for n in re.findall(r"id:'d(\d+)'", ancien)] or [0])

wb = openpyxl.load_workbook(XL)
nouveau = {}   # id -> (cat, text, pts)
ajouts = []
supprimes = []
for cat, nom in ONGLETS:
    ws = wb[nom]
    for r in range(5, ws.max_row + 1):
        cid = ws.cell(row=r, column=1).value
        texte = ws.cell(row=r, column=3).value
        pts = ws.cell(row=r, column=4).value
        photo = str(ws.cell(row=r, column=5).value or "").strip().upper() == "OUI"
        action = (ws.cell(row=r, column=6).value or "")
        if not texte or not str(texte).strip():
            continue
        texte = re.sub(r"\s+", " ", str(texte)).strip().replace('"', "'")
        if str(action).strip().upper() == "SUPPRIMER":
            if cid:
                supprimes.append(str(cid).strip())
            continue
        cid = str(cid).strip() if cid else ""
        # id vide, ou id deja pris par une ligne precedente (ligne dupliquee puis
        # reecrite dans le classeur) : c'est une carte neuve, elle prend un id neuf.
        if not cid or cid in nouveau:
            maxnum += 1
            cid = "d%d" % maxnum
            ajouts.append(cid)
        nouveau[cid] = (cat, texte, int(pts or 10), photo)

# --- reecriture : on garde l'ordre du fichier, on ajoute les neuves a la fin ---
vus = set()
sorties = []
for ligne in ancien.split("\n"):
    m = LIGNE.match(ligne)
    if not m:
        sorties.append(ligne)
        continue
    ind, cid = m.group(1), m.group(2)
    if cid not in nouveau:
        continue                       # supprimee dans le classeur
    vus.add(cid)
    cat, texte, pts, photo = nouveau[cid]
    sorties.append("%s{ id:'%s', cat:'%s', text:\"%s\", pts:%d%s }," % (
        ind, cid, cat, texte, pts, ", photo:true" if photo else ""))

restants = [c for c in nouveau if c not in vus]
if restants:
    fin = sorties.index("];")
    bloc = ["", "  // Cartes ajoutees depuis Cartes.xlsx"]
    for cid in restants:
        cat, texte, pts, photo = nouveau[cid]
        bloc.append("  { id:'%s', cat:'%s', text:\"%s\", pts:%d%s }," % (
            cid, cat, texte, pts, ", photo:true" if photo else ""))
    sorties[fin:fin] = bloc

io.open(JS, "w", encoding="utf-8").write("\n".join(sorties))
print("cards-data.js regenere :", len(nouveau), "cartes")
print("  ", len(ajouts), "ajoutees,", len(supprimes), "supprimees")
