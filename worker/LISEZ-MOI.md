# Relais de notifications — mode d'emploi

Le fichier `push-worker.js` est un petit service à héberger gratuitement chez
Cloudflare. C'est lui qui chiffre et signe les notifications, parce qu'un
iPhone ne peut pas envoyer un push directement à un autre iPhone.

Il ne stocke rien, ne connaît pas la base Firebase, et ne coûte rien :
le plan gratuit couvre 100 000 requêtes par jour, et il **bloque** au lieu de
facturer. Aucune carte bancaire n'est demandée.

---

## 1. Créer le compte

1. Va sur **https://dash.cloudflare.com/sign-up**
2. Adresse e-mail + mot de passe. Pas de carte bancaire.
3. Valide l'e-mail de confirmation.

## 2. Créer le Worker

1. Dans le menu de gauche : **Compute (Workers)** → **Workers & Pages**
2. Bouton **Create** → **Start with Hello World!** → **Deploy**
3. Donne-lui le nom `nous-deux-push`
4. Une fois déployé : **Edit code**
5. Efface tout le contenu de l'éditeur, colle le contenu de `push-worker.js`
6. **Deploy**

L'adresse de ton Worker s'affiche en haut, elle ressemble à :
`https://nous-deux-push.<ton-identifiant>.workers.dev`
**C'est cette adresse qu'il me faut.**

## 3. Enregistrer les clés

Dans la page du Worker : **Settings** → **Variables and Secrets** → **Add**.

Quatre entrées à créer :

| Nom | Type | Valeur |
|---|---|---|
| `VAPID_PRIVATE_KEY` | Secret | la clé privée du fichier `CLES-VAPID-PRIVEES.txt` |
| `VAPID_PUBLIC_KEY` | Secret | la clé publique du même fichier |
| `VAPID_SUBJECT` | Text | `mailto:creativirtuel@gmail.com` |
| `ALLOWED_ORIGIN` | Text | `https://creativirtuel-dw.github.io` |

Puis **Deploy** à nouveau pour que les variables soient prises en compte.

> `ALLOWED_ORIGIN` fait que seul ton site peut appeler ce Worker : une page
> tierce se fait refuser. C'est ce qui empêche quelqu'un d'utiliser ton relais.

## 4. L'adresse du Worker  ✅ fait

Le Worker déployé est **`shy-scene-49bc`**, son adresse est
`https://shy-scene-49bc.creativirtuel.workers.dev` et elle est déjà inscrite
dans `push.js`.

⚠️ Les variables ne s'appliquent **pas** toutes seules : après en avoir ajouté,
il faut aller dans **Deployments → Version History**, cliquer sur `…` en face
de la dernière version et choisir **Promote version**. Sinon le Worker continue
de tourner avec l'ancienne configuration.

## 5. Sur chaque iPhone

1. Supprimer l'ancien raccourci de l'écran d'accueil, réinstaller depuis Safari
   (Partager → Sur l'écran d'accueil).
2. **Ouvrir l'app depuis l'icône**, pas depuis Safari.
3. Appuyer sur **Activer** dans le bandeau 🔔 en haut de l'onglet Jouer.
4. Accepter la demande d'iOS.

À faire une fois par téléphone. Ensuite chacun reçoit les notifications de
l'autre, même app fermée.

---

## Vérifier que le Worker répond

Dans un navigateur, ouvre simplement l'adresse du Worker : il doit répondre
`Nous Deux — relais de push. POST uniquement.` C'est le signe qu'il tourne.

Les erreurs éventuelles se lisent dans l'onglet **Logs** du Worker
(bouton *Begin log stream*).
