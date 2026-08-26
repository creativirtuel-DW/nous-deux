// =========================================================
//  CARTES PHOTO
//  Certaines cartes demandent une photo : on la prend, elle part chez
//  l'autre, qui l'ouvre et ne la voit que PC_VUE_MS. Elle disparaît
//  ensuite de l'écran et de la carte.
//
//  Elle n'est pas détruite pour autant : elle est rangée PC_ARCHIVE_MS
//  dans `photosArchive`, consultable en dev mod seulement — de quoi
//  lever une contestation. Passé ce délai, elle est effacée pour de bon,
//  au premier lancement de l'appli qui suit.
// =========================================================
const PC_VUE_MS     = 3000;                    // durée d'affichage
const PC_ARCHIVE_MS = 12 * 60 * 60 * 1000;     // 12 h de conservation
const PC_MAX_PX     = 2000;                    // côté le plus long
const PC_QUALITE    = 0.82;

let pcTicker = null;      // décompte de l'affichage
let pcFinVue = 0;         // horodatage de fin d'affichage
let pcApresVue = null;    // ce qu'on fait quand les 3 s sont écoulées

// Compression dans le navigateur : l'original ne quitte jamais le téléphone.
function pcCompresser(file, cb){
  const reader = new FileReader();
  reader.onload = () => {
    const img = new Image();
    img.onload = () => {
      let w = img.width, h = img.height;
      if(w > h && w > PC_MAX_PX){ h = Math.round(h * PC_MAX_PX / w); w = PC_MAX_PX; }
      else if(h >= w && h > PC_MAX_PX){ w = Math.round(w * PC_MAX_PX / h); h = PC_MAX_PX; }
      const c = document.createElement('canvas');
      c.width = w; c.height = h;
      c.getContext('2d').drawImage(img, 0, 0, w, h);
      cb(c.toDataURL('image/jpeg', PC_QUALITE));
    };
    img.onerror = () => cb(null);
    img.src = reader.result;
  };
  reader.onerror = () => cb(null);
  reader.readAsDataURL(file);
}

// Ouvre l'appareil photo (ou la galerie) et rend la photo compressée.
function pcChoisirPhoto(cb){
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/*';
  input.style.display = 'none';
  input.addEventListener('change', () => {
    const f = input.files && input.files[0];
    input.remove();
    if(!f) return;
    pcCompresser(f, cb);
  });
  document.body.appendChild(input);
  input.click();
}

// Chiffre la photo si le coffre est ouvert ([[coffre.js]]), sinon l'envoie
// telle quelle : le coffre reste optionnel.
function pcProteger(dataUrl, cb){
  if(typeof coffrePret === 'function' && coffrePret()){
    coffreChiffrer(dataUrl).then(cb, () => cb(dataUrl));
    return;
  }
  cb(dataUrl);
}

function pcLire(valeur, cb, siEchec){
  if(typeof coffreEstChiffre === 'function' && coffreEstChiffre(valeur)){
    coffreDechiffrer(valeur).then(cb, siEchec || (() => {}));
    return;
  }
  cb(valeur);
}

// ---------- affichage minuté ----------
function pcStopTicker(){ if(pcTicker){ clearInterval(pcTicker); pcTicker = null; } }

// Peint la photo dans `conteneur` pendant PC_VUE_MS, puis appelle `apres`.
function pcMontrer(conteneur, valeur, apres){
  if(!conteneur) return;
  conteneur.innerHTML = '<div class="pc-vue"><div class="pc-chrono"><span id="pc-count">'
    + Math.ceil(PC_VUE_MS / 1000) + '</span><small>s</small></div>'
    + '<div class="pc-photo-wrap"><img class="pc-photo" id="pc-photo-img" alt=""></div></div>';

  pcLire(valeur,
    clair => { const el = document.getElementById('pc-photo-img'); if(el) el.src = clair; },
    () => { conteneur.innerHTML = '<p class="pd-verrou">🔒 Photo chiffrée — ouvre le coffre avec votre phrase secrète pour la voir.</p>'; });

  pcFinVue = Date.now() + PC_VUE_MS;
  pcApresVue = apres;
  pcStopTicker();
  pcTicker = setInterval(() => {
    const reste = pcFinVue - Date.now();
    const compteur = document.getElementById('pc-count');
    if(compteur) compteur.textContent = Math.max(0, Math.ceil(reste / 1000));
    if(reste <= 0){
      pcStopTicker();
      const suite = pcApresVue; pcApresVue = null;
      if(suite) suite();
    }
  }, 100);
}

// ---------- archive ----------
// Range la photo pour 12 h et la retire de là où elle était affichée.
function pcArchiver(updates, cle, photo, qui, texte){
  updates['photosArchive/' + cle] = {
    photo: photo, by: qui, text: texte || '',
    ts: Date.now(), expire: Date.now() + PC_ARCHIVE_MS
  };
}

// Purge des archives échues, au lancement de l'appli. Sans elle, une photo
// resterait indéfiniment dans la base — c'est tout ce qu'on ne veut pas.
function pcPurgerArchives(){
  if(!state || !state.photosArchive || !roomRef) return;
  const maintenant = Date.now();
  const updates = {};
  Object.entries(state.photosArchive).forEach(([cle, a]) => {
    if(!a || !a.expire || a.expire <= maintenant) updates['photosArchive/' + cle] = null;
  });
  if(Object.keys(updates).length) roomRef.update(updates);
}

function pcArchiveRestante(a){
  const reste = (a.expire || 0) - Date.now();
  if(reste <= 0) return 'expirée';
  const h = Math.floor(reste / 3600000);
  const m = Math.floor((reste % 3600000) / 60000);
  return h > 0 ? ('encore ' + h + ' h ' + String(m).padStart(2, '0')) : ('encore ' + m + ' min');
}

// ---------- vue dev mod ----------
function renderPhotosArchive(){
  const wrap = $('#photos-archive-list');
  if(!wrap) return;
  const section = $('#photos-archive-section');

  if(!isAdminUnlocked()){ if(section) section.style.display = 'none'; return; }
  if(section) section.style.display = 'block';

  const entrees = Object.entries((state && state.photosArchive) || {})
    .filter(([, a]) => a && a.expire > Date.now())
    .sort((a, b) => (b[1].ts || 0) - (a[1].ts || 0));

  if(entrees.length === 0){
    wrap.innerHTML = '<p class="empty-state">Aucune photo en attente de péremption.</p>';
    return;
  }

  wrap.innerHTML = entrees.map(([cle, a]) => `
    <div class="pc-archive-row">
      <div class="pc-archive-tete">
        <span>${escapeHtml((state.players && state.players[a.by]) || '')}</span>
        <span class="pc-archive-reste">${pcArchiveRestante(a)}</span>
      </div>
      ${a.text ? `<div class="pc-archive-texte">${escapeHtml(a.text)}</div>` : ''}
      <button class="btn-ghost" data-archive="${cle}">Revoir la photo</button>
      <div class="pc-archive-vue" id="pc-archive-${cle}"></div>
    </div>`).join('');

  wrap.querySelectorAll('[data-archive]').forEach(btn => {
    btn.addEventListener('click', () => {
      const cle = btn.dataset.archive;
      const a = state.photosArchive[cle];
      const cible = document.getElementById('pc-archive-' + cle);
      if(!a || !cible) return;
      // En dev mod, la photo reste affichée : c'est le point d'une archive.
      cible.innerHTML = '<div class="pc-photo-wrap"><img class="pc-photo" alt=""></div>';
      pcLire(a.photo,
        clair => { const img = cible.querySelector('img'); if(img) img.src = clair; },
        () => { cible.innerHTML = '<p class="pd-verrou">🔒 Photo chiffrée — coffre fermé sur cet appareil.</p>'; });
    });
  });
}
