/**
 * Nous Deux — « version + intime » d'une carte Question / Défi
 * ===========================================================
 * Sur une carte que je viens de piocher (et pas encore jouée), une case
 * propose de la remplacer par une carte 18+ (adulte:true) de la même
 * catégorie, qui rapporte le DOUBLE des points.
 *
 * Tant que le Mode HOT n'est pas débloqué, c'est 1 fois par jour et par
 * joueur ; une 2ᵉ tentative le même jour ouvre un message de blocage.
 * Mode HOT débloqué : sans limite.
 *
 * Base : rooms/$room/intime/<pid>/<AAAA-MM-JJ> = horodatage du changement.
 */

const IT_CATS = ['question', 'defi'];

function itJour(){
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

function itDejaUtiliseAujourdhui(){
  const it = state && state.intime && state.intime[me.id];
  return !!(it && it[itJour()]);
}

// La carte est-elle déjà 18+ ? (les cartes piochées avant cette fonction
// n'ont pas le marqueur : on retrouve la carte d'origine par son texte)
function itEstAdulte(p){
  if(p.adulte || p.intime) return true;
  const c = DEFAULT_CARDS.find(c => c.text === p.text);
  return !!(c && c.adulte);
}

function itProposable(p){
  return p && p.by === me.id && p.status === 'drafting' && !p.pdGage
    && IT_CATS.indexOf(p.cat) >= 0 && !itEstAdulte(p);
}

function itCandidates(p){
  const disabled = (state && state.disabledDefaults) || {};
  return DEFAULT_CARDS.filter(c => c.cat === p.cat && c.adulte && !disabled[c.id] && c.text !== p.text);
}

// La case, insérée sous le texte de la carte.
function itHTML(key, p){
  if(!itProposable(p) || !itCandidates(p).length) return '';
  return '<div class="it-case">'
    + '<span class="it-ic">🔥</span>'
    + '<p>Changer pour une version <b>+ intime</b> pour <b>doubler les points</b> à gagner ?</p>'
    + '<button type="button" class="it-oui" data-it-cle="' + key + '">Oui, ' + (p.pts * 2) + ' pts</button>'
    + '</div>';
}

function itBasculer(key){
  const p = state && state.pendingCards && state.pendingCards[key];
  if(!itProposable(p)) return;
  if(!mcDebloque() && itDejaUtiliseAujourdhui()){
    mcPleinOuvert = 'intime';
    renderMcPlein();
    return;
  }
  const pool = itCandidates(p);
  if(!pool.length) return;
  const c = pool[Math.floor(Math.random() * pool.length)];
  const updates = {};
  updates['pendingCards/' + key + '/text'] = c.text;
  updates['pendingCards/' + key + '/pts'] = c.pts * 2;
  updates['pendingCards/' + key + '/photo'] = c.photo ? true : null;
  updates['pendingCards/' + key + '/adulte'] = true;
  updates['pendingCards/' + key + '/intime'] = true;
  updates['intime/' + me.id + '/' + itJour()] = Date.now();
  // Ménage : on ne garde que le jour en cours.
  const miens = (state.intime && state.intime[me.id]) || {};
  Object.keys(miens).forEach(j => { if(j !== itJour()) updates['intime/' + me.id + '/' + j] = null; });
  roomRef.update(updates);
}

document.addEventListener('click', e => {
  const b = e.target.closest && e.target.closest('[data-it-cle]');
  if(!b) return;
  e.stopPropagation();
  itBasculer(b.dataset.itCle);
}, true);
