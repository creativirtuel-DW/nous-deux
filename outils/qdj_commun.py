# -*- coding: utf-8 -*-
"""
Outils partagés de la « question du jour » : lecture et écriture de qdj-data.js.

qdj-data.js contient un bloc JSON pur entre les marqueurs /*JSON*/ et /*FIN*/ :
l'appli le charge comme un script, et le Worker Cloudflare le télécharge et
en extrait le JSON pour connaître la question du matin. Les deux doivent donc
toujours lire exactement le même fichier.
"""
import io, os, json

RACINE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
JS = os.path.join(RACINE, "qdj-data.js")
XLSX = os.path.join(RACINE, "Questions-du-jour.xlsx")

# (nom d'onglet, code de catégorie) — l'ordre est celui de la rotation :
# jour 0 = « nous », jour 1 = « souvenir », jour 2 = « coquin », jour 3 = « envie »…
CATEGORIES = [
    ("Nous deux", "nous"),
    ("Souvenirs", "souvenir"),
    ("Coquin", "coquin"),
    ("Envies et projets", "envie"),
]

# Jour 0 de la rotation. Ne pas le changer : toutes les dates en découlent.
DEBUT = "2026-11-09"

ENTETE = """// ====== QUESTION DU JOUR ======
// Une question par jour, envoyée à 10 h (heure de Paris) par le Worker
// Cloudflare. Le « jour » va de 10 h à 10 h le lendemain : on a 24 h pour répondre.
//
// La question du jour n est la n-ième de la ROTATION : les catégories
// alternent dans l'ordre de « ordre », et chacune avance dans l'ordre du fichier.
// n = nombre de jours écoulés depuis « debut », modulo la taille de la banque.
//
// v : date de relecture par l'utilisateur (vide = jamais relue).
//
// FICHIER GENERE — ne pas editer a la main.
// python outils/export-qdj.py -> editer Questions-du-jour.xlsx -> python outils/import-qdj.py
// Le bloc entre les deux marqueurs JSON / FIN doit rester du JSON strict : le Worker le lit.

const QDJ = /*JSON*/"""


def lire():
    texte = io.open(JS, encoding="utf-8").read()
    bloc = texte.split("/*JSON*/", 1)[1].split("/*FIN*/", 1)[0]
    return json.loads(bloc)


def ecrire(questions):
    """questions : liste de dicts {id, cat, v, q}, dans l'ordre voulu par catégorie."""
    lignes = []
    for x in questions:
        lignes.append("  " + json.dumps({"id": x["id"], "cat": x["cat"], "v": x.get("v", ""), "q": x["q"]},
                                        ensure_ascii=False))
    texte = (ENTETE + "{\n"
             + '"debut": "' + DEBUT + '",\n'
             + '"ordre": ' + json.dumps([c for _, c in CATEGORIES]) + ",\n"
             + '"questions": [\n' + ",\n".join(lignes) + "\n]\n"
             + "}/*FIN*/;\n")
    io.open(JS, "w", encoding="utf-8", newline="\n").write(texte)
    lire()  # garde-fou : le bloc doit se relire sans erreur
