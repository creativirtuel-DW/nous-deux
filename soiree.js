// =========================================================
//  SOIRÉE GUIDÉE
//  Un seul parcours, en trois paliers : 3 cartes SOFT, puis 3 cartes
//  CHAUD, puis 2 cartes HOT. Chaque carte s'applique aux DEUX, et la
//  suivante ne se découvre que lorsque tous les deux l'ont validée.
//  Le passage d'un palier au suivant est annoncé en grand.
//  Les points de chaque carte sont gagnés par les deux joueurs.
// =========================================================

// Les points d'une carte valent moitié moins en soirée guidée : le parcours
// en distribue huit d'affilée, il ne doit pas faire exploser les scores d'un
// coup ni vider les paliers de récompenses en une seule veillée.
const SOIREE_DIVISEUR = 2;
function soireePoints(pts){ return Math.round(pts / SOIREE_DIVISEUR); }

// paliers : les points visés par chaque carte du palier, et le plafond du
// vivier dans lequel il pioche. C'est ce qui donne sa forme à la soirée.
// L'annonce s'affiche juste avant la première carte du palier.
const SOIREE_ETAPES = [
  { id:'soft',  emoji:'🌸', label:'SOFT',  max:25,   paliers:[10, 15, 20],
    desc:"Complicité et tendresse" },
  { id:'chaud', emoji:'🔥', label:'CHAUD', max:40,   paliers:[25, 25, 30],
    desc:"Ça monte franchement",
    annonce:{ titre:'Félicitations !', texte:'On passe au niveau CHAUD' } },
  { id:'hot',   emoji:'💥', label:'HOT',   max:9999, paliers:[40, 50], haut:2,
    desc:"Plus aucune limite",
    annonce:{ titre:'Bravo !', texte:"On arrive au niveau HOT" } },
];

let soireeActive = false;
let soireeBusy = false;      // garde-fou : la transition ne doit être jouée qu'une fois
let soireeAnnonceVue = {};    // annonces déjà lues SUR CE TÉLÉPHONE (rien à partager)

function openSoiree(){ soireeActive = true; render(); }
function closeSoiree(){ soireeActive = false; render(); }

function sRef(){ return roomRef.child('soiree'); }
function sGet(){ return (state && state.soiree) || null; }
function sEtape(id){ return SOIREE_ETAPES.find(e => e.id === id) || SOIREE_ETAPES[0]; }
function soireeTotalCartes(){ return SOIREE_ETAPES.reduce((n, e) => n + e.paliers.length, 0); }

// Toutes les cartes jouables, catégories mélangées : une soirée qui enchaîne
// une question, un défi puis un gage vaut mieux qu'un bloc monocorde.
function soireePool(plafond){
  const cartes = getActiveDefaultCards().slice();
  if(state && state.customCards){
    Object.entries(state.customCards).forEach(([key, c]) => cartes.push({ ...c, id:key, cat:normCat(c.cat) }));
  }
  const vus = new Set();
  return cartes.filter(c => {
    if(!c.text || c.pts > plafond) return false;
    if(vus.has(c.text)) return false;   // les doublons volontaires ne sortent qu'une fois par soirée
    vus.add(c.text);
    return true;
  });
}

// La montée en intensité est garantie par construction : chaque palier cherche
// une carte valant ces points-là (ou la plus proche encore disponible), sans
// jamais redescendre sous la carte précédente. Découper le vivier en quantiles
// ne suffisait pas : les cartes à 10-30 points sont si nombreuses que la
// soirée pouvait finir sur du 25.
function soireeTirer(exclus){
  const dejaVues = exclus || [];
  const cartes = [];
  const pris = new Set(dejaVues);
  let plancher = 0;

  SOIREE_ETAPES.forEach(etape => {
    const pool = soireePool(etape.max);
    etape.paliers.forEach((cible, i) => {
      let dispo = pool.filter(c => !pris.has(c.id) && c.pts >= plancher);
      if(dispo.length === 0) dispo = pool.filter(c => !pris.has(c.id));
      if(dispo.length === 0) return;

      // Les cartes fortes sont rares : viser la valeur exacte ramènerait les
      // mêmes en fin de soirée à chaque partie. Les « haut » dernières cartes
      // d'un palier piochent donc dans tout ce qui les dépasse — elles seules,
      // sinon la soirée atteint son plafond dès la troisième carte.
      const finale = i >= etape.paliers.length - (etape.haut || 0);
      // Seule la toute dernière carte de la soirée pioche sans plafond : sans
      // cette borne, l'avant-dernière raflait déjà une carte à 100 points et la
      // soirée montait d'un coup au lieu de monter par marches.
      const bouquet = etape === SOIREE_ETAPES[SOIREE_ETAPES.length - 1] && i === etape.paliers.length - 1;
      const plafond = bouquet ? Infinity : Math.round(cible * 1.5);
      let choix = finale ? dispo.filter(c => c.pts >= cible && c.pts <= plafond) : [];
      if(choix.length === 0){
        const ecartMin = Math.min(...dispo.map(c => Math.abs(c.pts - cible)));
        choix = dispo.filter(c => Math.abs(c.pts - cible) === ecartMin);
      }
      // Une carte pour chacun, jamais la même : le tour ne s'ouvre que quand
      // les deux ont trouvé leur carte à ce palier.
      const tirees = [];
      for(let j = 0; j < 2 && choix.length; j++){
        const libres = choix.filter(c => !pris.has(c.id));
        if(libres.length === 0) break;
        const c = libres[Math.floor(Math.random() * libres.length)];
        pris.add(c.id);
        tirees.push({ id:c.id, cat:c.cat, text:c.text, pts:c.pts });
      }
      if(tirees.length < 2) return;
      plancher = Math.min(tirees[0].pts, tirees[1].pts);
      cartes.push({ etape:etape.id, p1:tirees[0], p2:tirees[1] });
    });
  });
  return cartes;
}

function soireeStart(){
  // Relance juste après une soirée : on ne rejoue pas les cartes qui viennent
  // tout juste de sortir.
  const precedente = sGet();
  const exclus = [];
  if(precedente && precedente.cards){
    precedente.cards.forEach(t => { if(t.p1) exclus.push(t.p1.id); if(t.p2) exclus.push(t.p2.id); });
  }
  const cartes = soireeTirer(exclus);
  if(cartes.length === 0){ alert("Aucune carte disponible pour la soirée."); return; }
  soireeAnnonceVue = {};
  sRef().set({ cards:cartes, index:0, done:{}, by:me.id, ts:Date.now() });
  notifyPartner('🌙 Soirée guidée',
    me.name + ' a lancé une soirée : ' + cartes.length + ' cartes pour vous deux.', 'soiree');
}

function soireeStop(){
  if(!confirm("Arrêter la soirée en cours ? Les cartes déjà validées gardent leurs points.")) return;
  sRef().remove();
}

// Chacun sa carte : ma carte du tour, celle de mon/ma partenaire.
function sMaCarte(tour){ return tour ? tour[me.id] : null; }
function sSaCarte(tour){ return tour ? tour[partnerId] : null; }

// Statut d'un joueur sur le tour courant : 'fait', 'refus', ou rien.
// (l'ancien format écrivait `true`, qui vaut « fait »)
function sStatut(d, idx, joueur){
  const done = (d.done && d.done[idx]) || {};
  const v = done[joueur];
  return v === true ? 'fait' : (v || '');
}

// Validation ou refus : chacun n'écrit QUE sa propre réponse. Faire avancer la
// carte depuis ici était un piège — si les deux appuyaient dans la même
// seconde, aucun des deux ne voyait encore la réponse de l'autre, chacun
// n'écrivait que la sienne et la soirée restait bloquée sur « en attente de… »
// des deux côtés. C'est soireeAvancer(), qui tourne à chaque rafraîchissement,
// qui décide de passer à la suite.
function soireeRepondre(statut){
  const d = sGet();
  if(!d || d.fini) return;
  const idx = d.index || 0;
  const tour = (d.cards || [])[idx];
  const carte = sMaCarte(tour);
  if(!carte) return;
  if(sStatut(d, idx, me.id)) return;

  if(statut === 'refus' && !confirm("Refuser cette carte ? Tu perds " + soireePoints(carte.pts) + " points.")) return;

  sRef().child('done/' + idx + '/' + me.id).set(statut);
  notifyPartner('🌙 Soirée guidée',
    statut === 'refus'
      ? me.name + ' a refusé sa carte ' + (idx + 1) + '/' + d.cards.length + '.'
      : me.name + ' a fait sa carte ' + (idx + 1) + '/' + d.cards.length + ' — à toi !',
    'soiree');
}

function soireeFait(){ soireeRepondre('fait'); }
function soireeRefuse(){ soireeRepondre('refus'); }

// Les deux ont répondu : on avance. Les deux téléphones le tentent, mais la
// transaction sur l'index n'en laisse passer qu'un — et seul celui qui
// l'emporte touche aux scores, qui ne peuvent donc pas bouger deux fois. Une
// soirée déjà bloquée se débloque toute seule au prochain affichage.
function soireeAvancer(d){
  if(!d || d.fini || soireeBusy) return;
  const idx = d.index || 0;
  const tours = d.cards || [];
  const tour = tours[idx];
  if(!tour) return;
  const s1 = sStatut(d, idx, 'p1');
  const s2 = sStatut(d, idx, 'p2');
  if(!s1 || !s2) return;

  soireeBusy = true;
  const dernier = idx + 1 >= tours.length;
  sRef().child('index').transaction(
    v => ((v || 0) === idx ? idx + 1 : undefined)
  ).then(res => {
    soireeBusy = false;
    if(!res || !res.committed) return;   // l'autre téléphone a déjà avancé

    // Une carte refusée coûte ses points au lieu de les rapporter.
    const g1 = soireePoints(tour.p1.pts) * (s1 === 'refus' ? -1 : 1);
    const g2 = soireePoints(tour.p2.pts) * (s2 === 'refus' ? -1 : 1);
    roomRef.child('scores/p1').transaction(v => (v || 0) + g1);
    roomRef.child('scores/p2').transaction(v => (v || 0) + g2);

    if(dernier) soireeTerminer(d);
    notifyPartner(dernier ? '🌙 Soirée terminée' : '🌙 Cartes suivantes',
      dernier ? 'Vous avez fini la soirée !' : 'Vos cartes ' + (idx + 2) + ' sont là.',
      'soiree');
  }, () => { soireeBusy = false; });
}

// Total d'un joueur sur la soirée : ce qu'il a gagné, moins ce qu'il a refusé.
function soireeTotal(d, joueur){
  return (d.cards || []).reduce((somme, tour, i) => {
    const statut = sStatut(d, i, joueur);
    if(!statut || !tour[joueur]) return somme;
    return somme + soireePoints(tour[joueur].pts) * (statut === 'refus' ? -1 : 1);
  }, 0);
}

function soireeTerminer(d){
  const cartes = d.cards || [];
  const updates = {};
  updates['soiree/fini'] = true;
  updates['soiree/totaux'] = { p1: soireeTotal(d, 'p1'), p2: soireeTotal(d, 'p2') };
  ['p1', 'p2'].forEach(j => {
    const histKey = db.ref('rooms/' + roomCode + '/history').push().key;
    updates['history/' + histKey] = {
      who: (state.players && state.players[j]) || j, cat: 'soiree',
      text: "Soirée guidée — " + cartes.length + " cartes enchaînées, jusqu'au niveau HOT",
      answer: '', comment: '', pts: soireeTotal(d, j), validated: true, ts: Date.now()
    };
  });
  roomRef.update(updates);
}

// ====== RENDU ======
function renderSoiree(){
  const panel = $('#soiree-panel');
  if(!panel) return;
  if(!soireeActive){ panel.style.display = 'none'; return; }
  panel.style.display = 'block';

  const body = $('#soiree-body');
  const d = sGet();

  if(!d){ body.innerHTML = soireeVueDepart(); soireeBrancher(body); return; }

  // Soirée lancée avant que chacun ait sa propre carte : elle n'a plus de sens
  // ici, on repart de l'écran de départ.
  const premierTour = (d.cards || [])[0];
  if(!premierTour || !premierTour.p1 || !premierTour.p2){
    body.innerHTML = soireeVueDepart(true);
    soireeBrancher(body);
    return;
  }

  soireeAvancer(d);

  // Entre la dernière carte validée et l'écriture du « fini », l'index dépasse
  // le paquet : on montre déjà l'écran de fin plutôt qu'une carte vide.
  const cartes = d.cards || [];
  if(d.fini || (d.index || 0) >= cartes.length){ body.innerHTML = soireeVueFin(d); soireeBrancher(body); return; }

  // Passage de palier : l'annonce s'intercale avant la première carte du
  // palier. Elle est locale à chaque téléphone, chacun la ferme à son rythme.
  const carte = d.cards[d.index || 0];
  const etape = sEtape(carte.etape);
  const premiere = (d.index || 0) === d.cards.findIndex(c => c.etape === carte.etape);
  if(etape.annonce && premiere && !soireeAnnonceVue[etape.id]){
    body.innerHTML = soireeVueAnnonce(etape, d);
    soireeBrancher(body);
    return;
  }

  body.innerHTML = soireeVueParcours(d);
  soireeBrancher(body);
}

function soireeVueDepart(perimee){
  const etapes = SOIREE_ETAPES.map(e => `
    <li class="soiree-etape-item">
      <span class="soiree-etape-ic">${e.emoji}</span>
      <span><strong>${e.paliers.length} tours ${e.label}</strong><br><span class="soiree-etape-desc">${escapeHtml(e.desc)}</span></span>
    </li>`).join('');
  return `
    ${perimee ? `<p class="soiree-perimee">La soirée en cours date d'une version précédente, où vous partagiez la même carte. Relance-la pour que chacun ait la sienne.</p>` : ''}
    <h3 class="soiree-title">Une soirée à deux, en ${soireeTotalCartes()} tours</h3>
    <p class="soiree-intro">À chaque tour, <strong>chacun reçoit sa propre carte</strong> — jamais la même. Le tour suivant n'apparaît que quand vous avez répondu tous les deux. Ça commence doux et ça monte, palier par palier. Une carte qu'on refuse coûte ses points au lieu de les rapporter.</p>
    <ul class="soiree-etapes">${etapes}</ul>
    <button class="btn-primary" id="soiree-go">🌙 Lancer la soirée</button>`;
}

function soireeVueAnnonce(etape, d){
  const restantes = d.cards.filter(c => c.etape === etape.id).length;
  return `
    <div class="soiree-annonce soiree-annonce-${etape.id}">
      <div class="soiree-annonce-ic">${etape.emoji}</div>
      <div class="soiree-annonce-titre">${escapeHtml(etape.annonce.titre)}</div>
      <div class="soiree-annonce-txt">${escapeHtml(etape.annonce.texte)}</div>
      <div class="soiree-annonce-sous">${restantes} cartes à ce niveau — ${escapeHtml(etape.desc.toLowerCase())}</div>
    </div>
    <button class="btn-primary" id="soiree-annonce-ok">On continue</button>`;
}

function soireeVueParcours(d){
  const idx = d.index || 0;
  const tours = d.cards || [];
  const tour = tours[idx];
  const carte = sMaCarte(tour);
  const sienne = sSaCarte(tour);
  const etape = sEtape(tour.etape);
  const icone = { question:'💬', defi:'🔥', gage:'😈' }[carte.cat] || '✦';
  const label = { question:'Question', defi:'Défi', gage:'Cap ou pas' }[carte.cat] || 'Carte';

  const points = tours.map((t, i) => {
    const cls = i < idx ? 'faite' : (i === idx ? 'courante' : '');
    return `<span class="soiree-point soiree-point-${t.etape} ${cls}"></span>`;
  }).join('');

  const moi = sStatut(d, idx, me.id);
  const lui = sStatut(d, idx, partnerId);
  const partenaire = (state.players && state.players[partnerId]) || 'ton/ta partenaire';
  const marque = st => st === 'refus' ? '❌' : (st === 'fait' ? '✅' : '⏳');

  const actions = moi
    ? `<button class="btn-primary" disabled>${marque(moi)} ${moi === 'refus' ? 'Refusée' : 'Fait'} — en attente de ${escapeHtml(partenaire)}…</button>`
    : `<button class="btn-primary" id="soiree-fait">✅ C'est fait !</button>
       <button class="btn-ghost soiree-refus" id="soiree-refuse">❌ Je refuse (−${soireePoints(carte.pts)} points)</button>`;

  return `
    <div class="soiree-entete">
      <span class="soiree-niveau-tag soiree-tag-${etape.id}">${etape.emoji} ${etape.label}</span>
      <span class="soiree-compteur">Tour ${idx + 1} / ${tours.length}</span>
    </div>
    <div class="soiree-jauge">${points}</div>

    <div class="soiree-carte">
      <div class="soiree-carte-cat">${icone} ${label} · pour toi</div>
      <p class="soiree-carte-text">${escapeHtml(carte.text)}</p>
      <div class="soiree-carte-pts">+${soireePoints(carte.pts)} points</div>
    </div>

    <div class="soiree-sienne">
      <span class="soiree-sienne-titre">La carte de ${escapeHtml(partenaire)} ${marque(lui)}</span>
      ${escapeHtml(sienne.text)} <span class="soiree-sienne-pts">+${soireePoints(sienne.pts)}</span>
    </div>

    <div class="soiree-qui">
      <span class="soiree-qui-badge ${moi ? 'ok' : ''} ${moi === 'refus' ? 'refus' : ''}">${marque(moi)} ${escapeHtml(me.name)}</span>
      <span class="soiree-qui-badge ${lui ? 'ok' : ''} ${lui === 'refus' ? 'refus' : ''}">${marque(lui)} ${escapeHtml(partenaire)}</span>
    </div>

    ${actions}
    <button class="btn-ghost soiree-stop" id="soiree-stop">Arrêter la soirée</button>`;
}

function soireeVueFin(d){
  const tours = d.cards || [];
  const partenaire = (state.players && state.players[partnerId]) || 'ton/ta partenaire';
  const totaux = d.totaux || { p1: soireeTotal(d, 'p1'), p2: soireeTotal(d, 'p2') };
  const signe = n => (n < 0 ? '' : '+') + n;

  const recap = tours.map((t, i) => {
    const carte = t[me.id];
    if(!carte) return '';
    const statut = sStatut(d, i, me.id);
    const pts = soireePoints(carte.pts) * (statut === 'refus' ? -1 : 1);
    return `
    <li class="${statut === 'refus' ? 'soiree-recap-refus' : ''}">
      <span class="soiree-recap-n soiree-point-${t.etape}">${i + 1}</span>
      ${escapeHtml(carte.text)}
      <span class="soiree-recap-pts">${signe(pts)}</span>
    </li>`;
  }).join('');

  return `
    <div class="soiree-fin">
      <div class="soiree-fin-ic">🌙</div>
      <h3 class="soiree-title">Soirée terminée</h3>
      <div class="soiree-fin-scores">
        <span><strong>${escapeHtml(me.name)}</strong><br>${signe(totaux[me.id] || 0)} points</span>
        <span><strong>${escapeHtml(partenaire)}</strong><br>${signe(totaux[partnerId] || 0)} points</span>
      </div>
    </div>
    <p class="soiree-recap-titre">Tes cartes de la soirée</p>
    <ul class="soiree-recap">${recap}</ul>
    <button class="btn-primary" id="soiree-encore">Relancer une soirée</button>
    <button class="btn-ghost soiree-stop" id="soiree-stop">Retour à la pioche</button>`;
}

function soireeBrancher(body){
  const go = body.querySelector('#soiree-go');
  if(go) go.addEventListener('click', () => soireeStart());
  const ok = body.querySelector('#soiree-annonce-ok');
  if(ok) ok.addEventListener('click', () => {
    const d = sGet();
    if(d) soireeAnnonceVue[sEtape(d.cards[d.index || 0].etape).id] = true;
    render();
  });
  const fait = body.querySelector('#soiree-fait');
  if(fait) fait.addEventListener('click', soireeFait);
  const refus = body.querySelector('#soiree-refuse');
  if(refus) refus.addEventListener('click', soireeRefuse);
  const stop = body.querySelector('#soiree-stop');
  if(stop) stop.addEventListener('click', () => {
    const d = sGet();
    if(d && d.fini){ sRef().remove(); closeSoiree(); return; }
    soireeStop();
  });
  const encore = body.querySelector('#soiree-encore');
  if(encore) encore.addEventListener('click', () => { soireeAnnonceVue = {}; soireeStart(); });
}
