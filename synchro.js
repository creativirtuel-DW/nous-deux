/**
 * Nous Deux — « On est synchro ! »
 * ================================
 * Une question, 4 réponses. L'un répond, la carte part en attente chez
 * l'autre, qui répond à son tour sans voir la réponse du premier.
 * Même réponse : +SYNCHRO_GAIN points CHACUN. Réponses différentes :
 * −SYNCHRO_PERTE points chacun (un score ne descend jamais sous 0).
 *
 * Base : rooms/$room/synchro/<clé> = { by, qid, q, a, cat, rep:{pid:n},
 *        status:'attente'|'termine', ts, ok, gain, finTs }
 *        rooms/$room/synchroVues/<qid> = true (anti-répétition, comme la Battle)
 *
 * Comparaison des réponses : battleReponsesConcordent (battle.js), qui
 * résout « Moi » / « Toi » en personnes.
 */

const SYNCHRO_GAIN = 10;
const SYNCHRO_PERTE = 5;
const SYNCHRO_MAX_ATTENTE = 3;        // cartes que je peux avoir en attente chez l'autre
const SYNCHRO_RESULTATS_GARDES = 10;  // résultats conservés dans la base
const SYNCHRO_PAR_JOUR = 5;           // questions que chacun peut LANCER par jour (répondre reste illimité)
const SYNCHRO_THEMES = { couple: '💑 Couple', quotidien: '🏠 Quotidien enfants', intime: '🔥 Intime', projets: '🌍 Projets' };
// Mode HOT verrouillé : une question intime sort environ 1 fois sur 5.
const SYNCHRO_PART_INTIME_SAGE = 0.2;
// Pastille « Nouveau ! » sur la tuile jusqu'à cette date (incluse).
const SYNCHRO_NOUVEAU_JUSQUA = new Date(2026, 10, 23, 23, 59, 59);

let synchroActive = false;
let synchroBrouillon = null;   // { question, choix } : ma question avant envoi
let synchroChoix = {};         // clé -> réponse choisie (cartes reçues, avant validation)
let synchroSignature = '';

function openSynchro(){ synchroActive = true; synchroBrouillon = null; synchroSignature = ''; render(); window.scrollTo(0, 0); }
function closeSynchro(){ synchroActive = false; synchroBrouillon = null; synchroSignature = ''; render(); }

function synchroListe(){
  return Object.entries((state && state.synchro) || {}).filter(([k, s]) => s && s.q && Array.isArray(s.a));
}
function synchroAMoi(){ return synchroListe().filter(([k, s]) => s.status === 'attente' && s.by !== me.id); }
function synchroChezLautre(){ return synchroListe().filter(([k, s]) => s.status === 'attente' && s.by === me.id); }
function synchroResultats(){
  return synchroListe().filter(([k, s]) => s.status === 'termine').sort((x, y) => (y[1].finTs || 0) - (x[1].finTs || 0));
}

// Tirage : questions pas encore sorties ; quand tout est sorti, nouveau cycle.
// Les questions déjà en attente (chez l'un ou l'autre) sont écartées.
function synchroTirer(exclure){
  const vues = (state && state.synchroVues) || {};
  const enCours = {};
  synchroListe().forEach(([k, s]) => { if(s.status === 'attente') enCours[s.qid] = true; });
  if(exclure) enCours[exclure] = true;
  let pool = SYNCHRO_QUESTIONS.filter(q => !enCours[q.id]);
  if(!mcDebloque()){
    const intime = Math.random() < SYNCHRO_PART_INTIME_SAGE;
    const filtre = pool.filter(q => (q.cat === 'intime') === intime);
    if(filtre.length) pool = filtre;
  }
  let dispo = pool.filter(q => !vues[q.id]);
  if(!dispo.length) dispo = pool;   // cycle épuisé pour ce tirage
  if(!dispo.length) return null;
  const q = dispo[Math.floor(Math.random() * dispo.length)];
  return { id: q.id, q: q.q, a: q.a.slice(), cat: q.cat };
}

// Questions lancées aujourd'hui (rooms/$room/synchroJour/<pid>/<AAAA-MM-JJ>).
function synchroLanceesAujourdhui(){
  const j = state && state.synchroJour && state.synchroJour[me.id];
  return (j && j[itJour()]) || 0;
}

function synchroNouvelle(){
  if(synchroChezLautre().length >= SYNCHRO_MAX_ATTENTE) return;
  if(synchroLanceesAujourdhui() >= SYNCHRO_PAR_JOUR){ synchroPopupLimite(); return; }
  const q = synchroTirer();
  if(!q){ alert("Plus de question disponible pour l'instant."); return; }
  synchroBrouillon = { question: q, choix: null };
  synchroSignature = '';
  renderSynchro();
}

function synchroAutreQuestion(){
  if(!synchroBrouillon) return;
  const q = synchroTirer(synchroBrouillon.question.id);
  if(q){ synchroBrouillon = { question: q, choix: null }; synchroSignature = ''; renderSynchro(); }
}

function synchroEnvoyer(){
  const b = synchroBrouillon;
  if(!b || b.choix === null) return;
  const q = b.question;
  const cle = roomRef.child('synchro').push().key;
  const updates = {};
  updates['synchro/' + cle] = {
    by: me.id, qid: q.id, q: q.q, a: q.a, cat: q.cat,
    rep: { [me.id]: b.choix }, status: 'attente', ts: Date.now()
  };
  // Anti-répétition : si toutes les questions sont sorties, on repart à zéro.
  const vues = Object.assign({}, (state && state.synchroVues) || {});
  if(SYNCHRO_QUESTIONS.every(x => vues[x.id] || x.id === q.id)){
    Object.keys(vues).forEach(id => { updates['synchroVues/' + id] = null; });
  }
  updates['synchroVues/' + q.id] = true;
  // Compteur du jour (et ménage des jours passés).
  updates['synchroJour/' + me.id + '/' + itJour()] = synchroLanceesAujourdhui() + 1;
  Object.keys((state.synchroJour && state.synchroJour[me.id]) || {}).forEach(j => {
    if(j !== itJour()) updates['synchroJour/' + me.id + '/' + j] = null;
  });
  synchroBrouillon = null;
  synchroSignature = '';
  const derniere = synchroLanceesAujourdhui() + 1 >= SYNCHRO_PAR_JOUR;
  roomRef.update(updates).then(() => {
    if(derniere) synchroPopupLimite();
    notifyPartner('💞 On est synchro ?', me.name + ' t’a envoyé une question : réponds la même chose pour gagner des points !', 'synchro');
  });
}

function synchroRepondre(cle){
  const s = state.synchro && state.synchro[cle];
  const choix = synchroChoix[cle];
  if(!s || s.status !== 'attente' || s.by === me.id || choix === undefined || choix === null) return;
  const sienne = s.rep && s.rep[s.by];
  const ok = battleReponsesConcordent(s, 0, choix, {}, sienne, {}, me.id, s.by);
  const delta = ok ? SYNCHRO_GAIN : -SYNCHRO_PERTE;

  const updates = {};
  updates['synchro/' + cle + '/rep/' + me.id] = choix;
  updates['synchro/' + cle + '/status'] = 'termine';
  updates['synchro/' + cle + '/ok'] = ok;
  updates['synchro/' + cle + '/gain'] = delta;
  updates['synchro/' + cle + '/finTs'] = Date.now();
  // Statistiques par question (dev mod) : pour savoir quel thème enrichir.
  const st = (state.synchroStats && state.synchroStats[s.qid]) || {};
  if(s.qid) updates['synchroStats/' + s.qid] = { n: (st.n || 0) + 1, ok: (st.ok || 0) + (ok ? 1 : 0), cat: s.cat || st.cat || '' };
  ['p1', 'p2'].forEach(pid => {
    const avant = (state.scores && state.scores[pid]) || 0;
    updates['scores/' + pid] = Math.max(0, avant + delta);
  });
  const hk = db.ref('rooms/' + roomCode + '/history').push().key;
  updates['history/' + hk] = {
    who: me.name, cat: 'synchro',
    text: (ok ? 'Synchro ! ' : 'Pas synchro : ') + s.q,
    pts: delta, validated: true, ts: Date.now()
  };
  // Ménage : on ne garde que les derniers résultats.
  synchroResultats().slice(SYNCHRO_RESULTATS_GARDES - 1).forEach(([k]) => { updates['synchro/' + k] = null; });

  delete synchroChoix[cle];
  synchroSignature = '';
  roomRef.update(updates).then(() => {
    notifyPartner(ok ? '💞 Vous êtes synchro !' : '💔 Pas synchro…',
      ok ? me.name + ' a répondu pareil : +' + SYNCHRO_GAIN + ' pts chacun !'
         : me.name + ' n’a pas répondu pareil : −' + SYNCHRO_PERTE + ' pts chacun.', 'synchro');
  });
}

function synchroAnnuler(cle){
  const s = state.synchro && state.synchro[cle];
  if(!s || s.by !== me.id || s.status !== 'attente') return;
  if(confirm('Retirer cette question ?')) roomRef.child('synchro/' + cle).remove();
}

// ---------- RENDU ----------
function synchroLibelle(s, pid){
  const n = s.rep && s.rep[pid];
  if(n === undefined || n === null || !s.a[n]) return '—';
  // « Moi » / « Toi » : on précise de qui il s'agit.
  const d = battleDesigne(s.a[n]);
  if(!d) return s.a[n];
  const autre = pid === 'p1' ? 'p2' : 'p1';
  const vise = (state.players && state.players[d === 'moi' ? pid : autre]) || '';
  return vise ? s.a[n] + ' (' + vise + ')' : s.a[n];
}

function synchroChoixHTML(a, choisi, attr){
  return '<div class="bt-choix">' + a.map((rep, j) =>
    '<button type="button" class="bt-choix-btn' + (choisi === j ? ' choisi' : '') + '" ' + attr + ' data-sy-r="' + j + '">' + escapeHtml(rep) + '</button>'
  ).join('') + '</div>';
}

function renderSynchro(){
  const panel = $('#synchro-panel');
  if(!panel) return;
  synchroMajTuile();
  if(!synchroActive){ panel.style.display = 'none'; synchroSignature = ''; return; }
  panel.style.display = 'flex';

  const partnerName = (state.players && state.players[partnerId]) || 'ton/ta partenaire';
  const aMoi = synchroAMoi(), chezLautre = synchroChezLautre(), resultats = synchroResultats().slice(0, 5);

  // On ne reconstruit que si quelque chose a changé (choix en cours conservés).
  const signature = JSON.stringify([state.synchro || null, synchroBrouillon, synchroChoix, partnerName,
    synchroLanceesAujourdhui(), state.synchroStats || null, typeof isAdminUnlocked === 'function' && isAdminUnlocked(),
    chezLautre.map(([k]) => rappelDernier('synchro_' + k)), !!(state.pushSubs && state.pushSubs[partnerId])]);
  if(signature === synchroSignature) return;
  synchroSignature = signature;

  let h = '<div class="jds-intro"><span class="jds-emoji">💞</span><h3 class="jds-title">On est synchro !</h3>'
    + '<p class="jds-sub">Une question, 4 réponses. Répondez <strong>la même chose</strong> : <strong>+' + SYNCHRO_GAIN + ' pts chacun</strong>. '
    + 'Sinon, <strong>−' + SYNCHRO_PERTE + ' pts chacun</strong>.</p></div>';

  // 1. Les questions que l'autre m'a envoyées
  aMoi.sort((x, y) => x[1].ts - y[1].ts).forEach(([k, s]) => {
    const choix = synchroChoix[k];
    h += '<div class="bt-q sy-carte sy-a-moi">'
      + '<div class="bt-q-num">' + escapeHtml(state.players[s.by] || '') + ' a répondu · à toi !</div>'
      + '<div class="bt-q-text">' + escapeHtml(s.q) + '</div>'
      + synchroChoixHTML(s.a, choix, 'data-sy-cle="' + k + '"')
      + '<button type="button" class="btn-primary sy-valider" data-sy-valider="' + k + '"' + (choix === undefined ? ' disabled' : '') + '>'
      + (choix === undefined ? 'Choisis ta réponse' : 'Valider ma réponse') + '</button></div>';
  });

  // 2. Ma question en cours
  if(synchroBrouillon){
    const q = synchroBrouillon.question, c = synchroBrouillon.choix;
    h += '<div class="bt-q sy-carte">'
      + '<div class="bt-q-num">Ta question</div>'
      + '<div class="bt-q-text">' + escapeHtml(q.q) + '</div>'
      + synchroChoixHTML(q.a, c, 'data-sy-brouillon="1"')
      + '<button type="button" class="btn-primary" id="sy-envoyer"' + (c === null ? ' disabled' : '') + '>'
      + (c === null ? 'Choisis ta réponse' : 'Envoyer à ' + escapeHtml(partnerName)) + '</button>'
      + '<button type="button" class="btn-ghost" id="sy-autre">↻ Une autre question</button></div>';
  }else if(synchroLanceesAujourdhui() >= SYNCHRO_PAR_JOUR){
    h += '<button type="button" class="btn-primary sy-epuise" id="sy-nouvelle">💞 Nouvelle question</button>'
      + '<p class="pd-note sy-reste">Tes ' + SYNCHRO_PAR_JOUR + ' questions du jour sont lancées'
      + (aMoi.length ? ' ; tu peux toujours répondre à celles de ' + escapeHtml(partnerName) : '') + '.</p>';
  }else if(chezLautre.length < SYNCHRO_MAX_ATTENTE){
    const reste = SYNCHRO_PAR_JOUR - synchroLanceesAujourdhui();
    h += '<button type="button" class="btn-primary" id="sy-nouvelle">💞 Nouvelle question</button>'
      + '<p class="pd-note sy-reste">Encore ' + reste + ' question' + (reste > 1 ? 's' : '') + ' à lancer aujourd’hui.</p>';
  }else{
    h += '<p class="pd-note">Tu as déjà ' + SYNCHRO_MAX_ATTENTE + ' questions en attente chez ' + escapeHtml(partnerName) + '.</p>';
  }

  // 3. En attente chez l'autre (ma réponse reste cachée pour lui/elle, visible pour moi)
  if(chezLautre.length){
    h += '<div class="sy-titre">⏳ En attente chez ' + escapeHtml(partnerName) + '</div>';
    chezLautre.sort((x, y) => y[1].ts - x[1].ts).forEach(([k, s]) => {
      h += '<div class="bt-detail sy-attente"><div class="bt-detail-q">' + escapeHtml(s.q) + '</div>'
        + '<div class="bt-detail-rep"><span>Toi</span> ' + escapeHtml(synchroLibelle(s, me.id)) + '</div>'
        + rappelHTML('synchro_' + k, 'synchro')
        + '<button type="button" class="sy-retirer" data-sy-retirer="' + k + '">Retirer</button></div>';
    });
  }

  // 4. Derniers résultats
  if(resultats.length){
    h += '<div class="sy-titre">Derniers résultats</div>';
    resultats.forEach(([k, s]) => {
      const autre = s.by === 'p1' ? 'p2' : 'p1';
      h += '<div class="bt-detail ' + (s.ok ? 'ok' : 'ko') + '">'
        + '<div class="bt-detail-q">' + (s.ok ? '💗' : '💔') + ' ' + escapeHtml(s.q) + '</div>'
        + '<div class="bt-detail-rep"><span>' + escapeHtml(state.players[s.by] || '') + '</span> ' + escapeHtml(synchroLibelle(s, s.by)) + '</div>'
        + '<div class="bt-detail-rep"><span>' + escapeHtml(state.players[autre] || '') + '</span> ' + escapeHtml(synchroLibelle(s, autre)) + '</div>'
        + '<div class="sy-gain ' + (s.ok ? 'plus' : 'moins') + '">' + (s.gain >= 0 ? '+' : '−') + Math.abs(s.gain || 0) + ' pts chacun</div></div>';
    });
  }

  if(typeof isAdminUnlocked === 'function' && isAdminUnlocked()) h += synchroStatsHTML();

  $('#synchro-body').innerHTML = h;
  const nv = $('#sy-nouvelle'); if(nv) nv.addEventListener('click', synchroNouvelle);
  const env = $('#sy-envoyer'); if(env) env.addEventListener('click', synchroEnvoyer);
  const au = $('#sy-autre'); if(au) au.addEventListener('click', synchroAutreQuestion);
}

// Pop-up : les 5 questions du jour sont épuisées.
function synchroPopupLimite(){
  let el = document.getElementById('sy-popup');
  if(el) el.remove();
  el = document.createElement('div');
  el.id = 'sy-popup';
  el.className = 'sy-popup';
  el.innerHTML = '<div class="sy-popup-carte" role="dialog">'
    + '<div class="sy-popup-ic">🌙</div>'
    + '<p>Reviens demain pour découvrir <b>' + SYNCHRO_PAR_JOUR + ' nouvelles questions</b> !</p>'
    + '<button type="button" class="btn-primary" data-sy-popup-ok>D’accord</button></div>';
  document.body.appendChild(el);
  el.addEventListener('click', e => {
    if(e.target === el || e.target.closest('[data-sy-popup-ok]')) el.remove();
  });
}

// Statistiques (dev mod) : par thème, combien de parties, et combien de
// questions pas encore sorties dans le cycle en cours. Un thème qui s'épuise
// vite = un thème à enrichir dans le classeur Questions-Synchro.xlsx.
function synchroStatsHTML(){
  const stats = (state && state.synchroStats) || {};
  const vues = (state && state.synchroVues) || {};
  let h = '<div class="sy-titre">📊 Statistiques (dev mod)</div><div class="sy-stats">';
  Object.keys(SYNCHRO_THEMES).forEach(cat => {
    const qs = SYNCHRO_QUESTIONS.filter(q => q.cat === cat);
    let parties = 0, synchro = 0;
    qs.forEach(q => { const st = stats[q.id]; if(st){ parties += st.n || 0; synchro += st.ok || 0; } });
    const neuves = qs.filter(q => !vues[q.id]).length;
    h += '<div class="sy-stat"><b>' + SYNCHRO_THEMES[cat] + '</b>'
      + '<span>' + qs.length + ' questions · ' + parties + ' partie' + (parties > 1 ? 's' : '') + ' jouée' + (parties > 1 ? 's' : '')
      + (parties ? ' · ' + Math.round(100 * synchro / parties) + ' % synchro' : '') + '</span>'
      + '<span class="' + (neuves <= 3 ? 'sy-alerte' : '') + '">' + neuves + ' pas encore sortie' + (neuves > 1 ? 's' : '') + ' dans ce cycle</span></div>';
  });
  const top = Object.entries(stats).filter(([id, st]) => st && st.n).sort((a, b) => b[1].n - a[1].n).slice(0, 5);
  if(top.length){
    h += '<div class="sy-stat"><b>Les plus jouées</b>' + top.map(([id, st]) => {
      const q = SYNCHRO_QUESTIONS.find(x => x.id === id);
      return '<span>' + st.n + '× · ' + escapeHtml(q ? q.q : id) + '</span>';
    }).join('') + '</div>';
  }
  return h + '</div>';
}

// Tuile de la page des jeux : pastille « Nouveau ! » et nombre de questions
// qui m'attendent (aussi sur le bouton « Jouer » de l'accueil).
function synchroMajTuile(){
  const tuile = document.querySelector('.cat-btn[data-cat="synchro"]');
  const n = (state && me) ? synchroAMoi().length : 0;
  if(tuile){
    let neuf = tuile.querySelector('.sy-nouveau');
    const montrer = Date.now() <= SYNCHRO_NOUVEAU_JUSQUA.getTime();
    if(montrer && !neuf){ neuf = document.createElement('span'); neuf.className = 'sy-nouveau'; neuf.textContent = 'Nouveau !'; tuile.appendChild(neuf); }
    if(!montrer && neuf) neuf.remove();
    synchroBulle(tuile, n);
  }
  const jouer = $('#jouer-btn');
  if(jouer) synchroBulle(jouer, n);
}

function synchroBulle(el, n){
  let b = el.querySelector('.sy-bulle');
  if(!n){ if(b) b.remove(); return; }
  if(!b){ b = document.createElement('span'); b.className = 'sy-bulle'; el.appendChild(b); }
  b.textContent = n;
  b.title = n + ' question' + (n > 1 ? 's' : '') + ' « On est synchro ! » à toi';
}

document.addEventListener('click', e => {
  const t = e.target.closest && e.target.closest('[data-sy-r], [data-sy-valider], [data-sy-retirer]');
  if(!t) return;
  e.stopPropagation();
  if(t.dataset.syValider){ synchroRepondre(t.dataset.syValider); return; }
  if(t.dataset.syRetirer){ synchroAnnuler(t.dataset.syRetirer); return; }
  const r = parseInt(t.dataset.syR, 10);
  if(t.dataset.syBrouillon && synchroBrouillon) synchroBrouillon.choix = r;
  else if(t.dataset.syCle) synchroChoix[t.dataset.syCle] = r;
  renderSynchro();
}, true);
