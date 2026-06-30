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

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

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
        turn: 'p1',
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

  // Tour
  const myTurn = state.turn === me.id;
  $('#turn-banner').textContent = myTurn ? "✦ À toi de piocher une carte" : `En attente de ${state.players[state.turn] || 'ton/ta partenaire'}…`;
  $$('.cat-btn').forEach(b => b.classList.toggle('disabled', !myTurn || !!currentDrawnCard));

  renderRewards();
  renderHistory();
  renderCustomCards();
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
  $('#btn-validate').addEventListener('click', () => resolveCard(true));
  $('#btn-skip').addEventListener('click', () => resolveCard(false));
}

function getAllCardsForCategory(cat){
  const customForCat = [];
  if(state && state.customCards){
    Object.values(state.customCards).forEach(c => {
      if(c.cat === cat) customForCat.push(c);
    });
  }
  const defaults = DEFAULT_CARDS.filter(c => c.cat === cat);
  if(cat === 'surprise'){
    // mélange de tout
    return DEFAULT_CARDS.concat(customForCat);
  }
  return defaults.concat(customForCat);
}

function drawCard(cat){
  const pool = getAllCardsForCategory(cat);
  if(pool.length === 0) return;
  const card = pool[Math.floor(Math.random()*pool.length)];
  currentDrawnCard = card;
  currentCardCategory = cat === 'surprise' ? card.cat : cat;

  const labelMap = { question:'Question', defi:'Défi', gage:'Gage' };
  $('#card-cat').textContent = labelMap[currentCardCategory] || 'Carte';
  $('#card-text').textContent = card.text;
  $('#card-points').textContent = '+' + card.pts;

  const card3d = $('#card3d');
  card3d.classList.remove('flipped');
  // force reflow puis flip
  void card3d.offsetWidth;
  setTimeout(()=> card3d.classList.add('flipped'), 60);

  $('#cat-picker').style.display = 'none';
  $('#resolve-actions').classList.add('active');
  $$('.cat-btn').forEach(b => b.classList.add('disabled'));
}

function resolveCard(validated){
  if(!currentDrawnCard) return;
  const pts = validated ? currentDrawnCard.pts : 0;

  const updates = {};
  updates['scores/' + me.id] = (state.scores[me.id]||0) + pts;
  updates['turn'] = partnerId;

  const histKey = db.ref('rooms/'+roomCode+'/history').push().key;
  updates['history/' + histKey] = {
    who: me.name,
    cat: currentCardCategory,
    text: currentDrawnCard.text,
    pts: pts,
    validated: validated,
    ts: Date.now()
  };

  roomRef.update(updates);

  // reset visuel
  currentDrawnCard = null; currentCardCategory = null;
  $('#card3d').classList.remove('flipped');
  $('#resolve-actions').classList.remove('active');
  $('#cat-picker').style.display = 'grid';
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

  let all = DEFAULT_REWARDS.map(r => ({...r}));
  if(state.customRewards){
    Object.entries(state.customRewards).forEach(([key,r]) => all.push({...r, custom:true, key}));
  }
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
    `;
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
  if(!state.customCards){
    wrap.innerHTML = '<p class="empty-state">Aucune carte perso pour l\'instant.</p>';
    return;
  }
  const iconMap = { question:'💬', defi:'🔥', gage:'😈' };
  const entries = Object.entries(state.customCards).sort((a,b)=> (b[1].ts||0)-(a[1].ts||0));
  entries.forEach(([key, c]) => {
    const row = document.createElement('div');
    row.className = 'custom-card-row';
    row.innerHTML = `
      <span class="ccard-cat">${iconMap[c.cat]||'✦'}</span>
      <span class="ccard-text">${escapeHtml(c.text)}</span>
      <span class="ccard-pts">+${c.pts}</span>
      <button class="ccard-del" data-key="${key}">✕</button>
    `;
    row.querySelector('.ccard-del').addEventListener('click', () => {
      roomRef.child('customCards/'+key).remove();
    });
    wrap.appendChild(row);
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
