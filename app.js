// ====== CONFIG FIREBASE ======
const firebaseConfig = {
  apiKey: "AIzaSyC4LYuGvDah-5G8lvP-rNucxr-Aijlrvvs",
  authDomain: "nous-dw.firebaseapp.com",
  databaseURL: "https://nous-dw-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "nous-dw",
  storageBucket: "nous-dw.firebasestorage.app",
  messagingSenderId: "46961778673",
  appId: "1:46961778673:web:5353b74fcfeffb251e2e50",
};
firebase.initializeApp(firebaseConfig);
const db = firebase.database();

// ====== ÉTAT LOCAL ======
let me = { name: '', id: '' };          // id = 'p1' ou 'p2'
let partnerId = '';
let roomCode = '';
let roomRef = null;
let state = null;                        // dernier snapshot de la room
let currentDrawnCard = null;
let currentCardCategory = null;
let adminUnlockedThisSession = false;

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

// ====== ADMIN (code de protection pour éditer/supprimer) ======
function adminStorageKey(){ return 'nousdeux_admin_' + roomCode; }

function isAdminUnlocked(){
  if(adminUnlockedThisSession) return true;
  try{
    return sessionStorage.getItem(adminStorageKey()) === 'true';
  }catch(e){ return false; }
}

function unlockAdminLocally(){
  adminUnlockedThisSession = true;
  try{ sessionStorage.setItem(adminStorageKey(), 'true'); }catch(e){}
}

function handleAdminLockClick(){
  if(isAdminUnlocked()){
    // re-verrouiller
    adminUnlockedThisSession = false;
    try{ sessionStorage.removeItem(adminStorageKey()); }catch(e){}
    render();
    return;
  }

  const existingPin = state && state.adminPin;

  if(!existingPin){
    const newPin = prompt("Aucun code admin n'est encore défini pour cette room.\nChoisis un code (4 chiffres ou plus) qui protégera l'édition/suppression des cartes et paliers :");
    if(!newPin || newPin.trim().length < 4){
      if(newPin !== null) alert("Le code doit faire au moins 4 caractères.");
      return;
    }
    roomRef.child('adminPin').set(newPin.trim()).then(() => {
      unlockAdminLocally();
      render();
    });
    return;
  }

  const entered = prompt("Code admin requis pour modifier/supprimer :");
  if(entered === null) return;
  if(entered.trim() === existingPin){
    unlockAdminLocally();
    render();
  } else {
    alert("Code incorrect.");
  }
}

// ====== PERSISTENCE LOCALE (identité du joueur sur ce téléphone) ======
function loadLocalIdentity(){
  try{
    const raw = localStorage.getItem('nousdeux_identity');
    if(raw) return JSON.parse(raw);
  }catch(e){}
  return null;
}
function saveLocalIdentity(obj){
  try{ localStorage.setItem('nousdeux_identity', JSON.stringify(obj)); }catch(e){}
}

// ====== DÉMARRAGE ======
window.addEventListener('DOMContentLoaded', () => {
  const saved = loadLocalIdentity();
  if(saved && saved.name && saved.room){
    $('#input-name').value = saved.name;
    $('#input-room').value = saved.room;
  }
  $('#btn-join').addEventListener('click', joinRoom);
  setupTabs();
  setupPlayView();
  setupContentView();
  setupRewardsView();
  $('#btn-admin-lock-content').addEventListener('click', handleAdminLockClick);
  $('#btn-admin-lock-rewards').addEventListener('click', handleAdminLockClick);
});

function joinRoom(){
  const name = $('#input-name').value.trim();
  const room = $('#input-room').value.trim().toUpperCase().replace(/\s+/g,'-');
  const errEl = $('#login-error');
  errEl.textContent = '';

  if(!name){ errEl.textContent = "Indique ton prénom."; return; }
  if(!room){ errEl.textContent = "Indique un code de couple."; return; }

  roomCode = room;
  roomRef = db.ref('rooms/' + roomCode);

  roomRef.once('value').then(snap => {
    const data = snap.val();

    if(!data || !data.players){
      // Nouvelle room : je deviens p1
      me = { name, id: 'p1' };
      partnerId = 'p2';
      const initial = {
        players: { p1: name, p2: null },
        scores: { p1: 0, p2: 0 },
        customCards: {},
        customRewards: {},
        history: {}
      };
      return roomRef.set(initial).then(() => startApp());
    }

    // Room existante : suis-je déjà p1 ou p2 (même prénom) ?
    if(data.players.p1 && data.players.p1.toLowerCase() === name.toLowerCase()){
      me = { name, id:'p1' }; partnerId='p2';
    } else if(data.players.p2 && data.players.p2.toLowerCase() === name.toLowerCase()){
      me = { name, id:'p2' }; partnerId='p1';
    } else if(!data.players.p2){
      // Je rejoins en tant que p2
      me = { name, id:'p2' }; partnerId='p1';
      return roomRef.child('players/p2').set(name).then(() => startApp());
    } else if(!data.players.p1){
      me = { name, id:'p1' }; partnerId='p2';
      return roomRef.child('players/p1').set(name).then(() => startApp());
    } else {
      errEl.textContent = "Cette room a déjà deux joueurs avec d'autres prénoms. Utilise le même prénom que la première fois, ou un autre code.";
      return;
    }
    startApp();
  }).catch(err => {
    errEl.textContent = "Erreur de connexion. Vérifie ta connexion internet.";
    console.error(err);
  });
}

function startApp(){
  saveLocalIdentity({ name: me.name, room: roomCode });
  $('#screen-login').classList.remove('active');
  $('#screen-main').classList.add('active');
  $('#room-label').textContent = roomCode;

  roomRef.on('value', snap => {
    state = snap.val();
    if(!state) return;
    render();
  });
}

// ====== RENDU GLOBAL ======
function render(){
  if(!state) return;

  // Scores
  const myScore = state.scores ? (state.scores[me.id]||0) : 0;
  const partnerScore = state.scores ? (state.scores[partnerId]||0) : 0;
  $('#name-me').textContent = me.name;
  $('#val-me').textContent = myScore;
  $('#name-partner').textContent = state.players[partnerId] || 'En attente…';
  $('#val-partner').textContent = partnerScore;

  // Le bandeau et le picker sont maintenant gérés entièrement dans renderPendingCard()

  renderPendingCard();
  renderRewards();
  renderHistory();
  renderCustomCards();
  renderAdminLockButtons();
}

function renderPendingCard(){
  const allPending = getPendingEntries();
  const mine = allPending.filter(([k,p]) => p.by === me.id);
  const toValidate = allPending.filter(([k,p]) => p.by !== me.id);

  const catPicker = $('#cat-picker');
  const turnBanner = $('#turn-banner');
  const full = allPending.length >= MAX_PENDING;

  catPicker.style.display = 'grid';
  $$('.cat-btn').forEach(b => b.classList.toggle('disabled', full));
  turnBanner.textContent = full
    ? `🚫 File pleine (${MAX_PENDING}/${MAX_PENDING}) — attends une validation`
    : `✦ Pioche une carte (${allPending.length}/${MAX_PENDING} en attente)`;

  const labelMap = { question:'💬 Question', defi:'🔥 Défi', gage:'😈 Gage' };

  // Cartes que JE dois valider (jouées par mon/ma partenaire)
  const toValSection = $('#pending-to-validate-section');
  const toValList = $('#pending-to-validate-list');
  toValSection.style.display = toValidate.length ? 'block' : 'none';
  toValList.innerHTML = '';
  toValidate.forEach(([key, p]) => {
    const row = document.createElement('div');
    row.className = 'pending-card';
    row.innerHTML = `
      <div class="pending-card-top">
        <span class="pending-cat">${labelMap[p.cat]||'Carte'}</span>
        <span class="pending-who">${escapeHtml(state.players[p.by]||'')}</span>
      </div>
      <p class="pending-text">${escapeHtml(p.text)}</p>
      <div class="pending-actions">
        <button class="btn-ghost pending-refuse">Refuser</button>
        <button class="btn-primary pending-validate">Valider ! +${p.pts}</button>
      </div>
    `;
    row.querySelector('.pending-refuse').addEventListener('click', () => validatePending(key, false));
    row.querySelector('.pending-validate').addEventListener('click', () => validatePending(key, true));
    toValList.appendChild(row);
  });

  // Mes cartes en attente de validation par l'autre
  const mineSection = $('#pending-mine-section');
  const mineList = $('#pending-mine-list');
  mineSection.style.display = mine.length ? 'block' : 'none';
  mineList.innerHTML = '';
  mine.forEach(([key, p]) => {
    const row = document.createElement('div');
    row.className = 'pending-card waiting';
    row.innerHTML = `
      <div class="pending-card-top">
        <span class="pending-cat">${labelMap[p.cat]||'Carte'}</span>
        <span class="pending-who">+${p.pts} en attente…</span>
      </div>
      <p class="pending-text">${escapeHtml(p.text)}</p>
      <div class="pending-actions">
        <button class="btn-ghost pending-cancel">Annuler (0 point)</button>
      </div>
    `;
    row.querySelector('.pending-cancel').addEventListener('click', () => cancelPending(key));
    mineList.appendChild(row);
  });
}

function renderAdminLockButtons(){
  const unlocked = isAdminUnlocked();
  [$('#btn-admin-lock-content'), $('#btn-admin-lock-rewards')].forEach(btn => {
    if(!btn) return;
    btn.textContent = unlocked ? '🔓' : '🔒';
    btn.title = unlocked ? 'Mode admin actif — appuie pour reverrouiller' : 'Déverrouiller le mode admin';
    btn.classList.toggle('unlocked', unlocked);
  });
}

// ====== TABS ======
function setupTabs(){
  $$('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
      $$('.tab').forEach(t=>t.classList.remove('active'));
      $$('.view').forEach(v=>v.classList.remove('active'));
      tab.classList.add('active');
      $('#'+tab.dataset.view).classList.add('active');
    });
  });
}

// ====== VUE JEU ======
function setupPlayView(){
  $$('.cat-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      if(btn.classList.contains('disabled')) return;
      drawCard(btn.dataset.cat);
    });
  });
  // Les actions des boutons sont ré-attribuées dynamiquement à chaque rendu (cf. renderPendingCard)
}

function getActiveDefaultCards(){
  const disabled = (state && state.disabledDefaults) || {};
  return DEFAULT_CARDS.filter(c => !disabled[c.id]);
}

function getAllCardsForCategory(cat){
  const activeDefaults = getActiveDefaultCards();
  const customForCat = [];
  if(state && state.customCards){
    Object.entries(state.customCards).forEach(([key, c]) => {
      if(c.cat === cat) customForCat.push({...c, id:key, custom:true});
    });
  }
  const defaults = activeDefaults.filter(c => c.cat === cat);
  if(cat === 'surprise'){
    const allCustom = [];
    if(state && state.customCards){
      Object.entries(state.customCards).forEach(([key,c]) => allCustom.push({...c, id:key, custom:true}));
    }
    return activeDefaults.concat(allCustom);
  }
  return defaults.concat(customForCat);
}

const MAX_PENDING = 5;

function getPendingEntries(){
  if(!state.pendingCards) return [];
  return Object.entries(state.pendingCards).sort((a,b)=> a[1].ts - b[1].ts);
}

function drawCard(cat){
  const pending = getPendingEntries();
  if(pending.length >= MAX_PENDING) return; // file pleine, on bloque

  const pool = getAllCardsForCategory(cat);
  if(pool.length === 0) return;
  const card = pool[Math.floor(Math.random()*pool.length)];
  const realCat = cat === 'surprise' ? card.cat : cat;

  const key = db.ref('rooms/'+roomCode+'/pendingCards').push().key;
  roomRef.child('pendingCards/'+key).set({
    by: me.id,
    cat: realCat,
    text: card.text,
    pts: card.pts,
    ts: Date.now()
  });
}

function cancelPending(key){
  const pending = state.pendingCards && state.pendingCards[key];
  if(!pending || pending.by !== me.id) return;
  roomRef.child('pendingCards/'+key).remove();
}

function validatePending(key, approved){
  const pending = state.pendingCards && state.pendingCards[key];
  if(!pending || pending.by === me.id) return; // seul le/la partenaire peut valider

  const drawerId = pending.by;
  const pts = approved ? pending.pts : 0;
  const updates = {};
  updates['scores/' + drawerId] = (state.scores[drawerId]||0) + pts;
  updates['pendingCards/'+key] = null;

  const histKey = db.ref('rooms/'+roomCode+'/history').push().key;
  updates['history/' + histKey] = {
    who: state.players[drawerId], cat: pending.cat, text: pending.text, pts: pts, validated: approved, ts: Date.now()
  };

  roomRef.update(updates);
}

// ====== VUE RÉCOMPENSES ======
function setupRewardsView(){
  $('#btn-add-reward').addEventListener('click', () => {
    let form = $('#inline-add-reward');
    if(form){ form.remove(); $('#btn-add-reward').textContent = '+ Ajouter un palier'; return; }
    form = document.createElement('div');
    form.id = 'inline-add-reward';
    form.className = 'add-reward-form active';
    form.innerHTML = `
      <input type="number" id="new-reward-pts" placeholder="Seuil de points (ex: 150)" min="5" step="5">
      <input type="text" id="new-reward-desc" placeholder="Description de la récompense" maxlength="120">
      <button class="btn-primary" id="confirm-add-reward">Ajouter</button>
    `;
    $('#view-rewards').insertBefore(form, $('#btn-add-reward'));
    $('#btn-add-reward').textContent = 'Annuler';
    $('#confirm-add-reward').addEventListener('click', () => {
      const pts = parseInt($('#new-reward-pts').value, 10);
      const desc = $('#new-reward-desc').value.trim();
      if(!pts || !desc) return;
      const key = db.ref('rooms/'+roomCode+'/customRewards').push().key;
      roomRef.child('customRewards/'+key).set({ pts, desc });
      form.remove();
      $('#btn-add-reward').textContent = '+ Ajouter un palier';
    });
  });
}

function renderRewards(){
  const myScore = state.scores ? (state.scores[me.id]||0) : 0;
  const partnerScore = state.scores ? (state.scores[partnerId]||0) : 0;
  const team = myScore + partnerScore;
  $('#team-score').textContent = team;

  let all = DEFAULT_REWARDS.map((r,i) => ({...r, id:'r'+i, custom:false}));
  if(state.customRewards){
    Object.entries(state.customRewards).forEach(([key,r]) => all.push({...r, custom:true, id:key}));
  }
  const disabledRewards = (state.disabledRewards) || {};
  all = all.filter(r => !disabledRewards[r.id]);
  all.sort((a,b)=>a.pts-b.pts);

  const list = $('#rewards-list');
  list.innerHTML = '';
  all.forEach(r => {
    const unlocked = team >= r.pts;
    const div = document.createElement('div');
    div.className = 'reward-card' + (unlocked?' unlocked':'');
    div.innerHTML = `
      <div class="reward-badge">${r.pts}</div>
      <div class="reward-body">
        <div class="reward-points">${unlocked ? 'Débloqué' : 'À atteindre'}</div>
        <div class="reward-desc">${escapeHtml(r.desc)}</div>
      </div>
      ${unlocked ? '<div class="reward-check">✓</div>' : ''}
      ${isAdminUnlocked() ? `<button class="ccard-del reward-del" data-id="${r.id}" data-custom="${r.custom}">✕</button>` : ''}
    `;
    if(isAdminUnlocked()){
      div.querySelector('.reward-del').addEventListener('click', () => {
        if(r.custom){ roomRef.child('customRewards/'+r.id).remove(); }
        else { roomRef.child('disabledRewards/'+r.id).set(true); }
      });
    }
    list.appendChild(div);
  });
}

// ====== VUE CONTENU (cartes perso) ======
function setupContentView(){
  let selectedCat = 'question';
  $$('#seg-newcat .seg-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      $$('#seg-newcat .seg-btn').forEach(b=>b.classList.remove('active'));
      btn.classList.add('active');
      selectedCat = btn.dataset.cat;
    });
  });
  $('#input-card-points').addEventListener('input', (e) => {
    $('#points-display').textContent = e.target.value;
  });
  $('#form-add-card').addEventListener('submit', (e) => {
    e.preventDefault();
    const text = $('#input-card-text').value.trim();
    const pts = parseInt($('#input-card-points').value, 10);
    if(!text) return;
    const key = db.ref('rooms/'+roomCode+'/customCards').push().key;
    roomRef.child('customCards/'+key).set({ cat:selectedCat, text, pts, by: me.name });
    $('#input-card-text').value = '';
  });
}

function renderCustomCards(){
  const wrap = $('#custom-cards-list');
  wrap.innerHTML = '';

  const iconMap = { question:'💬', defi:'🔥', gage:'😈', surprise:'🎲' };
  const disabled = (state && state.disabledDefaults) || {};

  const defaults = DEFAULT_CARDS
    .filter(c => !disabled[c.id])
    .map(c => ({ ...c, custom:false }));

  const customs = [];
  if(state && state.customCards){
    Object.entries(state.customCards).forEach(([key,c]) => customs.push({...c, id:key, custom:true}));
  }
  customs.sort((a,b)=> (b.ts||0)-(a.ts||0));

  const all = defaults.concat(customs);

  if(all.length === 0){
    wrap.innerHTML = '<p class="empty-state">Plus aucune carte active. Ajoutez-en une !</p>';
    return;
  }

  all.forEach(c => {
    const row = document.createElement('div');
    row.className = 'custom-card-row';
    const adminBtns = isAdminUnlocked() ? `
      <button class="ccard-edit" data-id="${c.id}" title="Modifier">✎</button>
      <button class="ccard-del" data-id="${c.id}" title="Supprimer">✕</button>
    ` : '';
    row.innerHTML = `
      <span class="ccard-cat">${iconMap[c.cat]||'✦'}</span>
      <span class="ccard-text">${escapeHtml(c.text)}${c.custom ? '' : ' <span style=\"color:var(--muted);font-size:11px;\">· défaut</span>'}</span>
      <span class="ccard-pts">+${c.pts}</span>
      ${adminBtns}
    `;

    if(isAdminUnlocked()){
      row.querySelector('.ccard-del').addEventListener('click', () => {
        if(c.custom){
          roomRef.child('customCards/'+c.id).remove();
        } else {
          roomRef.child('disabledDefaults/'+c.id).set(true);
        }
      });

      row.querySelector('.ccard-edit').addEventListener('click', () => {
        openEditRow(row, c);
      });
    }

    wrap.appendChild(row);
  });
}

function openEditRow(row, c){
  // évite plusieurs formulaires ouverts à la fois
  const existing = document.getElementById('inline-edit-card');
  if(existing) existing.remove();

  const form = document.createElement('div');
  form.id = 'inline-edit-card';
  form.className = 'add-card-form';
  form.style.marginTop = '8px';
  form.innerHTML = `
    <textarea id="edit-text" maxlength="200" rows="3">${c.text}</textarea>
    <div class="points-row">
      <span>Points :</span>
      <input type="range" id="edit-points" min="5" max="50" step="5" value="${c.pts}">
      <span id="edit-points-display">${c.pts}</span>
    </div>
    <button class="btn-primary" id="confirm-edit">Enregistrer les modifications</button>
  `;
  row.insertAdjacentElement('afterend', form);

  $('#edit-points').addEventListener('input', e => {
    $('#edit-points-display').textContent = e.target.value;
  });

  $('#confirm-edit').addEventListener('click', () => {
    const newText = $('#edit-text').value.trim();
    const newPts = parseInt($('#edit-points').value, 10);
    if(!newText) return;

    if(c.custom){
      roomRef.child('customCards/'+c.id).update({ text:newText, pts:newPts });
    } else {
      // on désactive la carte par défaut et on la remplace par une version perso éditée
      roomRef.child('disabledDefaults/'+c.id).set(true);
      const key = db.ref('rooms/'+roomCode+'/customCards').push().key;
      roomRef.child('customCards/'+key).set({ cat:c.cat, text:newText, pts:newPts, by: me.name, ts: Date.now() });
    }
    form.remove();
  });
}

// ====== VUE HISTORIQUE ======
function renderHistory(){
  const wrap = $('#history-list');
  wrap.innerHTML = '';
  if(!state.history){
    wrap.innerHTML = '<p class="empty-state">Aucune partie jouée pour l\'instant. Lancez-vous !</p>';
    return;
  }
  const labelMap = { question:'💬 Question', defi:'🔥 Défi', gage:'😈 Gage' };
  const entries = Object.values(state.history).sort((a,b)=> b.ts-a.ts).slice(0,50);
  entries.forEach(h => {
    const row = document.createElement('div');
    row.className = 'hist-row';
    row.innerHTML = `
      <div class="hist-left">
        <span class="hist-who">${escapeHtml(h.who)}</span> — ${labelMap[h.cat]||'Carte'}<br>
        <span style="color:var(--muted); font-size:12.5px;">${escapeHtml(h.text)}</span>
      </div>
      <div class="hist-pts">${h.validated ? '+'+h.pts : '0'}</div>
    `;
    wrap.appendChild(row);
  });
}

// ====== UTIL ======
function escapeHtml(str){
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}
