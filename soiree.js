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
      const c = choix[Math.floor(Math.random() * choix.length)];
      pris.add(c.id);
      plancher = c.pts;
      cartes.push({ id:c.id, cat:c.cat, text:c.text, pts:c.pts, etape:etape.id });
    });
  });
  return cartes;
}

function soireeStart(){
  // Relance juste après une soirée : on ne rejoue pas les cartes qui viennent
  // tout juste de sortir.
  const precedente = sGet();
  const exclus = (precedente && precedente.cards) ? precedente.cards.map(c => c.id) : [];
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

// Validation de la carte courante. Celui qui valide en SECOND est le seul à
// écrire la transition : les points ne peuvent donc pas être crédités deux fois.
function soireeFait(){
  const d = sGet();
  if(!d || d.fini || soireeBusy) return;
  const idx = d.index || 0;
  const carte = (d.cards || [])[idx];
  if(!carte) return;
  const done = (d.done && d.done[idx]) || {};
  if(done[me.id]) return;

  if(!done[partnerId]){
    sRef().child('done/' + idx + '/' + me.id).set(true);
    notifyPartner('🌙 Soirée guidée',
      me.name + ' a fait la carte ' + (idx + 1) + '/' + d.cards.length + ' — à toi !', 'soiree');
    return;
  }

  soireeBusy = true;
  const dernier = idx + 1 >= d.cards.length;
  const updates = {};
  updates['soiree/done/' + idx + '/' + me.id] = true;
  const gain = soireePoints(carte.pts);
  updates['scores/p1'] = ((state.scores && state.scores.p1) || 0) + gain;
  updates['scores/p2'] = ((state.scores && state.scores.p2) || 0) + gain;

  if(dernier){
    const total = d.cards.reduce((s, c) => s + soireePoints(c.pts), 0);
    updates['soiree/fini'] = true;
    updates['soiree/total'] = total;
    const histKey = db.ref('rooms/' + roomCode + '/history').push().key;
    updates['history/' + histKey] = {
      who: 'Vous deux', cat: 'soiree',
      text: 'Soirée guidée — ' + d.cards.length + ' cartes enchaînées, jusqu\'au niveau HOT',
      answer: '', comment: '', pts: total, validated: true, ts: Date.now()
    };
  } else {
    updates['soiree/index'] = idx + 1;
  }

  roomRef.update(updates).then(() => { soireeBusy = false; }, () => { soireeBusy = false; });

  notifyPartner(dernier ? '🌙 Soirée terminée' : '🌙 Carte suivante',
    dernier ? 'Vous avez fini la soirée : +' + d.cards.reduce((s,c)=>s+soireePoints(c.pts),0) + ' points chacun !'
            : me.name + ' a validé — la carte ' + (idx + 2) + ' est là.',
    'soiree');
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
  if(d.fini){ body.innerHTML = soireeVueFin(d); soireeBrancher(body); return; }

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

function soireeVueDepart(){
  const etapes = SOIREE_ETAPES.map(e => `
    <li class="soiree-etape-item">
      <span class="soiree-etape-ic">${e.emoji}</span>
      <span><strong>${e.paliers.length} cartes ${e.label}</strong><br><span class="soiree-etape-desc">${escapeHtml(e.desc)}</span></span>
    </li>`).join('');
  return `
    <h3 class="soiree-title">Une soirée à deux, en ${soireeTotalCartes()} cartes</h3>
    <p class="soiree-intro">Chaque carte est pour vous deux, et la suivante n'apparaît que quand vous l'avez faite tous les deux. Ça commence doux et ça monte, palier par palier.</p>
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
  const cartes = d.cards || [];
  const carte = cartes[idx];
  const done = (d.done && d.done[idx]) || {};
  const etape = sEtape(carte.etape);
  const icone = { question:'💬', defi:'🔥', gage:'😈' }[carte.cat] || '✦';
  const label = { question:'Question', defi:'Défi', gage:'Cap ou pas' }[carte.cat] || 'Carte';

  const points = cartes.map((c, i) => {
    const cls = i < idx ? 'faite' : (i === idx ? 'courante' : '');
    return `<span class="soiree-point soiree-point-${c.etape} ${cls}"></span>`;
  }).join('');

  const moiFait = !!done[me.id];
  const luiFait = !!done[partnerId];
  const partenaire = (state.players && state.players[partnerId]) || 'ton/ta partenaire';

  const bouton = moiFait
    ? `<button class="btn-primary" disabled>✅ Fait — en attente de ${escapeHtml(partenaire)}…</button>`
    : `<button class="btn-primary" id="soiree-fait">${luiFait ? '✅ À moi aussi, c\'est fait !' : "✅ C'est fait !"}</button>`;

  return `
    <div class="soiree-entete">
      <span class="soiree-niveau-tag soiree-tag-${etape.id}">${etape.emoji} ${etape.label}</span>
      <span class="soiree-compteur">Carte ${idx + 1} / ${cartes.length}</span>
    </div>
    <div class="soiree-jauge">${points}</div>

    <div class="soiree-carte">
      <div class="soiree-carte-cat">${icone} ${label}</div>
      <p class="soiree-carte-text">${escapeHtml(carte.text)}</p>
      <div class="soiree-carte-pts">+${soireePoints(carte.pts)} points chacun</div>
    </div>

    <div class="soiree-qui">
      <span class="soiree-qui-badge ${moiFait ? 'ok' : ''}">${moiFait ? '✅' : '⏳'} ${escapeHtml(me.name)}</span>
      <span class="soiree-qui-badge ${luiFait ? 'ok' : ''}">${luiFait ? '✅' : '⏳'} ${escapeHtml(partenaire)}</span>
    </div>

    ${bouton}
    <button class="btn-ghost soiree-stop" id="soiree-stop">Arrêter la soirée</button>`;
}

function soireeVueFin(d){
  const cartes = d.cards || [];
  const recap = cartes.map((c, i) => `
    <li><span class="soiree-recap-n soiree-point-${c.etape}">${i + 1}</span> ${escapeHtml(c.text)} <span class="soiree-recap-pts">+${soireePoints(c.pts)}</span></li>`).join('');
  return `
    <div class="soiree-fin">
      <div class="soiree-fin-ic">🌙</div>
      <h3 class="soiree-title">Soirée terminée</h3>
      <p class="soiree-fin-pts">+${d.total || 0} points pour chacun</p>
    </div>
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
  const stop = body.querySelector('#soiree-stop');
  if(stop) stop.addEventListener('click', () => {
    const d = sGet();
    if(d && d.fini){ sRef().remove(); closeSoiree(); return; }
    soireeStop();
  });
  const encore = body.querySelector('#soiree-encore');
  if(encore) encore.addEventListener('click', () => { soireeAnnonceVue = {}; soireeStart(); });
}
