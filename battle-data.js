// ====== BANQUE DE QUESTIONS « BATTLE » ======
// Chaque Battle tire 2 questions « quotidien », 1 « souvenir » et 2 « coquin ».
// Le but n'est pas d'avoir raison : c'est de répondre la même chose que l'autre.
// Vous pouvez enrichir cette banque depuis l'onglet Cartes de l'app
// (les questions ajoutées vivent dans Firebase, pas dans ce fichier).

const BATTLE_QUESTIONS = [

  // ---------- COMPLICITÉ DU QUOTIDIEN ----------
  { cat:'quotidien', q:"Notre soirée idéale à deux, c'est plutôt…", a:["Canapé, plaid et série","Un bon restaurant","Recevoir des amis","Une sortie improvisée"] },
  { cat:'quotidien', q:"Le plat qu'on commande les yeux fermés ?", a:["Pizza","Sushis","Burger","Un bon tajine maison"] },
  { cat:'quotidien', q:"Qui craque le premier devant un dessert ?", a:["Moi, sans hésiter","Toi, évidemment","Les deux en même temps","Ni l'un ni l'autre, on est sages"] },
  { cat:'quotidien', q:"Le dimanche matin parfait ?", a:["Grasse matinée","Petit déj au lit","Balade au marché","Sport et bonne conscience"] },
  { cat:'quotidien', q:"Ce qui nous fait le plus rire ensemble ?", a:["Nos private jokes","Les gens autour de nous","Un bon film comique","Nos propres bêtises"] },
  { cat:'quotidien', q:"Qui est le plus bordélique à la maison ?", a:["Moi","Toi","Autant l'un que l'autre","Personne, on est nickel"] },
  { cat:'quotidien', q:"Notre pire corvée ménagère ?", a:["Le repassage","La vaisselle","Passer l'aspirateur","Nettoyer la salle de bain"] },
  { cat:'quotidien', q:"Si on avait un dimanche entier sans obligations ?", a:["Au lit le plus longtemps possible","Une escapade à deux","Un gros projet maison","Chacun sa bulle, tranquilles"] },
  { cat:'quotidien', q:"Qui décide vraiment du film qu'on regarde ?", a:["Moi","Toi","On négocie","On finit par ne rien regarder"] },
  { cat:'quotidien', q:"Notre boisson de couple ?", a:["Un bon verre de vin","Une bière fraîche","Un cocktail","Un thé ou un café"] },
  { cat:'quotidien', q:"Qui râle le plus le matin ?", a:["Moi","Toi","Les deux","Personne, on est du matin"] },
  { cat:'quotidien', q:"La petite attention qui fait toujours mouche ?", a:["Un message inattendu","Un câlin sans raison","Préparer son plat préféré","Lui laisser la grasse matinée"] },
  { cat:'quotidien', q:"Notre dispute la plus récurrente porte sur…", a:["Le rangement","Les horaires et les retards","L'argent","Franchement, on ne se dispute pas"] },
  { cat:'quotidien', q:"Qui conduit quand on part loin ?", a:["Moi","Toi","On alterne","Celui qui est le moins fatigué"] },
  { cat:'quotidien', q:"Le truc qu'on remet toujours à demain ?", a:["Le ménage à fond","Trier les papiers","Prendre rendez-vous","Ranger le garage"] },
  { cat:'quotidien', q:"Notre façon de se réconcilier ?", a:["Un câlin et on n'en parle plus","On en discute vraiment","Un bon repas","L'humour désamorce tout"] },
  { cat:'quotidien', q:"Qui prend le plus de place dans le lit ?", a:["Moi","Toi","Le chat ou les enfants","On est bien rangés"] },
  { cat:'quotidien', q:"Ce qu'on ferait avec 1000 € tombés du ciel ?", a:["Un week-end à deux","On l'économise","Un truc pour la maison","Un cadeau chacun"] },

  // ---------- SOUVENIRS & PROJETS ----------
  { cat:'souvenir', q:"Notre plus beau souvenir à deux ?", a:["Un voyage","Le jour de notre rencontre","Une fête inoubliable","Un moment tout simple à la maison"] },
  { cat:'souvenir', q:"Ce qui nous a le plus rapprochés ?", a:["Une épreuve traversée ensemble","Un voyage","Le quotidien, jour après jour","Un fou rire mémorable"] },
  { cat:'souvenir', q:"La prochaine folie qu'on devrait faire ?", a:["Partir à l'autre bout du monde","Déménager","Un saut en parachute","Une nuit dans un endroit insolite"] },
  { cat:'souvenir', q:"Notre meilleure destination jusqu'ici ?", a:["La mer","La montagne","Une grande ville","La campagne, au calme"] },
  { cat:'souvenir', q:"Le premier truc qui t'a plu chez l'autre ?", a:["Le sourire","L'humour","Le regard","Le caractère"] },
  { cat:'souvenir', q:"Notre prochain grand projet ?", a:["La maison","Un voyage","La famille","Changer de vie professionnelle"] },
  { cat:'souvenir', q:"Notre chanson, ce serait…", a:["Celle de notre rencontre","Celle qu'on chante en voiture","Une de nos vacances","On n'en a pas vraiment une"] },
  { cat:'souvenir', q:"Le cadeau le plus réussi qu'on se soit fait ?", a:["Un bijou","Un voyage","Un objet fait main","Une surprise organisée"] },
  { cat:'souvenir', q:"Dans 10 ans, on se voit où ?", a:["Dans une maison à la campagne","Au bord de la mer","À l'étranger","Exactement là où on est"] },
  { cat:'souvenir', q:"Notre pire souvenir de vacances ?", a:["Une galère de transport","Une météo catastrophique","Un logement raté","On n'en a pas eu"] },
  { cat:'souvenir', q:"Ce dont on est le plus fiers ensemble ?", a:["Notre famille","Ce qu'on a construit","D'avoir tenu bon","D'être encore aussi complices"] },
  { cat:'souvenir', q:"Si on refaisait notre première soirée ?", a:["Exactement pareil","Avec plus d'audace","Ailleurs, mais à deux","Plus tôt dans nos vies"] },

  // ---------- INTIMITÉ DU COUPLE ----------
  // Questions volontairement directes : c'est ce qui rend l'Osmose parlante.
  { cat:'coquin', q:"La position qu'on refait le plus souvent ?", a:["Le missionnaire","La levrette","À califourchon","La cuillère"] },
  { cat:'coquin', q:"Le sexe oral, pour toi, c'est…", a:["Indispensable à chaque fois","Un préliminaire parmi d'autres","Un plaisir à part entière","Occasionnel"] },
  { cat:'coquin', q:"Notre rythme idéal par semaine ?", a:["1 à 2 fois","3 à 4 fois","5 fois et plus","Tous les jours"] },
  { cat:'coquin', q:"Qui atteint l'orgasme le plus vite ?", a:["Moi","Toi","À peu près en même temps","Ça dépend vraiment des soirs"] },
  { cat:'coquin', q:"Tu préfères quand c'est…", a:["Doux et lent","Rapide et intense","Long et joueur","Ça dépend de l'humeur"] },
  { cat:'coquin', q:"Ce qui te ferait craquer sur-le-champ ?", a:["Une fellation surprise","Un strip-tease","Des mots crus à l'oreille","Être attaché·e"] },
  { cat:'coquin', q:"L'endroit du corps où tu préfères être embrassé·e ?", a:["Le cou","L'intérieur des cuisses","Le bas du ventre","Les lèvres"] },
  { cat:'coquin', q:"La pratique qu'on n'a jamais faite et qui te tente le plus ?", a:["La sodomie","Un jeu de domination","L'exhibition","Se filmer"] },
  { cat:'coquin', q:"Où on devrait le faire ce week-end ?", a:["Sous la douche","Sur la table de la cuisine","Dans la voiture","Dehors, à la nuit tombée"] },
  { cat:'coquin', q:"Le sextoy qu'on devrait s'offrir ?", a:["Un vibromasseur","Un plug","Un anneau","Aucun, on n'en a pas besoin"] },
  { cat:'coquin', q:"Qui devrait prendre le contrôle plus souvent ?", a:["Moi","Toi","Chacun son tour","On est déjà bien équilibrés"] },
  { cat:'coquin', q:"Le meilleur moment pour un rapport express ?", a:["Le matin avant le travail","L'après-midi, en douce","En rentrant le soir","En pleine nuit"] },
  { cat:'coquin', q:"Ce qui manque le plus à notre vie sexuelle ?", a:["La fréquence","La spontanéité","L'audace","Rien, elle me va très bien"] },
  { cat:'coquin', q:"Nos meilleurs ébats, c'était plutôt…", a:["Un matin au réveil","Un après-midi volé","Une nuit entière","Un rapport pressé et brûlant"] },
  { cat:'coquin', q:"Le fantasme le plus réaliste à réaliser cette année ?", a:["Un jeu de rôle","Une nuit à l'hôtel","Se filmer","Un club libertin"] },
  { cat:'coquin', q:"Pendant l'amour, tu aimes…", a:["Le silence","Parler cru","Les gémissements","De la musique en fond"] },
  { cat:'coquin', q:"Ce qui te met le plus en condition dans la journée ?", a:["Un message très explicite","Une photo osée","Un geste discret en public","Ne rien savoir et être surpris·e"] },
  { cat:'coquin', q:"On devrait finir plus souvent…", a:["En même temps","Chacun son tour","Peu importe, c'est le trajet qui compte","Deux fois plutôt qu'une"] }
];
