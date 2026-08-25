// =========================================================
//  SOIRÉE GUIDÉE
//  Un parcours de 5 cartes qui monte en intensité, au lieu du tirage
//  au hasard. On choisit le niveau au départ (Tendre / Chaud / Sans
//  limite), et chaque carte s'applique aux DEUX : la suivante ne se
//  découvre que lorsque tous les deux ont validé la précédente.
//  Les points de chaque carte sont gagnés par les deux joueurs.
// =========================================================
const SOIREE_TAILLE = 5;

// paliers : les points visés pour chacune des 5 cartes, de l'échauffement
// au bouquet final. C'est ce qui donne sa forme à la soirée.
const SOIREE_NIVEAUX = [
  { id:'tendre', emoji:'🌸', label:'Tendre',      max:25,   paliers:[10, 15, 20, 25, 25], desc:"Complicité, tendresse, rien qui brûle." },
  { id:'chaud',  emoji:'🔥', label:'Chaud',       max:50,   paliers:[10, 20, 25, 30, 40], desc:"Ça monte franchement, sans aller au bout." },
  { id:'libre',  emoji:'💥', label:'Sans limite', max:9999, paliers:[10, 25, 30, 40, 50], desc:"Tout est permis, jusqu'aux cartes les plus fortes." },
];

let soireeActive = false;
let soireeBusy = false;   // garde-fou : la transition ne doit être jouée qu'une fois

function openSoiree(){ soireeActive = true; render(); }
function closeSoiree(){ soireeActive = false; render(); }

function sRef(){ return roomRef.child('soiree'); }
function sGet(){ return (state && state.soiree) || null; }
function sNiveau(id){ return SOIREE_NIVEAUX.find(n => n.id === id) || SOIREE_NIVEAUX[0]; }

// Toutes les cartes jouables, catégories mélangées : une soirée qui enchaîne
// une question, un défi puis un gage vaut mieux qu'un bloc monocorde.
function soireePool(niveau){
  const cartes = getActiveDefaultCards().slice();
  if(state && state.customCards){
    Object.entries(state.customCards).forEach(([key, c]) => cartes.push({ ...c, id:key, cat:normCat(c.cat) }));
  }
  const vus = new Set();
  return cartes.filter(c => {
    if(!c.text || c.pts > niveau.max) return false;
    if(vus.has(c.text)) return false;   // les doublons volontaires ne sortent qu'une fois par soirée
    vus.add(c.text);
    return true;
  });
}

// La montée en intensité est garantie par construction : chaque palier du
// niveau cherche une carte valant ces points-là (ou la plus proche encore
// disponible), sans jamais redescendre sous la carte précédente. Découper le
// vivier en cinq quantiles ne suffisait pas : les cartes à 10-30 points sont
// si nombreuses qu'une soirée « Sans limite » pouvait finir sur du 25.
function soireeTirer(niveau){
  const pool = soireePool(niveau);
  if(pool.length === 0) return [];
  const cartes = [];
  const pris = new Set();
  let plancher = 0;

  niveau.paliers.forEach((cible, i) => {
    let dispo = pool.filter(c => !pris.has(c.id) && c.pts >= plancher);
    if(dispo.length === 0) dispo = pool.filter(c => !pris.has(c.id));
    if(dispo.length === 0) return;

    // Les cartes fortes sont rares (11 seulement valent 40 points ou plus) :
    // viser la valeur exacte ramènerait les deux mêmes en bouquet final à
    // chaque soirée. Le dernier palier pioche donc dans tout le haut du panier
    // — mais lui seul, sinon la soirée atteint son plafond dès la 3e carte.
    const dernier = i === niveau.paliers.length - 1;
    let choix = dernier ? dispo.filter(c => c.pts >= cible) : [];
    if(choix.length === 0){
      const ecartMin = Math.min(...dispo.map(c => Math.abs(c.pts - cible)));
      choix = dispo.filter(c => Math.abs(c.pts - cible) === ecartMin);
    }
    const c = choix[Math.floor(Math.random() * choix.length)];
    pris.add(c.id);
    plancher = c.pts;
    cartes.push({ id:c.id, cat:c.cat, text:c.text, pts:c.pts });
  });
  return cartes;
}

function soireeStart(niveauId){
  const niveau = sNiveau(niveauId);
  const cartes = soireeTirer(niveau);
  if(cartes.length === 0){ alert("Aucune carte disponible pour ce niveau."); return; }
  sRef().set({ niveau:niveau.id, cards:cartes, index:0, done:{}, by:me.id, ts:Date.now() });
  notifyPartner('🌙 Soirée guidée',
    me.name + ' a lancé une soirée « ' + niveau.label + ' » : ' + cartes.length + ' cartes pour vous deux.',
    'soiree');
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
  updates['scores/p1'] = ((state.scores && state.scores.p1) || 0) + carte.pts;
  updates['scores/p2'] = ((state.scores && state.scores.p2) || 0) + carte.pts;

  if(dernier){
    const total = d.cards.reduce((s, c) => s + c.pts, 0);
    updates['soiree/fini'] = true;
    updates['soiree/total'] = total;
    const histKey = db.ref('rooms/' + roomCode + '/history').push().key;
    updates['history/' + histKey] = {
      who: 'Vous deux', cat: 'soiree',
      text: 'Soirée guidée « ' + sNiveau(d.niveau).label + ' » — ' + d.cards.length + ' cartes enchaînées',
      answer: '', comment: '', pts: total, validated: true, ts: Date.now()
    };
  } else {
    updates['soiree/index'] = idx + 1;
  }

  roomRef.update(updates).then(() => { soireeBusy = false; }, () => { soireeBusy = false; });

  notifyPartner(dernier ? '🌙 Soirée terminée' : '🌙 Carte suivante',
    dernier ? 'Vous avez fini la soirée : +' + d.cards.reduce((s,c)=>s+c.pts,0) + ' points chacun !'
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

  if(!d){ body.innerHTML = soireeVueNiveaux(); soireeBrancher(body); return; }
  if(d.fini){ body.innerHTML = soireeVueFin(d); soireeBrancher(body); return; }
  body.innerHTML = soireeVueParcours(d);
  soireeBrancher(body);
}

function soireeVueNiveaux(){
  const choix = SOIREE_NIVEAUX.map(n => {
    const dispo = soireePool(n).length;
    return `
      <button class="soiree-niveau" data-niveau="${n.id}" ${dispo ? '' : 'disabled'}>
        <span class="soiree-niveau-ic">${n.emoji}</span>
        <span class="soiree-niveau-txt">
          <strong>${n.label}</strong>
          <span>${escapeHtml(n.desc)}</span>
          <span class="soiree-niveau-dispo">${dispo} cartes possibles</span>
        </span>
      </button>`;
  }).join('');
  return `
    <h3 class="soiree-title">Une soirée à deux, en ${SOIREE_TAILLE} cartes</h3>
    <p class="soiree-intro">Chaque carte est pour vous deux, et la suivante n'apparaît que quand vous l'avez faite tous les deux. Ça commence doux et ça monte jusqu'à la dernière.</p>
    <div class="soiree-niveaux">${choix}</div>`;
}

function soireeVueParcours(d){
  const idx = d.index || 0;
  const cartes = d.cards || [];
  const carte = cartes[idx];
  const done = (d.done && d.done[idx]) || {};
  const niveau = sNiveau(d.niveau);
  const icone = { question:'💬', defi:'🔥', gage:'😈' }[carte.cat] || '✦';
  const label = { question:'Question', defi:'Défi', gage:'Cap ou pas' }[carte.cat] || 'Carte';

  const points = cartes.map((c, i) => {
    const cls = i < idx ? 'faite' : (i === idx ? 'courante' : '');
    return `<span class="soiree-point ${cls}"></span>`;
  }).join('');

  const moiFait = !!done[me.id];
  const luiFait = !!done[partnerId];
  const partenaire = (state.players && state.players[partnerId]) || 'ton/ta partenaire';

  const bouton = moiFait
    ? `<button class="btn-primary" disabled>✅ Fait — en attente de ${escapeHtml(partenaire)}…</button>`
    : `<button class="btn-primary" id="soiree-fait">${luiFait ? '✅ À moi aussi, c\'est fait !' : "✅ C'est fait !"}</button>`;

  return `
    <div class="soiree-entete">
      <span class="soiree-niveau-tag">${niveau.emoji} ${niveau.label}</span>
      <span class="soiree-compteur">Carte ${idx + 1} / ${cartes.length}</span>
    </div>
    <div class="soiree-jauge">${points}</div>

    <div class="soiree-carte">
      <div class="soiree-carte-cat">${icone} ${label}</div>
      <p class="soiree-carte-text">${escapeHtml(carte.text)}</p>
      <div class="soiree-carte-pts">+${carte.pts} points chacun</div>
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
    <li><span class="soiree-recap-n">${i + 1}</span> ${escapeHtml(c.text)} <span class="soiree-recap-pts">+${c.pts}</span></li>`).join('');
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
  body.querySelectorAll('.soiree-niveau').forEach(b => {
    b.addEventListener('click', () => soireeStart(b.dataset.niveau));
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
  if(encore) encore.addEventListener('click', () => sRef().remove());
}
