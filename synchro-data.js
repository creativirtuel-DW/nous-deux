/**
 * Nous Deux — banque de questions « On est synchro ! »
 * ====================================================
 * Une question, 4 réponses. Le but : répondre LA MÊME CHOSE que l'autre.
 * « Moi » / « Toi » désignent une personne (résolu comme dans la Battle :
 * « Moi » chez l'un == « Toi » chez l'autre).
 *
 * ⚠️ Ne jamais changer un id existant : il porte la mémoire anti-répétition
 * (rooms/$room/synchroVues).
 */
const SYNCHRO_QUESTIONS = [
  // ---------- COUPLE ----------
  { id:'s01', cat:'couple', q:"Qui a fait le premier pas ?", a:["Moi", "Toi", "Les deux en même temps", "On ne sait plus vraiment"] },
  { id:'s02', cat:'couple', q:"Qui s'excuse en premier après une dispute ?", a:["Moi", "Toi", "Personne, on laisse passer", "Ça dépend de qui a tort"] },
  { id:'s03', cat:'couple', q:"Qui est le plus jaloux de nous deux ?", a:["Moi", "Toi", "Autant l'un que l'autre", "Aucun des deux"] },
  { id:'s04', cat:'couple', q:"Qui dit « je t'aime » le plus souvent ?", a:["Moi", "Toi", "Autant tous les deux", "On le montre plus qu'on le dit"] },
  { id:'s05', cat:'couple', q:"Qui est le plus têtu ?", a:["Moi", "Toi", "Les deux, sans hésiter", "Aucun, on sait céder"] },
  { id:'s06', cat:'couple', q:"Ce qui nous fait le plus rire ensemble :", a:["Nos bêtises du quotidien", "Les enfants", "Les films et les séries", "Nos vieux souvenirs"] },
  { id:'s07', cat:'couple', q:"Le geste qui fait le plus plaisir dans notre couple :", a:["Un câlin surprise", "Un petit mot doux", "Un service rendu sans rien demander", "Un compliment"] },
  { id:'s08', cat:'couple', q:"Notre plus gros point faible de couple :", a:["On ne se parle pas assez", "On se dispute pour des bêtises", "On manque de temps à deux", "On remet tout à plus tard"] },
  { id:'s09', cat:'couple', q:"Pour une soirée idéale à deux, on choisit :", a:["Un resto", "Un ciné", "Un dîner aux chandelles à la maison", "Une soirée avec des amis"] },
  { id:'s10', cat:'couple', q:"Qui a le plus changé depuis notre rencontre ?", a:["Moi", "Toi", "Les deux", "Aucun, on est restés les mêmes"] },
  { id:'s11', cat:'couple', q:"Après une dure journée, ce qui fait le plus de bien :", a:["Un long câlin", "En parler ensemble", "Un moment seul(e) au calme", "Un bon repas"] },
  { id:'s12', cat:'couple', q:"Qui est le plus romantique ?", a:["Moi", "Toi", "Autant l'un que l'autre", "Aucun, on est plutôt pratiques"] },

  // ---------- QUOTIDIEN AVEC LES ENFANTS ----------
  { id:'s13', cat:'quotidien', q:"Qui se lève la nuit quand un enfant appelle ?", a:["Moi", "Toi", "Chacun son tour", "Celui qui dort le moins bien"] },
  { id:'s14', cat:'quotidien', q:"Qui est le plus sévère avec les enfants ?", a:["Moi", "Toi", "Pareil tous les deux", "Aucun, on est des gentils"] },
  { id:'s15', cat:'quotidien', q:"Qui cède le plus facilement aux enfants ?", a:["Moi", "Toi", "Les deux, ils nous ont eus", "Aucun, on tient bon"] },
  { id:'s16', cat:'quotidien', q:"Le moment le plus stressant de la journée chez nous :", a:["Le matin avant l'école", "Le retour du travail", "Le dîner", "Le coucher des enfants"] },
  { id:'s17', cat:'quotidien', q:"Qui oublie le plus souvent un rendez-vous ou une affaire des enfants ?", a:["Moi", "Toi", "Autant tous les deux", "Personne, on est au point"] },
  { id:'s18', cat:'quotidien', q:"La tâche ménagère qui crée le plus de tensions chez nous :", a:["Le linge", "La vaisselle", "Le ménage", "Les courses"] },
  { id:'s19', cat:'quotidien', q:"Qui fait le plus de ménage ?", a:["Moi", "Toi", "On partage à peu près", "Ça dépend des semaines"] },
  { id:'s20', cat:'quotidien', q:"Le soir, une fois les enfants couchés, on…", a:["Regarde une série", "Va se coucher direct", "Range la maison", "Profite l'un de l'autre"] },
  { id:'s21', cat:'quotidien', q:"Qui gère le mieux les crises des enfants ?", a:["Moi", "Toi", "Pareil tous les deux", "Aucun, c'est eux qui gagnent"] },
  { id:'s22', cat:'quotidien', q:"Le repas de semaine le plus fréquent chez nous :", a:["Pâtes", "Un vrai plat maison", "Surgelé ou livraison", "Les restes"] },
  { id:'s23', cat:'quotidien', q:"Qui fait les courses le plus souvent ?", a:["Moi", "Toi", "Ensemble", "Le drive ou la livraison"] },
  { id:'s24', cat:'quotidien', q:"Ce qui nous manque le plus depuis les enfants :", a:["Les grasses matinées", "Les sorties en amoureux", "Le calme", "La spontanéité au lit"] },
  { id:'s25', cat:'quotidien', q:"Qui passe le plus de temps sur son téléphone ?", a:["Moi", "Toi", "Autant tous les deux", "Aucun, on se surveille"] },
  { id:'s26', cat:'quotidien', q:"Le week-end idéal en famille :", a:["Une sortie nature", "Un parc ou une activité", "Une journée pyjama", "Chez la famille ou des amis"] },

  // ---------- INTIME ----------
  { id:'s27', cat:'intime', q:"Qui a le plus souvent envie ?", a:["Moi", "Toi", "Autant l'un que l'autre", "Ça dépend des périodes"] },
  { id:'s28', cat:'intime', q:"Notre moment préféré pour faire l'amour :", a:["Le matin", "L'après-midi", "Le soir", "En pleine nuit"] },
  { id:'s29', cat:'intime', q:"La position qu'on préfère tous les deux :", a:["Missionnaire", "Levrette", "Elle au-dessus", "En cuillère"] },
  { id:'s30', cat:'intime', q:"L'endroit le plus excitant pour le faire (déjà fait ou à faire) :", a:["Dans la voiture", "En pleine nature", "À l'hôtel", "Ailleurs que dans la chambre"] },
  { id:'s31', cat:'intime', q:"Qui prend le plus souvent l'initiative ?", a:["Moi", "Toi", "Chacun son tour", "Ça se fait tout seul"] },
  { id:'s32', cat:'intime', q:"Ce qu'on devrait faire plus souvent :", a:["Des préliminaires plus longs", "Des câlins après", "Essayer de nouvelles choses", "Le faire, tout simplement"] },
  { id:'s33', cat:'intime', q:"La fréquence idéale pour nous :", a:["Tous les jours", "2 à 3 fois par semaine", "Une fois par semaine", "Quand l'envie vient"] },
  { id:'s34', cat:'intime', q:"Le jouet qu'on essaierait en premier :", a:["Un vibromasseur", "Des menottes", "Un plug", "Un anneau vibrant"] },
  { id:'s35', cat:'intime', q:"Qui est le plus bruyant ?", a:["Moi", "Toi", "Les deux, pardon les voisins", "Aucun, on est discrets"] },
  { id:'s36', cat:'intime', q:"La tenue qui fait le plus d'effet :", a:["De la dentelle", "Rien du tout", "Des porte-jarretelles", "Une simple chemise"] },
  { id:'s37', cat:'intime', q:"Ce qui nous excite le plus :", a:["Des messages coquins dans la journée", "Un regard qui en dit long", "Un déshabillage lent", "Une envie soudaine, n'importe où"] },
  { id:'s38', cat:'intime', q:"Le fantasme qu'on serait le plus prêts à réaliser :", a:["Faire l'amour dehors", "Se filmer", "Un jeu de rôle", "Le faire dans un lieu public discret"] },

  // ---------- PROJETS ----------
  { id:'s39', cat:'projets', q:"Où se voit-on vivre dans 10 ans ?", a:["Au même endroit", "Au bord de la mer", "À la campagne", "À l'étranger"] },
  { id:'s40', cat:'projets', q:"Notre prochain gros projet :", a:["Des travaux dans la maison", "Un grand voyage", "Changer de voiture", "Agrandir la famille"] },
  { id:'s41', cat:'projets', q:"Le voyage de nos rêves :", a:["Des îles paradisiaques", "Un road trip aux États-Unis", "L'Asie", "Un tour d'Europe"] },
  { id:'s42', cat:'projets', q:"Pour notre retraite, on se voit…", a:["Voyager sans arrêt", "Dans une maison au soleil", "Près des petits-enfants", "Toujours aussi occupés"] },
  { id:'s43', cat:'projets', q:"Si on gagnait au loto, la première chose :", a:["La maison de nos rêves", "Arrêter de travailler", "Le tour du monde", "Mettre la famille à l'abri"] },
  { id:'s44', cat:'projets', q:"Notre prochain week-end en amoureux :", a:["Un spa", "Une ville européenne", "Un chalet à la montagne", "Un hôtel pas loin, sans rien faire"] },
  { id:'s45', cat:'projets', q:"Un autre enfant ?", a:["Oui, bientôt", "Peut-être plus tard", "Non, c'est complet", "On n'en a jamais vraiment parlé"] },
  { id:'s46', cat:'projets', q:"Qui gère le mieux l'argent ?", a:["Moi", "Toi", "Pareil tous les deux", "Personne, ça file"] },
  { id:'s47', cat:'projets', q:"Pour fêter nos années ensemble, on rêve de…", a:["Se (re)marier", "Renouveler nos vœux", "Une grande fête avec tout le monde", "Rien, on n'a pas besoin de ça"] },
  { id:'s48', cat:'projets', q:"Un nouvel animal à la maison ?", a:["Un chien", "Un chat", "Aucun, merci", "Un animal plus original"] },
  { id:'s49', cat:'projets', q:"La prochaine activité à essayer ensemble :", a:["Un cours de danse", "Un sport à deux", "Un atelier cuisine", "Un saut en parachute"] },
  { id:'s50', cat:'projets', q:"Dans 20 ans, nous serons…", a:["Toujours aussi amoureux", "Plus complices que jamais", "Des grands-parents comblés", "Partis vivre au soleil"] }
];
