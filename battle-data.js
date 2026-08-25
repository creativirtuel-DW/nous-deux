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
  { cat:'coquin', q:"Notre moment préféré pour se retrouver ?", a:["Le matin au réveil","L'après-midi improvisé","Le soir avant de dormir","En pleine nuit"] },
  { cat:'coquin', q:"Ce qui met le plus dans l'ambiance ?", a:["Un massage","Une douche à deux","Un bon verre et de la musique","Un simple regard suffit"] },
  { cat:'coquin', q:"Qui fait le premier pas le plus souvent ?", a:["Moi","Toi","Ça dépend des soirs","On n'a pas besoin de faire de pas"] },
  { cat:'coquin', q:"L'endroit le plus audacieux qui te tente ?", a:["La salle de bain","La cuisine","Dehors, en pleine nature","La voiture"] },
  { cat:'coquin', q:"Le vêtement qui fait le plus d'effet à l'autre ?", a:["La lingerie","Une chemise blanche","Un simple t-shirt à la maison","Rien du tout"] },
  { cat:'coquin', q:"Notre rythme idéal ?", a:["Le plus souvent possible","Deux ou trois fois par semaine","Une fois, mais mémorable","Sans compter, quand ça vient"] },
  { cat:'coquin', q:"Ce qu'on devrait s'autoriser plus souvent ?", a:["Les jeux et les défis","Les massages","Les week-ends rien qu'à deux","Se le dire, tout simplement"] },
  { cat:'coquin', q:"Un fantasme qu'on n'a jamais osé s'avouer ?", a:["Un lieu inattendu","Un déguisement ou un rôle","Un accessoire","On se dit déjà tout"] },
  { cat:'coquin', q:"La partie du corps de l'autre qu'on préfère ?", a:["Les yeux","Le dos","Les mains","Les lèvres"] },
  { cat:'coquin', q:"Le meilleur préliminaire ?", a:["Les mots","Les mains","Un long baiser","L'attente toute la journée"] },
  { cat:'coquin', q:"Un message coquin en pleine journée, ça te fait…", a:["Tenir jusqu'au soir","Rentrer plus tôt","Rougir au travail","Répondre encore plus fort"] },
  { cat:'coquin', q:"Lumière allumée ou éteinte ?", a:["Allumée","Éteinte","Tamisée","Peu importe, franchement"] },
  { cat:'coquin', q:"Ce qui nous manque le plus quand on est séparés ?", a:["Les câlins","Dormir ensemble","Les moments intimes","La présence, tout simplement"] },
  { cat:'coquin', q:"La meilleure façon de finir une soirée ?", a:["Un massage qui dérape","Une douche à deux","Directement au lit","S'endormir enlacés"] },
  { cat:'coquin', q:"Un accessoire à tester ensemble ?", a:["Un bandeau sur les yeux","Des menottes","Une huile de massage","Aucun, on n'en a pas besoin"] },
  { cat:'coquin', q:"Qui est le plus joueur des deux ?", a:["Moi","Toi","Les deux autant","Ça dépend de l'humeur"] }
];
