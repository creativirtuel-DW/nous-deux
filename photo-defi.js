// =========================================================
//  DÉFI PHOTO
//  A envoie une photo + la vraie date (mois/année) + un gage secret.
//  B la voit 10 s, puis a 60 s pour deviner le mois et l'année.
//  Tolérance : 1 mois d'écart. Réussi -> +25 pts pour B.
//  Raté -> B choisit : -25 pts (récupérés par A) ou le gage (0 pt, gage révélé).
//  La photo est effacée de la base dès la fin des 10 s.
// =========================================================
const PD_VIEW_MS   = 10000;
const PD_ANSWER_MS = 60000;
const PD_POINTS    = 25;
const PD_GAGE_MS   = 24 * 60 * 60 * 1000;   // délai pour valider le gage
const PD_MONTHS = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];

let photoActive = false;
let pdTicker = null;   // interval des chronos
let pdLastSig = '';    // signature du dernier rendu : on ne reconstruit pas le DOM à chaque tick
let pdBusy = false;    // garde-fou contre les doubles transitions
let pdDraftUrl = null; // photo compressée en attente d'envoi

function openPhoto(){ photoActive = true; render(); }
function closePhoto(){ photoActive = false; stopPdTicker(); render(); }

function pdRef(){ return roomRef.child('photoDefi'); }
function pdGet(){ return (state && state.photoDefi) || null; }
function pdLabel(m, y){ return PD_MONTHS[m] + ' ' + y; }

function startPdTicker(){ if(!pdTicker) pdTicker = setInterval(pdTick, 250); }
function stopPdTicker(){ if(pdTicker){ clearInterval(pdTicker); pdTicker = null; } }

// Compression dans le navigateur : l'original ne quitte jamais le téléphone.
function pdCompress(file, cb){
  const reader = new FileReader();
  reader.onload = () => {
    const img = new Image();
    img.onload = () => {
      const MAX = 1000;
      let w = img.width, h = img.height;
      if(w > h && w > MAX){ h = Math.round(h * MAX / w); w = MAX; }
      else if(h >= w && h > MAX){ w = Math.round(w * MAX / h); h = MAX; }
      const c = document.createElement('canvas');
      c.width = w; c.height = h;
      c.getContext('2d').drawImage(img, 0, 0, w, h);
      cb(c.toDataURL('image/jpeg', 0.7));
    };
    img.onerror = () => cb(null);
    img.src = reader.result;
  };
  reader.onerror = () => cb(null);
  reader.readAsDataURL(file);
}

function pdEcartMois(a, b){
  return Math.abs((a.year * 12 + a.month) - (b.year * 12 + b.month));
}

function pdSend(dataUrl, month, year, gage){
  pdRef().set({
    by: me.id, photo: dataUrl, month: month, year: year,
    gage: gage, status: 'sent', ts: Date.now()
  });
}

function pdCancel(){
  const d = pdGet();
  if(!d || d.by !== me.id || d.status !== 'sent') return;
  pdRef().remove();
}

function pdStartViewing(){
  const d = pdGet();
  if(!d || d.by === me.id || d.status !== 'sent') return;
  pdRef().update({ status: 'viewing', viewStart: Date.now() });
}

// Fin des 10 s : la photo est retirée de la base tout de suite.
function pdEndViewing(){
  const d = pdGet();
  if(!d || d.by === me.id || d.status !== 'viewing') return;
  pdRef().update({ status: 'answering', answerStart: Date.now(), photo: null });
}

function pdSubmit(month, year){
  const d = pdGet();
  if(!d || d.by === me.id || d.status !== 'answering') return;
  const ok = (month !== null) && pdEcartMois({month: month, year: year}, {month: d.month, year: d.year}) <= 1;

  if(ok){
    const updates = {};
    updates['scores/' + me.id] = (state.scores[me.id] || 0) + PD_POINTS;
    updates['photoDefi'] = null;
    const hk = db.ref('rooms/' + roomCode + '/history').push().key;
    updates['history/' + hk] = {
      who: me.name, cat: 'photo', text: 'Défi Photo — ' + pdLabel(d.month, d.year),
      answer: month === null ? 'Pas de réponse' : pdLabel(month, year),
      pts: PD_POINTS, validated: true, ts: Date.now()
    };
    roomRef.update(updates);
  }else{
    pdRef().update({
      status: 'lost', photo: null,
      answer: month === null ? null : { month: month, year: year }
    });
  }
}

// Perdu, option 1 : B paie en points, A les récupère. Le gage reste secret.
function pdChoosePoints(){
  const d = pdGet();
  if(!d || d.by === me.id || d.status !== 'lost') return;
  const updates = {};
  updates['scores/' + me.id] = (state.scores[me.id] || 0) - PD_POINTS;
  updates['scores/' + d.by]  = (state.scores[d.by]  || 0) + PD_POINTS;
  updates['photoDefi'] = null;
  const hk = db.ref('rooms/' + roomCode + '/history').push().key;
  updates['history/' + hk] = {
    who: me.name, cat: 'photo', text: 'Défi Photo — ' + pdLabel(d.month, d.year),
    answer: d.answer ? pdLabel(d.answer.month, d.answer.year) : 'Pas de réponse',
    comment: 'A choisi de perdre ' + PD_POINTS + ' points',
    pts: -PD_POINTS, validated: false, ts: Date.now()
  };
  roomRef.update(updates);
}

// Perdu, option 2 : le gage devient une carte à réaliser. Aucun point ne bouge.
function pdChooseGage(){
  const d = pdGet();
  if(!d || d.by === me.id || d.status !== 'lost') return;
  const updates = {};
  const ck = db.ref('rooms/' + roomCode + '/pendingCards').push().key;
  updates['pendingCards/' + ck] = {
    by: me.id, cat: 'gage', text: '🎯 Gage du Défi Photo : ' + d.gage,
    pts: 0, status: 'drafting', answer: '', ts: Date.now(),
    pdGage: { author: d.by, deadline: Date.now() + PD_GAGE_MS }
  };
  updates['photoDefi'] = null;
  const hk = db.ref('rooms/' + roomCode + '/history').push().key;
  updates['history/' + hk] = {
    who: me.name, cat: 'photo', text: 'Défi Photo — ' + pdLabel(d.month, d.year),
    answer: d.answer ? pdLabel(d.answer.month, d.answer.year) : 'Pas de réponse',
    comment: 'A choisi le gage', pts: 0, validated: false, ts: Date.now()
  };
  roomRef.update(updates);
}

function pdSelects(prefix, defM, defY){
  const yMax = new Date().getFullYear();
  let mo = '';
  for(let i = 0; i < 12; i++) mo += '<option value="' + i + '"' + (i === defM ? ' selected' : '') + '>' + PD_MONTHS[i] + '</option>';
  let yo = '';
  for(let y = yMax; y >= 2005; y--) yo += '<option value="' + y + '"' + (y === defY ? ' selected' : '') + '>' + y + '</option>';
  return '<div class="pd-selects"><select id="' + prefix + '-month">' + mo + '</select>'
       + '<select id="' + prefix + '-year">' + yo + '</select></div>';
}

// ---------- RENDU ----------
function renderPhotoDefi(){
  const panel = $('#photo-panel');
  if(!panel) return;
  if(!photoActive){ panel.style.display = 'none'; stopPdTicker(); return; }
  panel.style.display = 'flex';

  const body = $('#photo-body');
  const d = pdGet();
  const partnerName = state.players[partnerId] || 'ton/ta partenaire';

  // On ne reconstruit le DOM que si l'état change vraiment, sinon le texte du gage
  // et les menus déroulants seraient effacés à chaque tick du chrono.
  const sig = d ? [d.by, d.status, d.viewStart || 0, d.answerStart || 0].join('|') : 'none';
  const changed = sig !== pdLastSig;
  pdLastSig = sig;

  // ---------- AUCUN DÉFI EN COURS : formulaire d'envoi ----------
  if(!d){
    stopPdTicker();
    if(!changed && $('#pd-file')) return;
    const now = new Date();
    body.innerHTML = ''
      + '<div class="jds-intro">'
      +   '<span class="jds-emoji">📸</span>'
      +   '<h3 class="jds-title">Défi Photo</h3>'
      +   '<p class="jds-sub">Envoie une photo à ' + escapeHtml(partnerName) + '. Elle s\'affichera <strong>10 secondes</strong>, puis il/elle aura <strong>1 minute</strong> pour deviner le mois et l\'année.</p>'
      + '</div>'
      + '<div class="jds-card">'
      +   '<span class="jds-label">1 · La photo</span>'
      +   '<input type="file" id="pd-file" accept="image/*" style="display:none;">'
      +   '<button class="jds-masked" id="pd-pick"><span class="jds-masked-dots">＋</span><span class="jds-masked-hint" id="pd-pick-label">Choisir une photo</span></button>'
      +   '<div id="pd-preview" class="pd-preview" style="display:none;"><img id="pd-preview-img" alt=""></div>'
      +   '<span class="jds-label" style="margin-top:18px;">2 · La vraie date</span>'
      +   pdSelects('pd', now.getMonth(), now.getFullYear())
      +   '<p class="pd-note">Une erreur d\'un mois sera acceptée.</p>'
      +   '<div class="pd-stakes">'
      +     '<span class="jds-label" style="margin-bottom:10px;">Les enjeux</span>'
      +     '<div class="pd-stake"><span class="pd-stake-ic">✅</span><span>' + escapeHtml(partnerName) + ' <strong>trouve</strong> : il/elle me prend <strong>' + PD_POINTS + ' points</strong>.</span></div>'
      +     '<div class="pd-stake"><span class="pd-stake-ic">❌</span><span>' + escapeHtml(partnerName) + ' <strong>se trompe</strong> : soit je lui prends <strong>' + PD_POINTS + ' points</strong>, soit je gagne <strong>mon gage</strong> ci-dessous — c\'est lui/elle qui choisit.</span></div>'
      +   '</div>'
      +   '<span class="jds-label" style="margin-top:18px;">3 · Le gage secret</span>'
      +   '<textarea id="pd-gage" class="jds-gain-input" rows="2" maxlength="200" placeholder="Ex : tu me masses les épaules 10 minutes"></textarea>'
      +   '<p class="pd-note">🔒 Ce gage restera <strong>totalement invisible</strong> pour ' + escapeHtml(partnerName) + '. Il ne sera révélé que s\'il/elle perd <em>et</em> choisit le gage plutôt que les points.</p>'
      +   '<p class="pd-note">⏳ Si tu gagnes un gage, tu auras <strong>24 h</strong> pour le valider comme réalisé. Passé ce délai il s\'annule et tu récupères les ' + PD_POINTS + ' points à la place.</p>'
      + '</div>'
      + '<button class="btn-primary" id="pd-send">Envoyer le défi</button>'
      + '<p class="error" id="pd-error"></p>';

    $('#pd-pick').addEventListener('click', () => $('#pd-file').click());
    $('#pd-file').addEventListener('change', e => {
      const f = e.target.files && e.target.files[0];
      if(!f) return;
      $('#pd-pick-label').textContent = 'Compression…';
      pdCompress(f, url => {
        if(!url){ $('#pd-pick-label').textContent = 'Photo illisible, réessaie'; return; }
        pdDraftUrl = url;
        $('#pd-pick-label').textContent = 'Changer de photo';
        $('#pd-preview').style.display = 'block';
        $('#pd-preview-img').src = url;
      });
    });
    $('#pd-send').addEventListener('click', () => {
      const gage = $('#pd-gage').value.trim();
      if(!pdDraftUrl){ $('#pd-error').textContent = 'Choisis d\'abord une photo.'; return; }
      if(!gage){ $('#pd-error').textContent = 'Écris le gage secret.'; return; }
      pdSend(pdDraftUrl, parseInt($('#pd-month').value, 10), parseInt($('#pd-year').value, 10), gage);
      pdDraftUrl = null;
    });
    return;
  }

  const senderName = state.players[d.by] || '';

  // ---------- CÔTÉ ENVOYEUR ----------
  if(d.by === me.id){
    stopPdTicker();
    if(!changed) return;
    let txt;
    if(d.status === 'sent')            txt = escapeHtml(partnerName) + ' n\'a pas encore lancé le défi.';
    else if(d.status === 'viewing')    txt = escapeHtml(partnerName) + ' est en train de regarder la photo…';
    else if(d.status === 'answering')  txt = escapeHtml(partnerName) + ' cherche la date…';
    else                               txt = escapeHtml(partnerName) + ' s\'est trompé·e et choisit sa sanction…';
    body.innerHTML = ''
      + '<div class="jds-intro"><span class="jds-emoji">📸</span><h3 class="jds-title">Défi envoyé</h3><p class="jds-sub">' + txt + '</p></div>'
      + '<div class="jds-card"><span class="jds-label">La bonne réponse</span><div class="jds-winner-gain">' + pdLabel(d.month, d.year) + '</div></div>'
      + (d.status === 'sent' ? '<button class="btn-ghost danger-btn" id="pd-cancel">Annuler le défi</button>' : '');
    const c = $('#pd-cancel');
    if(c) c.addEventListener('click', pdCancel);
    return;
  }

  // ---------- CÔTÉ DEVINEUR ----------
  if(d.status === 'sent'){
    stopPdTicker();
    if(!changed) return;
    body.innerHTML = ''
      + '<div class="jds-intro"><span class="jds-emoji">📸</span><h3 class="jds-title">Défi Photo</h3>'
      +   '<p class="jds-sub">' + escapeHtml(senderName) + ' t\'a envoyé une photo. Tu l\'auras sous les yeux <strong>10 secondes</strong>, puis <strong>1 minute</strong> pour dire de quel mois et de quelle année elle date.</p></div>'
      + '<div class="jds-locked"><div class="jds-lock-icon">🕐</div><h4>Prêt·e ?</h4><p>Le chrono démarre dès que tu appuies.</p></div>'
      + '<button class="btn-primary" id="pd-ready">Je suis prêt·e — lancer les 10 s</button>';
    $('#pd-ready').addEventListener('click', pdStartViewing);
    return;
  }

  if(d.status === 'viewing'){
    startPdTicker();
    if(changed){
      body.innerHTML = ''
        + '<div class="pd-stage">'
        +   '<div class="pd-chrono pd-chrono-view"><span id="pd-count">10</span><small>s</small></div>'
        +   '<div class="pd-photo-wrap"><img class="pd-photo" src="' + (d.photo || '') + '" alt=""></div>'
        + '</div>'
        + '<p class="jds-status">Mémorise bien… <strong>quel mois, quelle année ?</strong></p>';
    }
    return;
  }

  if(d.status === 'answering'){
    startPdTicker();
    if(changed){
      const now = new Date();
      body.innerHTML = ''
        + '<div class="pd-stage">'
        +   '<div class="pd-chrono pd-chrono-answer"><span id="pd-count">60</span><small>s</small></div>'
        +   '<div class="pd-gone"><span class="pd-gone-ic">💨</span><p>La photo a disparu.<br>De quand date-t-elle ?</p></div>'
        + '</div>'
        + '<div class="jds-card">' + pdSelects('pda', now.getMonth(), now.getFullYear()) + '</div>'
        + '<button class="btn-primary" id="pd-answer">Valider ma réponse</button>';
      $('#pd-answer').addEventListener('click', () => {
        pdSubmit(parseInt($('#pda-month').value, 10), parseInt($('#pda-year').value, 10));
      });
    }
    return;
  }

  if(d.status === 'lost'){
    stopPdTicker();
    if(!changed) return;
    body.innerHTML = ''
      + '<div class="jds-winner pd-lost"><div class="jds-lock-icon">💔</div><div class="jds-winner-name">Perdu !</div>'
      +   '<p class="jds-sub" style="margin-top:10px;">Ta réponse : <strong>' + (d.answer ? pdLabel(d.answer.month, d.answer.year) : 'aucune (temps écoulé)') + '</strong><br>'
      +   'La bonne date : <strong>' + pdLabel(d.month, d.year) + '</strong></p></div>'
      + '<p class="jds-status">À toi de choisir ta sanction.</p>'
      + '<div class="pd-choices">'
      +   '<button class="pd-choice" id="pd-pts"><span class="pd-choice-ic">➖</span><span class="pd-choice-t">Perdre ' + PD_POINTS + ' points</span>'
      +     '<span class="pd-choice-s">' + escapeHtml(senderName) + ' les récupère. Le gage reste secret à jamais.</span></button>'
      +   '<button class="pd-choice" id="pd-gg"><span class="pd-choice-ic">🎯</span><span class="pd-choice-t">Accepter le gage</span>'
      +     '<span class="pd-choice-s">Aucun point perdu, mais tu découvres le gage… et tu l\'assumes.</span></button>'
      + '</div>';
    $('#pd-pts').addEventListener('click', pdChoosePoints);
    $('#pd-gg').addEventListener('click', pdChooseGage);
    return;
  }
}

// Chronos. Seul le devineur fait avancer les états, l'envoyeur ne fait que suivre.
function pdTick(){
  const d = pdGet();
  if(!photoActive || !d || d.by === me.id){ stopPdTicker(); return; }
  const el = $('#pd-count');

  if(d.status === 'viewing'){
    const left = PD_VIEW_MS - (Date.now() - (d.viewStart || Date.now()));
    if(el) el.textContent = Math.max(0, Math.ceil(left / 1000));
    if(left <= 0 && !pdBusy){ pdBusy = true; pdEndViewing(); setTimeout(() => { pdBusy = false; }, 800); }
    return;
  }
  if(d.status === 'answering'){
    const left = PD_ANSWER_MS - (Date.now() - (d.answerStart || Date.now()));
    if(el){
      el.textContent = Math.max(0, Math.ceil(left / 1000));
      if(left <= 10000) el.parentElement.classList.add('pd-urgent');
    }
    if(left <= 0 && !pdBusy){ pdBusy = true; pdSubmit(null, null); setTimeout(() => { pdBusy = false; }, 800); }
    return;
  }
  stopPdTicker();
}

// ---------- DÉLAI DE 24 H SUR LE GAGE ----------
// Si l'auteur du gage ne l'a pas validé comme réalisé dans les 24 h, le gage
// s'annule et on bascule automatiquement sur le transfert de points.
function pdGageDeadlineLabel(ts){
  const d = new Date(ts);
  return String(d.getDate()).padStart(2,'0') + '/' + String(d.getMonth()+1).padStart(2,'0')
       + ' à ' + String(d.getHours()).padStart(2,'0') + 'h' + String(d.getMinutes()).padStart(2,'0');
}

function pdGageRestant(ts){
  const left = ts - Date.now();
  if(left <= 0) return 'délai dépassé';
  const h = Math.floor(left / 3600000);
  if(h >= 1) return 'encore ' + h + ' h';
  return 'encore ' + Math.max(1, Math.ceil(left / 60000)) + ' min';
}

// Bascule gage -> points. La transaction garantit qu'un seul des deux téléphones
// applique le transfert, même si les deux sont connectés au même moment.
function pdGageFallback(key, card, raison){
  const loser  = card.by;
  const author = card.pdGage.author;
  let claimed = false;
  roomRef.child('pendingCards/' + key).transaction(cur => {
    claimed = (cur !== null);
    if(cur === null) return;            // déjà traité par l'autre appareil
    return null;
  }).then(res => {
    if(!res.committed || !claimed) return;
    const updates = {};
    updates['scores/' + loser]  = (state.scores[loser]  || 0) - PD_POINTS;
    updates['scores/' + author] = (state.scores[author] || 0) + PD_POINTS;
    const hk = db.ref('rooms/' + roomCode + '/history').push().key;
    updates['history/' + hk] = {
      who: state.players[loser] || '', cat: 'photo', text: card.text,
      comment: raison || 'Gage non validé sous 24 h — bascule automatique sur les points',
      pts: -PD_POINTS, validated: false, ts: Date.now()
    };
    roomRef.update(updates);
  }).catch(() => {});
}

// Appelé à chaque rendu : purge les gages dont le délai est écoulé.
function pdCheckGageDeadline(){
  if(!state || !state.pendingCards) return;
  Object.entries(state.pendingCards).forEach(([key, c]) => {
    if(c && c.pdGage && c.pdGage.deadline <= Date.now()) pdGageFallback(key, c);
  });
}
