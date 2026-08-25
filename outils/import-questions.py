# -*- coding: utf-8 -*-
"""
Régénère battle-data.js à partir de Questions-Battle.xlsx.

    python outils/import-questions.py

Toute question présente dans le classeur est considérée comme relue : elle
reçoit la date du jour dans le champ « v ». Une question inchangée conserve
sa date d'origine ; une question dont le texte a bougé est revalidée à la
date du jour, puisqu'elle vient d'être relue.

Colonne Action : SUPPRIMER retire la question. Une nouvelle ligne avec un id
neuf ajoute une question. Les id existants ne doivent jamais être modifiés :
c'est eux qui portent la mémoire anti-répétition.
"""
import io, os, re, datetime, openpyxl

RACINE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
JS = os.path.join(RACINE, "battle-data.js")
XL = os.path.join(RACINE, "Questions-Battle.xlsx")
AUJOURDHUI = datetime.date.today().isoformat()

# --- banque actuelle : dates de validation et textes, pour comparaison ---
ancien = io.open(JS, encoding="utf-8").read()
connu = {}
for ligne in ancien.split("\n"):
    if "id:'" not in ligne or "cat:'" not in ligne:
        continue
    i = re.search(r"id:'([^']+)'", ligne).group(1)
    v = re.search(r"v:'([^']+)'", ligne)
    connu[i] = {
        "v": v.group(1) if v else "",
        "q": re.search(r'q:"([^"]*)"', ligne).group(1),
        "a": re.findall(r'"([^"]*)"', ligne.split("a:[", 1)[1])[:4],
    }

# --- lecture du classeur ---
wb = openpyxl.load_workbook(XL, data_only=True)
onglets = [("Quotidien", "quotidien"), ("Souvenir", "souvenir"), ("Intime", "coquin")]
par_cat = {"quotidien": [], "souvenir": [], "coquin": []}
ids_vus = set()
soucis = []
compteurs = {"garde": 0, "modifie": 0, "ajoute": 0, "supprime": 0}

for nom, cat in onglets:
    ws = wb[nom]
    # le classeur a soit 8 colonnes (ancien format), soit 9 (avec « Valide le »)
    avec_validation = str(ws.cell(row=4, column=2).value or "").lower().startswith("valide")
    col_q = 3 if avec_validation else 2

    for r in range(5, ws.max_row + 1):
        def lire(c):
            valeur = ws.cell(row=r, column=c).value
            return str(valeur).strip() if valeur is not None else ""

        ident = lire(1)
        q = lire(col_q)
        reps = [lire(col_q + 1 + j) for j in range(4)]
        action = lire(col_q + 5).upper()

        if not q and not any(reps):
            continue
        if action.startswith("SUPPR"):
            compteurs["supprime"] += 1
            continue
        if not q or any(not x for x in reps):
            soucis.append((nom, r, "champ vide"))
            continue
        if not ident:
            soucis.append((nom, r, "id manquant"))
            continue
        if ident in ids_vus:
            soucis.append((nom, r, "id en double : " + ident))
            continue
        ids_vus.add(ident)

        ref = connu.get(ident)
        if ref is None:
            v = AUJOURDHUI
            compteurs["ajoute"] += 1
        elif ref["q"] != q or ref["a"] != reps:
            v = AUJOURDHUI                       # texte modifié : relu aujourd'hui
            compteurs["modifie"] += 1
        else:
            v = ref["v"] or AUJOURDHUI           # inchangé : on garde la date d'origine
            compteurs["garde"] += 1

        par_cat[cat].append({"id": ident, "q": q, "a": reps, "v": v})

if soucis:
    print("PROBLEMES, rien n'a ete ecrit :")
    for s in soucis:
        print("   ", s)
    raise SystemExit(1)

def echappe(t):
    return t.replace("\\", "\\\\").replace('"', '\\"')

entete = '''// ====== BANQUE DE QUESTIONS « BATTLE » ======
// Chaque Battle tire 2 questions « quotidien », 1 « souvenir » et 2 « coquin ».
// Le but n'est pas d'avoir raison : c'est de répondre la même chose que l'autre.
//
// id : identifiant stable. L'app retient les questions déjà sorties
//      (rooms/$room/battleVues) et ne les repropose qu'une fois la catégorie
//      entièrement épuisée. Deux Battles ne peuvent donc pas se recouper.
// v  : date à laquelle la question a été relue et validée. Une question sans
//      « v » n'a jamais été relue.
//
// FICHIER GENERE — ne pas editer a la main.
// Pour modifier la banque : python outils/export-questions.py, editer le
// classeur Questions-Battle.xlsx, puis python outils/import-questions.py

const BATTLE_QUESTIONS = [
'''

titres = {"quotidien": "COMPLICITÉ DU QUOTIDIEN",
          "souvenir": "SOUVENIRS & PROJETS",
          "coquin": "INTIMITÉ DU COUPLE"}

morceaux = [entete]
for cat in ["quotidien", "souvenir", "coquin"]:
    lot = par_cat[cat]
    morceaux.append("\n  // ================= " + titres[cat] + " ================= ("
                    + str(len(lot)) + ")\n")
    for x in lot:
        reps = ",".join('"' + echappe(r) + '"' for r in x["a"])
        morceaux.append("  { id:'%s', cat:'%s', v:'%s', q:\"%s\", a:[%s] },\n"
                        % (x["id"], cat, x["v"], echappe(x["q"]), reps))

texte = "".join(morceaux).rstrip().rstrip(",") + "\n];\n"
io.open(JS, "w", encoding="utf-8").write(texte)

total = sum(len(v) for v in par_cat.values())
print("battle-data.js regenere :", total, "questions")
for cat in ["quotidien", "souvenir", "coquin"]:
    print("   ", cat, ":", len(par_cat[cat]))
print("   inchangees", compteurs["garde"], "| modifiees", compteurs["modifie"],
      "| ajoutees", compteurs["ajoute"], "| supprimees", compteurs["supprime"])
print("   battles sans repetition :",
      min(len(par_cat["quotidien"]) // 2, len(par_cat["souvenir"]), len(par_cat["coquin"]) // 2))
