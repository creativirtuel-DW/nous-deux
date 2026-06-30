// Banque de cartes par défaut. category: 'question' | 'defi' | 'gage'
// Chaque carte a un id stable ("d0", "d1"...) pour pouvoir être masquée/éditée depuis l'appli.
const DEFAULT_CARDS_RAW = [
  // QUESTIONS (découverte / complicité)
  { cat:'question', text:"Quel est le souvenir le plus tendre que tu gardes de nous deux ?", pts:10 },
  { cat:'question', text:"Si on pouvait revivre une seule de nos journées ensemble, laquelle choisirais-tu ?", pts:10 },
  { cat:'question', text:"Quelle qualité chez moi t'a fait craquer au tout début ?", pts:10 },
  { cat:'question', text:"Quel est le rêve qu'on n'a pas encore réalisé ensemble ?", pts:15 },
  { cat:'question', text:"Décris-moi en trois mots, sans réfléchir.", pts:5 },
  { cat:'question', text:"Quelle habitude de moi te fait sourire en cachette ?", pts:10 },
  { cat:'question', text:"Où aimerais-tu qu'on soit dans 5 ans ?", pts:15 },
  { cat:'question', text:"Quel petit geste du quotidien te fait te sentir aimé(e) ?", pts:10 },
  { cat:'question', text:"Raconte-moi un moment où tu as été fier/fière de moi.", pts:10 },
  { cat:'question', text:"Si on partait demain en voyage surprise, où voudrais-tu aller ?", pts:10 },
  { cat:'question', text:"Quelle chanson te fait penser à nous ?", pts:5 },
  { cat:'question', text:"Quel est ton souvenir préféré de notre rencontre ?", pts:10 },

  // DÉFIS (action, complicité physique ou créative)
  { cat:'defi', text:"Improvise une danse de 20 secondes sur la première chanson qui passe.", pts:15 },
  { cat:'defi', text:"Fais-moi un compliment sincère sans utiliser le mot 'beau/belle'.", pts:10 },
  { cat:'defi', text:"Imite la façon dont je parle quand je suis fatigué(e).", pts:15 },
  { cat:'defi', text:"Prends une photo improvisée de nous deux, la plus drôle possible.", pts:10 },
  { cat:'defi', text:"Raconte une blague — si je ne ris pas, tu perds les points.", pts:10 },
  { cat:'defi', text:"Fais-moi un massage des épaules pendant 2 minutes.", pts:15 },
  { cat:'defi', text:"Écris un petit mot doux que je garderai dans mon portefeuille.", pts:15 },
  { cat:'defi', text:"Devine ce à quoi je pense en ce moment, en 3 essais.", pts:10 },
  { cat:'defi', text:"Prépare-moi une boisson surprise avec ce qu'on a dans les placards.", pts:15 },
  { cat:'defi', text:"Chante les 10 premières secondes de notre chanson préférée.", pts:10 },

  // GAGES (espiègles, légers)
  { cat:'gage', text:"Tu dois parler avec un accent au choix de l'autre pendant 10 minutes.", pts:15 },
  { cat:'gage', text:"Laisse l'autre choisir ta tenue pour demain.", pts:10 },
  { cat:'gage', text:"Fais 15 pompes ou squats, au choix du/de la partenaire.", pts:10 },
  { cat:'gage', text:"Envoie un message doux à ton/ta partenaire en plein milieu d'une activité du quotidien (sans prévenir).", pts:15 },
  { cat:'gage', text:"Tu dois répondre 'oui mon cœur' à tout pendant 30 minutes.", pts:15 },
  { cat:'gage', text:"Laisse l'autre publier une story à ta place (gentille, promis).", pts:10 },
  { cat:'gage', text:"Pas de téléphone pendant 1 heure, juste vous deux.", pts:20 },
  { cat:'gage', text:"Tu dois faire un compliment à voix haute à chaque pièce où tu entres ce soir.", pts:10 },

  // SURPRISE (mélange aléatoire de tout, points plus variables)
  { cat:'surprise', text:"Tirage mystère : l'autre choisit pour toi entre une question, un défi ou un gage.", pts:20 },
  { cat:'surprise', text:"Organise un mini rendez-vous improvisé dans les 48h qui suivent.", pts:25 },
  { cat:'surprise', text:"Offre un massage de 5 minutes sans qu'on te le demande deux fois.", pts:15 },
  { cat:'surprise', text:"Prépare le petit-déjeuner ou le dîner surprise de l'autre, sans lui dire.", pts:20 },

  // CONTENU SENSUEL (mêlé aux catégories existantes — pour pimenter la soirée)
  { cat:'question', text:"Quel est ton fantasme que tu n'as encore jamais osé me dire ?", pts:20 },
  { cat:'question', text:"Quelle partie de mon corps préfères-tu, et pourquoi ?", pts:15 },
  { cat:'question', text:"Décris le moment où tu m'as désiré(e) le plus fort.", pts:15 },
  { cat:'question', text:"Qu'est-ce que tu aimerais qu'on essaie ensemble, qu'on n'a jamais fait ?", pts:20 },
  { cat:'question', text:"Sur une échelle de 1 à 10, à quel point as-tu envie de moi là, maintenant ?", pts:10 },

  { cat:'defi', text:"Murmure-moi à l'oreille ce que tu as envie de me faire ce soir.", pts:20 },
  { cat:'defi', text:"Embrasse-moi pendant 30 secondes, lentement, sans t'arrêter.", pts:15 },
  { cat:'defi', text:"Déshabille-moi d'un seul vêtement, à ta façon.", pts:20 },
  { cat:'defi', text:"Fais-moi un massage sensuel de 5 minutes, où tu veux.", pts:20 },
  { cat:'defi', text:"Décris-moi, les yeux dans les yeux, ce que tu as envie qu'on fasse au lit ce soir.", pts:25 },

  { cat:'gage', text:"Tu dois rester en sous-vêtements pour le reste de la soirée.", pts:20 },
  { cat:'gage', text:"Envoie-moi un message coquin maintenant, peu importe où tu es.", pts:15 },
  { cat:'gage', text:"Laisse-moi choisir ta tenue (ou ton absence de tenue) pour la suite de la soirée.", pts:20 },
  { cat:'gage', text:"Pendant 10 minutes, tu dois répondre à toutes mes demandes sans discuter.", pts:25 },
];
const DEFAULT_CARDS = DEFAULT_CARDS_RAW.map((c, i) => ({ ...c, id: 'd' + i }));

const DEFAULT_REWARDS = [
  { pts: 50,  desc: "Un massage complet offert par l'autre" },
  { pts: 100, desc: "Choix du film/série de la soirée, sans contestation" },
  { pts: 200, desc: "Un petit-déjeuner au lit préparé avec amour" },
  { pts: 350, desc: "Une sortie ou activité surprise organisée par l'autre" },
  { pts: 500, desc: "Un week-end ou une grande sortie à planifier ensemble" },
];
