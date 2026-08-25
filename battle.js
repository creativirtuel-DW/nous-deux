/**
 * Nous Deux — mode BATTLE
 * =======================
 * Une série de 5 questions à 4 réponses : 2 « quotidien », 1 « souvenir »,
 * 2 « coquin ». Le premier joueur répond, le/la partenaire reçoit la même
 * série. Le but n'est pas d'avoir raison, mais de répondre la même chose.
 *
 * Chaque réponse commune vaut +10 d'Osmose, chaque divergence -10.
 * L'Osmose est un cumul signé, affiché dans le cœur entre les deux scores.
 */

const BATTLE_TIRAGE = { quotidien: 2, souvenir: 1, coquin: 2 };
const OSMOSE_PAR_REPONSE = 10;

// Une réponse dont le libellé commence par « Autre » ouvre un champ de saisie.
function battleEstLibre(libelle){
  return /^\s*autre/i.test(libelle || '');
}

// Normalisation pour comparer deux réponses libres : minuscules, accents et
// ponctuation retirés, espaces réduits. « Dans l'ascenseur ! » == « ascenseur ».
function battleNormalise(t){
  return (t || '')
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Deux textes libres correspondent s'ils sont identiques une fois normalisés,
// ou si l'un contient l'autre (au moins 3 caractères, pour éviter les hasards).
function battleTextesConcordent(t1, t2){
  const a = battleNormalise(t1), b = battleNormalise(t2);
  if(!a || !b) return false;
  if(a === b) return true;
  if(a.length >= 3 && b.length >= 3 && (a.indexOf(b) !== -1 || b.indexOf(a) !== -1)) return true;
  return false;
}

// Libellé affiché à la révélation : la réponse libre remplace « Autre : ».
function battleLibelle(q, choix, textes, i){
  if(choix === null || choix === undefined) return '—';
  const brut = q.a[choix];
  if(brut === undefined) return '—';
  if(battleEstLibre(brut)){
    const t = textes && textes[String(i)];
    return t ? (brut.replace(/\s*:\s*$/, '') + ' : ' + t) : brut;
  }
  return brut;
}

// La grille est complète quand les 5 réponses sont choisies et qu'aucune
// réponse libre n'a été laissée vide.
function battleGrilleComplete(questions, reponses, textes){
  return questions.every((q, i) => {
    if(reponses[i] === null || reponses[i] === undefined) return false;
    if(battleEstLibre(q.a[reponses[i]])) return !!(textes[String(i)] || '').trim();
    return true;
  });
}

let battleActive = false;
let battleBrouillon = null;   // réponses en cours de saisie, avant envoi
let battleAOublier = [];      // ids à libérer : catégorie épuisée, nouveau cycle

function openBattle(){ battleActive = true; battleBrouillon = null; render(); }
function closeBattle(){ battleActive = false; battleBrouillon = null; render(); }

function battleRef(){ return roomRef.child('battle'); }
function battleGet(){ return (state && state.battle) || null; }
function osmoseGet(){ return (state && typeof state.osmose === 'number') ? state.osmose : 0; }

function battleMelange(tab){
  const t = tab.slice();
  for(let i = t.length - 1; i > 0; i--){
    const j = Math.floor(Math.random() * (i + 1));
    [t[i], t[j]] = [t[j], t[i]];
  }
  return t;
}

// Banque de base + questions ajoutées par le couple.
function battlePool(){
  const perso = [];
  if(state && state.battleCards){
    Object.entries(state.battleCards).forEach(([k, c]) => {
      if(c && c.q && Array.isArray(c.a) && c.a.length === 4) perso.push({...c, id: k});
    });
  }
  return BATTLE_QUESTIONS.concat(perso);
}

// Tirage. Les questions déjà sorties (battleVues) sont écartées : on ne
// repropose une question qu'une fois sa catégorie entièrement épuisée, et on
// repart alors sur un cycle neuf. Deux Battles ne peuvent donc pas se recouper.
function battleTirage(){
  const pool = battlePool();
  const vues = (state && state.battleVues) || {};
  const choisies = [];
  battleAOublier = [];

  Object.entries(BATTLE_TIRAGE).forEach(([cat, n]) => {
    const dansLaCat = pool.filter(q => q.cat === cat);
    let dispo = dansLaCat.filter(q => !vues[q.id]);

    if(dispo.length < n){
      // Catégorie épuisée : on efface son historique et on recommence un cycle.
      dansLaCat.forEach(q => { if(vues[q.id]) battleAOublier.push(q.id); });
      dispo = dansLaCat;
    }
    choisies.push(...battleMelange(dispo).slice(0, n));
  });

  const manque = 5 - choisies.length;
  if(manque > 0){
    const reste = battleMelange(pool.filter(q => choisies.indexOf(q) === -1));
    choisies.push(...reste.slice(0, manque));
  }
  // On fige énoncé et réponses : la série reste identique pour les deux, même
  // si une question personnalisée est supprimée entre-temps.
  return battleMelange(choisies).slice(0, 5)
    .map(q => ({ id: q.id, q: q.q, a: q.a.slice(), cat: q.cat }));
}

function battleLancer(){
  if(battleGet()) return;                 // une seule Battle à la fois
  const questions = battleTirage();
  if(questions.length < 5){ alert("Il n'y a pas assez de questions pour lancer une Battle."); return; }
  battleBrouillon = { questions: questions, reponses: [null, null, null, null, null], textes: {} };
  render();
}

// Le lanceur envoie ses réponses : la série part chez le/la partenaire.
function battleEnvoyer(){
  if(!battleBrouillon) return;
  if(!battleGrilleComplete(battleBrouillon.questions, battleBrouillon.reponses, battleBrouillon.textes)) return;
  const questions = battleBrouillon.questions;
  const updates = {};
  updates['battle'] = {
    by: me.id,
    questions: questions,
    reponses: { [me.id]: battleBrouillon.reponses },
    textes: { [me.id]: battleNettoieTextes(questions, battleBrouillon.reponses, battleBrouillon.textes) },
    status: 'attente',
    ts: Date.now()
  };
  // Mémoire anti-répétition : on libère les catégories épuisées,
  // puis on marque les 5 questions de cette série comme sorties.
  battleAOublier.forEach(id => { updates['battleVues/' + id] = null; });
  questions.forEach(q => { if(q.id) updates['battleVues/' + q.id] = true; });
  battleAOublier = [];

  battleBrouillon = null;
  roomRef.update(updates).then(() => {
    notifyPartner('⚔️ Battle !', me.name + ' te lance une Battle : 5 questions, à toi de deviner ses réponses.', 'battle');
  });
}

// Le/la partenaire répond : on calcule l'Osmose et on révèle tout.
// On ne garde que les textes des questions réellement répondues « Autre ».
function battleNettoieTextes(questions, reponses, textes){
  const propre = {};
  questions.forEach((q, i) => {
    if(reponses[i] !== null && reponses[i] !== undefined && battleEstLibre(q.a[reponses[i]])){
      const t = ((textes || {})[String(i)] || '').trim();
      if(t) propre[String(i)] = t;
    }
  });
  return propre;
}

// Deux réponses correspondent si le même bouton a été choisi ; pour une
// réponse libre, il faut en plus que les deux textes concordent.
function battleReponsesConcordent(q, i, choixA, textesA, choixB, textesB){
  if(choixA !== choixB) return false;
  if(!battleEstLibre(q.a[choixA])) return true;
  return battleTextesConcordent((textesA || {})[String(i)], (textesB || {})[String(i)]);
}

function battleRepondre(reponses, mesTextes){
  const b = battleGet();
  if(!b || b.by === me.id || b.status !== 'attente') return;
  if(!battleGrilleComplete(b.questions, reponses, mesTextes || {})) return;

  const siennes = b.reponses[b.by] || [];
  const sesTextes = (b.textes && b.textes[b.by]) || {};
  const propres = battleNettoieTextes(b.questions, reponses, mesTextes);
  let communes = 0;
  reponses.forEach((r, i) => {
    if(battleReponsesConcordent(b.questions[i], i, r, propres, siennes[i], sesTextes)) communes++;
  });
  const delta = (communes * OSMOSE_PAR_REPONSE) - ((reponses.length - communes) * OSMOSE_PAR_REPONSE);

  const updates = {};
  updates['battle/reponses/' + me.id] = reponses;
  updates['battle/textes/' + me.id] = propres;
  updates['battle/status'] = 'termine';
  updates['battle/communes'] = communes;
  updates['battle/delta'] = delta;
  updates['osmose'] = osmoseGet() + delta;

  const hk = db.ref('rooms/' + roomCode + '/history').push().key;
  updates['history/' + hk] = {
    who: me.name, cat: 'battle',
    text: 'Battle — ' + communes + ' réponse' + (communes > 1 ? 's' : '') + ' commune' + (communes > 1 ? 's' : '') + ' sur 5',
    pts: 0, osmose: delta, validated: true, ts: Date.now()
  };

  roomRef.update(updates).then(() => {
    notifyPartner('⚔️ Battle terminée',
      me.name + ' a répondu : ' + communes + '/5 en commun, ' + (delta >= 0 ? '+' : '') + delta + ' d’Osmose.', 'battle');
  });
}

function battleNouvelle(){
  battleRef().remove();
  battleBrouillon = null;
  render();
}

function battleAnnuler(){
  const b = battleGet();
  if(!b || b.by !== me.id || b.status !== 'attente') return;
  battleRef().remove();
}

// ---------- RENDU ----------
function battleGrilleHTML(questions, reponses, verrouille, textes){
  textes = textes || {};
  return questions.map((q, i) => `
    <div class="bt-q">
      <div class="bt-q-num">Question ${i + 1}/5</div>
      <div class="bt-q-text">${escapeHtml(q.q)}</div>
      <div class="bt-choix">
        ${q.a.map((rep, j) => `
          <button class="bt-choix-btn${reponses[i] === j ? ' choisi' : ''}"
                  data-q="${i}" data-r="${j}"${verrouille ? ' disabled' : ''}>${escapeHtml(rep)}</button>
          ${battleEstLibre(rep) && reponses[i] === j
            ? `<input type="text" class="bt-libre" data-q="${i}" maxlength="60"
                      placeholder="ta réponse" value="${escapeHtml(textes[String(i)] || '')}"${verrouille ? ' disabled' : ''}>`
            : ''}
        `).join('')}
      </div>
    </div>
  `).join('');
}

function battleBrancheChoix(racine, reponses, onChange, textes){
  racine.querySelectorAll('.bt-choix-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const i = parseInt(btn.dataset.q, 10);
      reponses[i] = parseInt(btn.dataset.r, 10);
      onChange();
    });
  });
  // Le champ libre ne doit pas provoquer de re-rendu à chaque frappe : on se
  // contente de mémoriser la saisie et de rafraîchir l'état du bouton d'envoi.
  racine.querySelectorAll('.bt-libre').forEach(champ => {
    champ.addEventListener('input', () => {
      textes[String(champ.dataset.q)] = champ.value;
      if(typeof onChange === 'function') onChange(true);
    });
    if(document.activeElement !== champ && champ.value === '') champ.focus();
  });
}

function renderBattle(){
  const panel = $('#battle-panel');
  if(!panel) return;
  if(!battleActive){ panel.style.display = 'none'; return; }
  panel.style.display = 'flex';

  const body = $('#battle-body');
  const b = battleGet();
  const partnerName = state.players[partnerId] || 'ton/ta partenaire';

  // ---------- SAISIE EN COURS (le lanceur remplit sa grille) ----------
  if(battleBrouillon){
    if(!battleBrouillon.textes) battleBrouillon.textes = {};
    const complet = battleGrilleComplete(battleBrouillon.questions, battleBrouillon.reponses, battleBrouillon.textes);
    body.innerHTML = `
      <div class="jds-intro">
        <span class="jds-emoji">⚔️</span>
        <h3 class="jds-title">Battle</h3>
        <p class="jds-sub">Réponds à ces 5 questions. ${escapeHtml(partnerName)} recevra exactement la même série — chaque réponse identique vaut <strong>+10 d'Osmose</strong>, chaque divergence <strong>−10</strong>.</p>
      </div>
      ${battleGrilleHTML(battleBrouillon.questions, battleBrouillon.reponses, false, battleBrouillon.textes)}
      <button class="btn-primary" id="bt-send"${complet ? '' : ' disabled'}>
        ${complet ? 'Envoyer à ' + escapeHtml(partnerName) : 'Réponds aux 5 questions'}
      </button>
      <button class="btn-ghost" id="bt-abandon">Abandonner cette série</button>
    `;
    battleBrancheChoix(body, battleBrouillon.reponses, (saisie) => {
      if(saisie) battleMajBouton('#bt-send', battleBrouillon.questions, battleBrouillon.reponses, battleBrouillon.textes, partnerName);
      else renderBattle();
    }, battleBrouillon.textes);
    $('#bt-send').addEventListener('click', battleEnvoyer);
    $('#bt-abandon').addEventListener('click', () => { battleBrouillon = null; render(); });
    return;
  }

  // ---------- AUCUNE BATTLE ----------
  if(!b){
    body.innerHTML = `
      <div class="jds-intro">
        <span class="jds-emoji">⚔️</span>
        <h3 class="jds-title">Battle</h3>
        <p class="jds-sub">5 questions, 4 réponses possibles. Le but n'est pas d'avoir raison : c'est de répondre <strong>la même chose que l'autre</strong>.</p>
      </div>
      <div class="jds-card">
        <span class="jds-label">Comment ça marche</span>
        <div class="bt-regle"><span>1</span><span>Tu réponds aux 5 questions.</span></div>
        <div class="bt-regle"><span>2</span><span>${escapeHtml(partnerName)} reçoit la même série et répond à son tour.</span></div>
        <div class="bt-regle"><span>3</span><span>Chaque réponse commune : <strong>+10 d'Osmose</strong>. Chaque divergence : <strong>−10</strong>.</span></div>
        <p class="pd-note">Chaque série mélange 2 questions du quotidien, 1 souvenir et 2 plus intimes.</p>
      </div>
      <button class="btn-primary" id="bt-start">Lancer une Battle</button>
    `;
    $('#bt-start').addEventListener('click', battleLancer);
    return;
  }

  // ---------- EN ATTENTE ----------
  if(b.status === 'attente'){
    if(b.by === me.id){
      body.innerHTML = `
        <div class="jds-intro">
          <span class="jds-emoji">⏳</span>
          <h3 class="jds-title">Battle envoyée</h3>
          <p class="jds-sub">${escapeHtml(partnerName)} n'a pas encore répondu. Tes réponses restent cachées jusque-là.</p>
        </div>
        <button class="btn-ghost danger-btn" id="bt-cancel">Annuler cette Battle</button>
      `;
      $('#bt-cancel').addEventListener('click', battleAnnuler);
      return;
    }

    // C'est à moi de répondre
    if(!battleBrouillon) battleBrouillon = null;
    const mesReponses = window._btRep && window._btRep.length === 5 ? window._btRep : [null, null, null, null, null];
    window._btRep = mesReponses;
    if(!window._btTxt) window._btTxt = {};
    const mesTextes = window._btTxt;
    const complet = battleGrilleComplete(b.questions, mesReponses, mesTextes);
    body.innerHTML = `
      <div class="jds-intro">
        <span class="jds-emoji">⚔️</span>
        <h3 class="jds-title">${escapeHtml(state.players[b.by] || '')} te défie</h3>
        <p class="jds-sub">Réponds aux mêmes 5 questions. Essaie de tomber juste : chaque réponse identique vaut <strong>+10 d'Osmose</strong>.</p>
      </div>
      ${battleGrilleHTML(b.questions, mesReponses, false, mesTextes)}
      <button class="btn-primary" id="bt-answer"${complet ? '' : ' disabled'}>
        ${complet ? 'Valider mes réponses' : 'Réponds aux 5 questions'}
      </button>
    `;
    battleBrancheChoix(body, mesReponses, (saisie) => {
      if(saisie) battleMajBouton('#bt-answer', b.questions, mesReponses, mesTextes, null);
      else renderBattle();
    }, mesTextes);
    $('#bt-answer').addEventListener('click', () => {
      const r = window._btRep, t = window._btTxt;
      window._btRep = null; window._btTxt = null;
      battleRepondre(r, t);
    });
    return;
  }

  // ---------- RÉSULTAT ----------
  const rA = b.reponses[b.by] || [];
  const autreId = b.by === 'p1' ? 'p2' : 'p1';
  const rB = b.reponses[autreId] || [];
  const tA = (b.textes && b.textes[b.by]) || {};
  const tB = (b.textes && b.textes[autreId]) || {};
  const nomA = state.players[b.by] || '';
  const nomB = state.players[autreId] || '';

  body.innerHTML = `
    <div class="bt-resultat ${b.delta >= 0 ? 'bon' : 'mauvais'}">
      <div class="bt-score">${b.communes}<span>/5</span></div>
      <div class="bt-score-label">réponse${b.communes > 1 ? 's' : ''} commune${b.communes > 1 ? 's' : ''}</div>
      <div class="bt-delta">${b.delta >= 0 ? '+' : ''}${b.delta} d'Osmose</div>
    </div>
    ${b.questions.map((q, i) => {
      const ok = battleReponsesConcordent(q, i, rA[i], tA, rB[i], tB);
      return `
        <div class="bt-detail ${ok ? 'ok' : 'ko'}">
          <div class="bt-detail-q">${ok ? '💗' : '💔'} ${escapeHtml(q.q)}</div>
          <div class="bt-detail-rep"><span>${escapeHtml(nomA)}</span> ${escapeHtml(battleLibelle(q, rA[i], tA, i))}</div>
          <div class="bt-detail-rep"><span>${escapeHtml(nomB)}</span> ${escapeHtml(battleLibelle(q, rB[i], tB, i))}</div>
        </div>
      `;
    }).join('')}
    <button class="btn-primary" id="bt-new">⚔️ Nouvelle Battle</button>
  `;
  $('#bt-new').addEventListener('click', battleNouvelle);
}

// Rafraîchit le seul bouton d'envoi, pour ne pas reconstruire la grille
// pendant que l'utilisateur tape dans un champ libre (il perdrait le focus).
function battleMajBouton(selecteur, questions, reponses, textes, nomPartenaire){
  const btn = $(selecteur);
  if(!btn) return;
  const complet = battleGrilleComplete(questions, reponses, textes);
  btn.disabled = !complet;
  if(nomPartenaire !== null && nomPartenaire !== undefined){
    btn.textContent = complet ? 'Envoyer à ' + nomPartenaire : 'Réponds aux 5 questions';
  }else{
    btn.textContent = complet ? 'Valider mes réponses' : 'Réponds aux 5 questions';
  }
}

// ---------- LE CŒUR D'OSMOSE, DANS L'EN-TÊTE ----------
// Le nombre est blanc jusqu'à 30, puis chauffe progressivement
// jusqu'à l'écarlate à partir de 150.
const OSMOSE_BLANC_JUSQUA = 30;
const OSMOSE_ECARLATE_DES = 150;

function osmoseCouleur(o){
  if(o < 0) return '';   // en négatif, c'est la règle CSS « .negatif » qui décide
  const t = Math.max(0, Math.min(1, (o - OSMOSE_BLANC_JUSQUA) / (OSMOSE_ECARLATE_DES - OSMOSE_BLANC_JUSQUA)));
  const vert = Math.round(255 + (36 - 255) * t);
  const bleu = Math.round(255 + (0  - 255) * t);
  return 'rgb(255, ' + vert + ', ' + bleu + ')';
}

function renderOsmose(){
  const val = $('#osmose-val');
  const coeur = $('#osmose-heart');
  if(!val || !coeur) return;
  const o = osmoseGet();
  val.textContent = o;
  val.style.color = osmoseCouleur(o);
  coeur.classList.toggle('negatif', o < 0);
  coeur.title = "Osmose : " + o + " point" + (Math.abs(o) > 1 ? 's' : '');
}

// ---------- QUESTIONS BATTLE PERSONNALISÉES (onglet Cartes) ----------
function setupBattleCards(){
  const form = $('#form-add-battle');
  if(!form) return;
  form.addEventListener('submit', e => {
    e.preventDefault();
    const q = $('#bt-new-q').value.trim();
    const a = ['bt-new-a1', 'bt-new-a2', 'bt-new-a3', 'bt-new-a4'].map(id => $('#' + id).value.trim());
    const cat = $('#bt-new-cat').value;
    if(!q || a.some(x => !x)){ alert("Il faut l'énoncé et les 4 réponses."); return; }
    roomRef.child('battleCards').push({ q: q, a: a, cat: cat, by: me.name, ts: Date.now() });
    form.reset();
    alert('Question ajoutée à la banque Battle.');
  });
}

function renderBattleCards(){
  const wrap = $('#battle-cards-list');
  if(!wrap) return;
  const bloc = $('#battle-cards-block');
  if(bloc) bloc.style.display = isAdminUnlocked() ? 'block' : 'none';
  if(!isAdminUnlocked()){ wrap.innerHTML = ''; return; }

  const perso = state.battleCards ? Object.entries(state.battleCards) : [];
  if(!perso.length){ wrap.innerHTML = '<p class="empty-state">Aucune question Battle ajoutée pour le moment.</p>'; return; }

  const labels = { quotidien:'☕ Quotidien', souvenir:'📷 Souvenir', coquin:'🔥 Intime' };
  wrap.innerHTML = '';
  perso.sort((x, y) => (y[1].ts || 0) - (x[1].ts || 0)).forEach(([key, c]) => {
    const row = document.createElement('div');
    row.className = 'jds-hist-row';
    row.innerHTML = `
      <div class="hist-gage-owner">${labels[c.cat] || c.cat}</div>
      <div class="jds-hist-gain">${escapeHtml(c.q)}</div>
      <div class="jds-hist-lose">${c.a.map(x => escapeHtml(x)).join(' · ')}</div>
      <button class="hist-gage-del">Supprimer</button>
    `;
    row.querySelector('.hist-gage-del').addEventListener('click', () => {
      if(confirm('Supprimer cette question Battle ?')) roomRef.child('battleCards/' + key).remove();
    });
    wrap.appendChild(row);
  });
}
