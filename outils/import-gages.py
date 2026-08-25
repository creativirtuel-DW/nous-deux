# -*- coding: utf-8 -*-
"""
Régénère gages-data.js à partir de Gages-Photo.xlsx.

    python outils/import-gages.py

Tout gage présent dans le classeur est considéré comme relu : il reçoit la
date du jour dans le champ « v ». Un gage inchangé conserve sa date d'origine ;
un gage dont le texte a bougé est revalidé à la date du jour.

Colonne Action : SUPPRIMER retire le gage. Une nouvelle ligne avec un id neuf
en ajoute un. Ne jamais modifier un id existant : il porte la mémoire
anti-répétition (rooms/$room/gagesVus).
"""
import io, os, re, datetime, openpyxl

RACINE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
JS = os.path.join(RACINE, "gages-data.js")
XL = os.path.join(RACINE, "Gages-Photo.xlsx")
AUJOURDHUI = datetime.date.today().isoformat()

# --- banque actuelle, pour comparer ---
ancien = io.open(JS, encoding="utf-8").read()
connu = {}
for ligne in ancien.split("\n"):
    if "id:'" not in ligne or "type:'" not in ligne:
        continue
    i = re.search(r"id:'([^']+)'", ligne).group(1)
    connu[i] = {
        "v": re.search(r"v:'([^']*)'", ligne).group(1),
        "g": re.search(r'g:"([^"]*)"', ligne).group(1),
        "type": re.search(r"type:'([^']+)'", ligne).group(1),
    }

wb = openpyxl.load_workbook(XL, data_only=True)
ws = wb["Gages"]

actions, verites = [], []
ids_vus = set()
soucis = []
compteurs = {"garde": 0, "modifie": 0, "ajoute": 0, "supprime": 0}

for r in range(5, ws.max_row + 1):
    def lire(c):
        valeur = ws.cell(row=r, column=c).value
        return str(valeur).strip() if valeur is not None else ""

    ident, typ, texte, action = lire(1), lire(2).lower(), lire(4), lire(5).upper()

    if not texte and not ident:
        continue
    if action.startswith("SUPPR"):
        compteurs["supprime"] += 1
        continue
    if not texte:
        soucis.append((r, "texte vide"))
        continue
    if not ident:
        soucis.append((r, "id manquant"))
        continue
    if ident in ids_vus:
        soucis.append((r, "id en double : " + ident))
        continue
    if typ not in ("action", "verite"):
        soucis.append((r, "type invalide : " + typ + " (attendu action ou verite)"))
        continue
    ids_vus.add(ident)

    ref = connu.get(ident)
    if ref is None:
        v = AUJOURDHUI
        compteurs["ajoute"] += 1
    elif ref["g"] != texte or ref["type"] != typ:
        v = AUJOURDHUI
        compteurs["modifie"] += 1
    else:
        v = ref["v"] or AUJOURDHUI
        compteurs["garde"] += 1

    (actions if typ == "action" else verites).append({"id": ident, "type": typ, "g": texte, "v": v})

if soucis:
    print("PROBLEMES, rien n'a ete ecrit :")
    for s in soucis:
        print("   ", s)
    raise SystemExit(1)

def echappe(t):
    return t.replace("\\", "\\\\").replace('"', '\\"')

entete = '''// ====== BANQUE DE GAGES ALÉATOIRES (Défi Photo) ======
// Deux familles : « action » (quelque chose à faire) et « verite » (quelque
// chose à avouer). Le gage est écrit à l'envoi du défi par celui qui l'envoie,
// et réalisé par celui qui perd — les textes s'adressent donc au perdant.
//
// id : identifiant stable. Les gages déjà tirés sont retenus dans
//      rooms/$room/gagesVus et ne reviennent qu'une fois la liste épuisée.
// v  : date de relecture et validation par l'utilisateur.
//
// FICHIER GENERE — ne pas editer a la main.
// Pour modifier : python outils/export-gages.py, editer Gages-Photo.xlsx,
// puis python outils/import-gages.py

const GAGES_ALEATOIRES = [
'''

morceaux = [entete]
for titre, lot in [("ACTIONS", actions), ("VÉRITÉS", verites)]:
    morceaux.append("\n  // ================= " + titre + " ================= (" + str(len(lot)) + ")\n")
    for x in lot:
        morceaux.append("  { id:'%s', type:'%s', v:'%s', g:\"%s\" },\n"
                        % (x["id"], x["type"], x["v"], echappe(x["g"])))

texte = "".join(morceaux).rstrip().rstrip(",") + "\n];\n"
io.open(JS, "w", encoding="utf-8").write(texte)

print("gages-data.js regenere :", len(actions) + len(verites), "gages")
print("   actions :", len(actions), "| verites :", len(verites))
print("   inchanges", compteurs["garde"], "| modifies", compteurs["modifie"],
      "| ajoutes", compteurs["ajoute"], "| supprimes", compteurs["supprime"])
