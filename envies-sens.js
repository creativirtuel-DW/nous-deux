/**
 * Nous Deux — dictionnaire de sens de « Ma liste des envies »
 * ===========================================================
 * Chaque IDÉE regroupe les mots et expressions qui l'évoquent. Une envie
 * écrite librement est analysée DANS LE TÉLÉPHONE : si elle contient une de
 * ces expressions, elle est rattachée à l'idée. Deux envies rattachées à la
 * même idée (dans le même thème) deviennent communes, même formulées
 * différemment (« tester l'anal » = « ta bite dans mon cul » → Sodomie).
 *
 * Écriture des expressions (minuscules, sans accents, comparées mot à mot) :
 *  - « mot* »  = tout mot qui commence par « mot » (sodo* → sodomie, sodomiser) ;
 *  - un pluriel en s/x est accepté automatiquement ;
 *  - dans une expression de plusieurs mots, jusqu'à 2 mots peuvent s'intercaler
 *    (« bite cul » reconnaît « ta bite dans mon cul »).
 * ⚠️ Ne jamais changer un `id` : il sert d'empreinte partagée entre les deux téléphones.
 */
const ENV_IDEES = [
  // ===================== FANTASME COQUIN =====================
  { id:'c-sodomie', cat:'coquin', nom:'Sodomie', mots:['anal','anale','anus','sodo*','encul*','dans mon cul','dans ton cul','dans le cul','dans les fesses','bite cul','queue cul','sexe cul','par derriere','entree des artistes','petit trou','plug*','penetration anale'] },
  { id:'c-anulingus', cat:'coquin', nom:'Anulingus', mots:['anulingus','feuille de rose','lecher cul','lecher anus','lecher fesses','langue cul','langue anus','bouffer cul'] },
  { id:'c-oral', cat:'coquin', nom:'Sexe oral', mots:['fellation','pipe','turlutte','sucer','suce','suces','cunni*','lecher chatte','lecher sexe','lecher clito*','langue chatte','brouter','69','soixante neuf','gorge profonde','bouche bite','bouche queue','oral','orale'] },
  { id:'c-ejac', cat:'coquin', nom:'Éjaculation', mots:['ejac*','jouir dans bouche','jouir sur','jouir dans','avaler','sperme','facial','sur mon visage','sur ton visage','sur mes seins','sur tes seins','creampie','gicler'] },
  { id:'c-trio', cat:'coquin', nom:'Plan à trois', mots:['plan a 3','plan a trois','a trois','a 3','trio','triolisme','menage a trois','une autre femme','un autre homme','une autre fille','un autre mec','une autre meuf','ffh','mmf','mff','hhf','deux hommes','deux femmes','2 hommes','2 femmes','a plusieurs','plusieurs partenaires','a 4','a quatre','en groupe','sexe de groupe','troisieme personne','une troisieme','un troisieme','un tiers','threesome','foursome','avec d autres','quelqu un d autre','autres personnes','une autre personne','inviter quelqu un','une copine avec nous','un copain avec nous'] },
  { id:'c-echangisme', cat:'coquin', nom:'Échangisme / libertinage', mots:['echang*','libertin*','club libertin','sauna libertin','melangisme','swing*','autre couple','soiree libertine','partouze','orgie','gang bang','gangbang','a plusieurs','en groupe','sexe de groupe','plusieurs couples'] },
  { id:'c-candaul', cat:'coquin', nom:'Regarder l’autre avec quelqu’un', mots:['candaul*','cuckold','cocu','hotwife','te regarder avec','me regarder avec','regarder baiser','te voir avec','me voir avec','te partager','me partager'] },
  { id:'c-dehors', cat:'coquin', nom:'Faire l’amour dehors', mots:['dehors','plein air','exterieur','nature','foret','bois','plage','jardin','piscine','mer','campagne','champ','sous les etoiles','montagne','prairie'] },
  { id:'c-public', cat:'coquin', nom:'Lieu insolite / risque d’être vus', mots:['exhib*','public','publique','voiture','lieu insolite','insolite','ascenseur','cabine','toilettes','parking','etre vu','etre vus','se faire surprendre','bureau','au travail','cinema','train','avion','escalier'] },
  { id:'c-bondage', cat:'coquin', nom:'Attacher / bondage', mots:['attach*','menott*','ligot*','corde*','bondage','shibari','pieds et poings','immobilis*','lien','liens'] },
  { id:'c-yeux', cat:'coquin', nom:'Les yeux bandés', mots:['bandeau','yeux bandes','yeux bande','aveugl*','les yeux fermes','foulard sur les yeux','masque sur les yeux'] },
  { id:'c-domination', cat:'coquin', nom:'Domination / soumission', mots:['domin*','soumi*','maitre*','esclave','bdsm','sado*','maso*','sm','obei*','a genoux','a quatre pattes','donner des ordres','ordres','collier','laisse','tirer les cheveux','etrangl*','controle'] },
  { id:'c-fessee', cat:'coquin', nom:'Fessée', mots:['fessee*','fouet*','cravach*','martinet','claque*','taper fesses','taper cul','paddle'] },
  { id:'c-role', cat:'coquin', nom:'Jeu de rôle', mots:['jeu de role','jeux de role','deguis*','infirmiere','docteur','medecin','prof','professeur','eleve','policier*','policiere','inconnu*','faire semblant','scenario','role play','roleplay','costume','soubrette','secretaire','patron','plombier','prostitu*','escort','masseuse','premier rendez vous'] },
  { id:'c-toys', cat:'coquin', nom:'Sextoys', mots:['sextoy*','sex toy*','vibro*','gode*','canard','jouet*','oeuf vibrant','womanizer','rabbit','stimulateur','masturbateur','fleshlight','boules de geisha','cockring','anneau'] },
  { id:'c-pegging', cat:'coquin', nom:'Gode-ceinture', mots:['pegging','gode ceinture','strap on','strapon','prendre homme','prostate'] },
  { id:'c-filmer', cat:'coquin', nom:'Se filmer / photos', mots:['film*','video*','camera','photo*','nude*','sextape','sex tape','miroir','se regarder','nous regarder','enregistr*'] },
  { id:'c-porno', cat:'coquin', nom:'Regarder un film X ensemble', mots:['porno*','porn*','film x','films x','un x','film erotique','video x','regarder du x'] },
  { id:'c-massage', cat:'coquin', nom:'Massage sensuel', mots:['massage*','masser','huile*','tantra*','nuru','corps a corps','body body','caresses'] },
  { id:'c-lingerie', cat:'coquin', nom:'Lingerie / tenue sexy', mots:['lingerie','porte jarretelle*','jarretelle*','bas','string','guepiere','tenue sexy','talons','talon','resille','latex','cuir','vinyle','nuisette','body','corset','sous vetement*','culotte','sans culotte'] },
  { id:'c-strip', cat:'coquin', nom:'Strip-tease / danse sexy', mots:['strip*','effeuill*','danse sexy','lap dance','lapdance','danse lascive','danser pour','danse erotique','pole dance'] },
  { id:'c-masturb', cat:'coquin', nom:'Se caresser devant l’autre', mots:['masturb*','se toucher','te toucher','me toucher','branl*','doigter','doigte','plaisir solitaire','caresser devant','toucher devant'] },
  { id:'c-positions', cat:'coquin', nom:'Nouvelles positions', mots:['position*','kamasutra','kama sutra','levrette','andromaque','cuillere','missionnaire','debout','sur la table','contre le mur','chevauch*','cowgirl','a califourchon','par terre','sur le canape'] },
  { id:'c-hotel', cat:'coquin', nom:'Nuit d’hôtel coquine', mots:['hotel','love room','loveroom','chambre a theme','chambre d hotel','nuit d hotel','motel'] },
  { id:'c-sexto', cat:'coquin', nom:'Messages coquins', mots:['sexto','sextos','sexting','message coquin','messages coquins','message chaud','messages chauds','telephone rose','appel coquin','visio','facetime','a distance','par telephone'] },
  { id:'c-quickie', cat:'coquin', nom:'Coup rapide', mots:['quick*','a la va vite','coup rapide','vite fait','rapide','5 minutes'] },
  { id:'c-marathon', cat:'coquin', nom:'Marathon toute la nuit', mots:['toute la nuit','marathon','plusieurs fois','toute la journee','toute une journee','sans s arreter','jusqu au matin','week end au lit','au lit tout le week end'] },
  { id:'c-douche', cat:'coquin', nom:'Sous la douche / dans le bain', mots:['douche','bain','baignoire','jacuzzi','spa','hammam','sauna','sous l eau'] },
  { id:'c-fontaine', cat:'coquin', nom:'Femme fontaine', mots:['squirt*','fontaine','femme fontaine','gicl*'] },
  { id:'c-tease', cat:'coquin', nom:'Faire durer / frustrer', mots:['faire durer','edging','frustr*','teasing','tease','chastete','retenir','interdiction de jouir','orgasme controle','supplier'] },
  { id:'c-gourmand', cat:'coquin', nom:'Jeux gourmands', mots:['chantilly','chocolat','glacon*','fraise*','miel','nourriture','manger sur','lecher sur','champagne','cire','bougie*'] },
  { id:'c-bisexu', cat:'coquin', nom:'Expérience bi', mots:['bisex*','bi','lesbien*','gay','embrasser une femme','embrasser un homme','avec une femme','avec un homme','avec une fille','avec un mec'] },
  { id:'c-rasage', cat:'coquin', nom:'Rasage intime', mots:['rasage','raser','rase','rasee','epil*','imberbe','integral'] },
  { id:'c-dirty', cat:'coquin', nom:'Parler cru pendant l’amour', mots:['parler cru','mots crus','dirty talk','parler sale','dire des cochonneries','cochonnerie*','insult*','vulgaire'] },
  { id:'c-sauvage', cat:'coquin', nom:'Sexe sauvage / brutal', mots:['sauvage','brutal*','plus fort','violent*','bestial','animal','defoncer','prendre fort','arracher','plaquer'] },
  { id:'c-tendre', cat:'coquin', nom:'Faire l’amour tendrement', mots:['tendre*','tendrement','doucement','lentement','lenteur','sensuel*','romantique','yeux dans les yeux','bougies','petales'] },
  { id:'c-reveil', cat:'coquin', nom:'Réveil coquin', mots:['reveil*','reveiller','au reveil','le matin','pendant mon sommeil','pendant que je dors','endormi*'] },

  // ===================== SORTIES À 2 =====================
  { id:'s-resto', cat:'sorties', nom:'Restaurant', mots:['resto*','restaurant*','diner','dejeuner','gastronom*','etoile*','chef','brunch','bistrot','sushi*','pizzeria'] },
  { id:'s-piquenique', cat:'sorties', nom:'Pique-nique', mots:['pique nique','piquenique','picnic','nappe','panier'] },
  { id:'s-cinema', cat:'sorties', nom:'Cinéma', mots:['cinema','cine','film*','avant premiere','drive in','plein air'] },
  { id:'s-concert', cat:'sorties', nom:'Concert / festival', mots:['concert*','festival*','musique','live','groupe','chanteur','chanteuse','opera','zenith','stade'] },
  { id:'s-spectacle', cat:'sorties', nom:'Spectacle / théâtre', mots:['spectacle*','theatre','humour*','one man show','stand up','cirque','cabaret','comedie musicale','ballet','moulin rouge','crazy horse'] },
  { id:'s-danse', cat:'sorties', nom:'Danser / soirée', mots:['danse*','danser','salsa','tango','bachata','boite','club','soiree','discotheque','guinguette','bal'] },
  { id:'s-musee', cat:'sorties', nom:'Musée / expo', mots:['musee*','expo*','galerie','art','chateau*','monument*','visite*','patrimoine'] },
  { id:'s-sensations', cat:'sorties', nom:'Sensations fortes', mots:['parachute','saut','parapente','deltaplane','elastique','sensations fortes','accrobranche','ulm','montgolfiere','helicoptere','plongee','rafting','canyoning','via ferrata','karting','pilotage','circuit','jet ski','quad','escalade','tyrolienne','chute libre','vol'] },
  { id:'s-spa', cat:'sorties', nom:'Spa / bien-être', mots:['spa','thalasso*','hammam','massage*','jacuzzi','sauna','bien etre','soin*','detente','balneo'] },
  { id:'s-escape', cat:'sorties', nom:'Escape game / jeux', mots:['escape*','enigme*','laser game','bowling','billard','jeux','jeu','casino','quiz','blind test','karaoke','flechettes','arcade','minigolf','mini golf'] },
  { id:'s-parc', cat:'sorties', nom:'Parc d’attractions', mots:['parc d attraction*','parc','disney*','asterix','futuroscope','puy du fou','fete foraine','manege*','montagnes russes','zoo','aquarium'] },
  { id:'s-balade', cat:'sorties', nom:'Balade / rando', mots:['balade','rando*','marche','velo','promenade','foret','bord de mer','bord de l eau','lac','sentier','trek'] },
  { id:'s-soleil', cat:'sorties', nom:'Coucher de soleil / étoiles', mots:['coucher de soleil','lever de soleil','coucher du soleil','lever du soleil','etoiles','nuit etoilee','observer','astronom*','pleine lune'] },
  { id:'s-cours', cat:'sorties', nom:'Cours / atelier à deux', mots:['cours','atelier*','apprendre','initiation','stage','poterie','cuisine','oenologie','cocktail*','peinture'] },
  { id:'s-bar', cat:'sorties', nom:'Bar / dégustation', mots:['bar','bars','cocktail*','degust*','vin','vins','biere*','apero','aperitif','rooftop','champagne','whisky','cave'] },
  { id:'s-shopping', cat:'sorties', nom:'Shopping', mots:['shopping','magasin*','boutique*','marche','brocante','vide grenier','acheter'] },
  { id:'s-sport', cat:'sorties', nom:'Match / sport', mots:['match','stade','foot*','rugby','tennis','basket','f1','formule 1','moto gp','course'] },

  // ===================== VOYAGE =====================
  { id:'v-plage', cat:'voyage', nom:'Plage et soleil', mots:['plage*','soleil','ile','iles','tropique*','tropical','maldives','seychelles','maurice','reunion','caraibe*','antilles','guadeloupe','martinique','polynesie','tahiti','bora bora','mer','farniente','lagon','sable','bord de mer','cocotier*','bronzer','transat'] },
  { id:'v-montagne', cat:'voyage', nom:'Montagne / neige', mots:['montagne*','ski','skier','neige','chalet','alpes','pyrenees','station','raquette*','luge','sommet'] },
  { id:'v-roadtrip', cat:'voyage', nom:'Road trip', mots:['road trip','roadtrip','van','camping car','fourgon','en voiture','itinerant','route 66','moto','sans programme','au hasard','a l aventure'] },
  { id:'v-capitale', cat:'voyage', nom:'Ville / city trip', mots:['capitale*','city trip','citytrip','ville','paris','londres','barcelone','madrid','amsterdam','lisbonne','prague','berlin','vienne','budapest','bruxelles','copenhague','dublin','edimbourg'] },
  { id:'v-italie', cat:'voyage', nom:'Italie', mots:['italie','rome','venise','florence','toscane','naples','sicile','sardaigne','amalfi','milan','dolomites','cinque terre','gondole'] },
  { id:'v-grece', cat:'voyage', nom:'Grèce / Méditerranée', mots:['grece','santorin','mykonos','crete','athenes','cyclades','croatie','malte','chypre','corse','mediterranee'] },
  { id:'v-espagne', cat:'voyage', nom:'Espagne / Portugal', mots:['espagne','andalousie','seville','baleares','ibiza','majorque','canaries','portugal','porto','algarve','madere','acores'] },
  { id:'v-usa', cat:'voyage', nom:'États-Unis / Canada', mots:['usa','etats unis','amerique','new york','californie','las vegas','miami','floride','hawai','los angeles','san francisco','canada','quebec','montreal','grand canyon'] },
  { id:'v-asie', cat:'voyage', nom:'Asie', mots:['asie','japon','tokyo','kyoto','thailande','bali','indonesie','vietnam','cambodge','chine','coree','inde','sri lanka','philippines','singapour'] },
  { id:'v-nord', cat:'voyage', nom:'Grand Nord / aurores boréales', mots:['aurore*','boreale*','islande','laponie','norvege','finlande','suede','fjord*','pole nord','igloo','scandinavie','ecosse'] },
  { id:'v-safari', cat:'voyage', nom:'Afrique / safari', mots:['safari','afrique','kenya','tanzanie','zanzibar','afrique du sud','namibie','botswana','maroc','marrakech','egypte','desert','sahara','tunisie'] },
  { id:'v-amsud', cat:'voyage', nom:'Amérique latine', mots:['mexique','cuba','bresil','perou','machu picchu','argentine','chili','patagonie','costa rica','colombie','amerique du sud','amerique latine'] },
  { id:'v-croisiere', cat:'voyage', nom:'Croisière / bateau', mots:['croisiere','bateau','voilier','voile','catamaran','peniche','yacht','navigation','paquebot'] },
  { id:'v-insolite', cat:'voyage', nom:'Nuit insolite', mots:['cabane*','bulle','insolite','yourte','tipi','perchee','sous les etoiles','dans les arbres','roulotte','phare','ice hotel','hotel de glace','ecolodge','lodge'] },
  { id:'v-weekend', cat:'voyage', nom:'Week-end / escapade', mots:['week end','weekend','escapade','surprise','court sejour','deux jours','2 jours','petite escapade','sejour'] },
  { id:'v-tourmonde', cat:'voyage', nom:'Grand voyage / tour du monde', mots:['tour du monde','bout du monde','sac a dos','backpack*','long voyage','un an','plusieurs mois','australie','nouvelle zelande','tout quitter','loin'] },
  { id:'v-lunemiel', cat:'voyage', nom:'Lune de miel', mots:['lune de miel','honeymoon','voyage de noces','voyage de noce'] },
  { id:'v-france', cat:'voyage', nom:'Découvrir la France', mots:['france','bretagne','normandie','provence','alsace','cote d azur','bordeaux','pays basque','dordogne','camargue','loire','bourgogne','lyon','marseille','nice'] },
  { id:'v-train', cat:'voyage', nom:'Voyage en train', mots:['train','orient express','transsiberien','train de nuit','wagon','rail'] },

  // ===================== VIE DE COUPLE =====================
  { id:'p-mariage', cat:'couple', nom:'Mariage / vœux', mots:['mari*','epouser','voeux','pacs','pacser','fiancailles','fiancer','demande en mariage','alliance*','bague','renouveler','officialiser','ceremonie'] },
  { id:'p-enfant', cat:'couple', nom:'Enfant / famille', mots:['enfant*','bebe*','fonder une famille','agrandir la famille','grossesse','enceinte','devenir parent*','adopter un enfant'] },
  { id:'p-animal', cat:'couple', nom:'Adopter un animal', mots:['chien*','chat','chats','animal','animaux','chiot*','chaton*','lapin','cheval','poule*','perroquet'] },
  { id:'p-maison', cat:'couple', nom:'Maison / déménager', mots:['maison','demenag*','acheter','appartement','appart','emmenag*','vivre ensemble','s installer','nid','proprietaire*','achat','construire','piscine','changer de ville','campagne','residence secondaire'] },
  { id:'p-deco', cat:'couple', nom:'Déco / bricolage ensemble', mots:['deco*','bricol*','renov*','travaux','jardin*','potager','amenag*','peindre','meuble*','plantes'] },
  { id:'p-sport', cat:'couple', nom:'Sport ensemble', mots:['sport*','courir','course','running','footing','salle','muscu*','yoga','fitness','natation','nager','velo','marathon','pilates','danse','randonnee','forme'] },
  { id:'p-rituel', cat:'couple', nom:'Temps rien qu’à nous', mots:['rituel*','rien qu a nous','temps pour nous','soiree a deux','date night','chaque semaine','toutes les semaines','sans ecran*','sans telephone','deconnect*','dimanche','tete a tete','en amoureux','plus de temps'] },
  { id:'p-parler', cat:'couple', nom:'Se parler davantage', mots:['parler','communiqu*','se dire','dire plus','ecoute*','compliment*','je t aime','exprimer','confier','confidence*','discuter','discussion*'] },
  { id:'p-tendresse', cat:'couple', nom:'Plus de tendresse', mots:['calin*','tendresse','bisou*','dormir colles','dormir ensemble','la main','tenir la main','cocooning','cocoon','serrer','blottir','petites attentions','attention*','surprise*','mots doux'] },
  { id:'p-cuisine', cat:'couple', nom:'Cuisiner ensemble', mots:['cuisiner','cuisine','recette*','petit dej*','petit dejeuner','repas','patisser*','gateau*','barbecue','plancha','diner maison'] },
  { id:'p-argent', cat:'couple', nom:'Projets d’argent / pro', mots:['economis*','epargne','argent','projet*','entreprise','investir','investissement','budget','retraite','boulot','travail','job','creer'] },
  { id:'p-souvenirs', cat:'couple', nom:'Garder nos souvenirs', mots:['souvenir*','album*','carnet','journal','photo*','scrapbook','video*','livre','ecrire','lettre*','capsule'] },
  { id:'p-amis', cat:'couple', nom:'Voir plus nos amis / famille', mots:['amis','copains','copines','voir la famille','recevoir','inviter','soiree entre amis','diner entre amis','beaux parents','mes parents','tes parents'] },
  { id:'p-sante', cat:'couple', nom:'Prendre soin de nous', mots:['sante','manger mieux','manger sain','arreter de fumer','arreter l alcool','dormir plus','sommeil','regime','minceur','bien etre','meditation','mediter','stress'] },
  { id:'p-apprendre', cat:'couple', nom:'Apprendre quelque chose ensemble', mots:['apprendre','langue','anglais','espagnol','italien','instrument','piano','guitare','formation','lire','lecture','livres'] },
  { id:'p-vacances', cat:'couple', nom:'Plus de vacances à deux', mots:['vacances','conges','partir','plus souvent','sans les enfants','pause','break','repos'] }
];
