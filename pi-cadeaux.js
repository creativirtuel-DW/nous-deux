/**
 * Nous Deux — Plaisirs Intimes : compteur de points et cartes cadeau (25/11/2026)
 * ===============================================================================
 * Compteur PROPRE au jeu (ne s'ajoute pas au score général) :
 *   rooms/$room/plaisirsPoints/<pid>
 *   · question « synchro » : +10 chacun si même réponse, −5 chacun sinon (jamais sous 0) ;
 *   · défi validé : +20 pour celui/celle qui l'a relevé.
 * Tous les 150 points : une CARTE CADEAU (cinématique de révélation).
 *   rooms/$room/plaisirsPaliers/<pid>   = nombre de paliers déjà récompensés
 *   rooms/$room/plaisirsCadeaux/<clé>   = { gagnant, pour, statut, type, detail, photo, ts… }
 *     statut : 'dispo' (dans ma main) → 'envoyee' (offerte à l'autre, qui doit honorer)
 *              → 'photo' (l'autre a envoyé sa photo, à ouvrir 3 s) → 'honoree'.
 *     type : 'photo' (une photo HOT) | 'massage' | 'fantasme' | 'autre' (detail = texte libre).
 */
const PI_PALIER = 150;
const PI_FAVEURS = {
  photo:    { ic: '📸', nom: 'Une photo HOT' },
  massage:  { ic: '💆', nom: 'Un massage' },
  fantasme: { ic: '🔥', nom: 'Un fantasme « simple »' },
  autre:    { ic: '✨', nom: 'Une faveur au choix' }
};

function piPoints(pid){ return (state && state.plaisirsPoints && state.plaisirsPoints[pid]) || 0; }
function piAjouterPoints(pid, delta){
  if(!roomRef || !pid || !delta) return;
  roomRef.child('plaisirsPoints/' + pid).transaction(v => Math.max(0, (v || 0) + delta));
}

// ---------- paliers : une carte cadeau tous les 150 points ----------
let piCadeauAnimEnCours = false;
function piVerifierPaliers(){
  if(!state || !me || !me.id || !roomRef || piCadeauAnimEnCours) return;
  const palier = Math.floor(piPoints(me.id) / PI_PALIER);
  const vus = (state.plaisirsPaliers && state.plaisirsPaliers[me.id]) || 0;
  if(palier <= vus) return;
  piCadeauAnimEnCours = true;
  // Transaction : un seul téléphone/onglet attribue la carte, même en double ouverture.
  roomRef.child('plaisirsPaliers/' + me.id).transaction(v => (v || 0) < palier ? palier : undefined).then(res => {
    if(!res || !res.committed){ piCadeauAnimEnCours = false; return; }
    const nb = palier - vus;
    for(let i = 0; i < nb; i++){
      roomRef.child('plaisirsCadeaux').push({ gagnant: me.id, pour: piAutreId(), statut: 'dispo', ts: Date.now() });
    }
    piCadeauCinematique(nb, () => { piCadeauAnimEnCours = false; });
  }, () => { piCadeauAnimEnCours = false; });
}

// Cinématique : une carte dorée se retourne, entourée de cœurs et d'éclats.
function piCadeauCinematique(nb, suite){
  const el = document.createElement('div');
  el.id = 'pi-cadeau-anim';
  let eclats = '';
  for(let i = 0; i < 18; i++){
    eclats += '<span class="pca-eclat" style="--a:' + (i * 20) + 'deg;--d:' + (90 + Math.random() * 70).toFixed(0) + 'px;animation-delay:' + (1.1 + Math.random() * .3).toFixed(2) + 's">' + (i % 3 ? '✦' : '❤') + '</span>';
  }
  el.innerHTML = '<div class="pca-scene">' + eclats
    + '<div class="pca-carte"><div class="pca-face pca-dos">🔥</div>'
    + '<div class="pca-face pca-recto"><div class="pca-ic">🎁</div><b>Carte cadeau</b><small>Plaisirs Intimes</small></div></div></div>'
    + '<div class="pca-texte"><h2>' + (nb > 1 ? nb + ' cartes cadeau gagnées !' : 'Carte cadeau gagnée !') + '</h2>'
    + '<p>Tu as atteint ' + (Math.floor(piPoints(me.id) / PI_PALIER) * PI_PALIER) + ' points. Envoie cette carte à <b>' + escapeHtml(piNomAutre()) + '</b> : '
    + 'en retour, tu recevras <b>une photo HOT</b> ou <b>une faveur de ton choix</b> (massage, fantasme « simple »…).</p>'
    + '<button type="button" class="btn-primary" data-pca-ok>Super ! 🔥</button></div>';
  document.body.appendChild(el);
  el.querySelector('[data-pca-ok]').onclick = () => { el.classList.add('pca-sortie'); setTimeout(() => { el.remove(); if(suite) suite(); render(); }, 350); };
}

// ---------- écran du jeu ----------
function piCadeaux(){ return Object.entries((state && state.plaisirsCadeaux) || {}).map(([k, c]) => Object.assign({ k }, c)); }

function piBlocCompteur(){
  const pts = piPoints(me.id);
  const dans = pts % PI_PALIER;
  return '<div class="pi-compteur"><div class="pi-compteur-haut"><span>🔥 <b>' + pts + '</b> pts Plaisirs</span>'
    + '<small>' + (PI_PALIER - dans) + ' pts avant la prochaine carte cadeau 🎁</small></div>'
    + '<div class="pi-jauge"><i style="width:' + Math.round(dans / PI_PALIER * 100) + '%"></i></div></div>';
}

function piBlocCadeaux(){
  const tous = piCadeaux();
  const nom = escapeHtml(piNomAutre());
  const miens = tous.filter(c => c.gagnant === me.id && c.statut === 'dispo');
  const attente = tous.filter(c => c.gagnant === me.id && c.statut === 'envoyee');
  const photoRecue = tous.filter(c => c.gagnant === me.id && c.statut === 'photo');
  const aHonorer = tous.filter(c => c.pour === me.id && c.statut === 'envoyee');
  const desc = c => { const f = PI_FAVEURS[c.type] || PI_FAVEURS.autre; return f.ic + ' ' + (c.type === 'autre' && c.detail ? escapeHtml(c.detail) : f.nom); };
  let h = '';
  if(aHonorer.length){
    h += '<section class="pi-valider pi-cadeaux"><h3>🎁 ' + nom + ' t’offre sa carte cadeau</h3>'
      + aHonorer.map(c => '<div class="pi-rep"><div class="pi-rep-q">Tu lui dois : <b>' + desc(c) + '</b></div>'
        + (c.type === 'photo'
          ? '<button type="button" class="pi-btn" data-pca-photo="' + c.k + '">📸 Envoyer ma photo HOT</button>'
          : '<button type="button" class="pi-btn" data-pca-honorer="' + c.k + '">✓ Faveur accordée</button>') + '</div>').join('')
      + '</section>';
  }
  if(photoRecue.length){
    h += '<section class="pi-valider pi-cadeaux"><h3>📸 ' + nom + ' t’a envoyé ta photo cadeau</h3>'
      + photoRecue.map(c => '<div class="pi-rep"><div class="pc-ouvrir-zone" data-pca-zone="' + c.k + '"><button type="button" class="pi-btn" data-pca-ouvrir="' + c.k + '">📸 Ouvrir la photo (' + Math.round(PC_VUE_MS / 1000) + ' s)</button><p class="pc-note">Une seule fois : elle disparaît ensuite.</p></div></div>').join('')
      + '</section>';
  }
  if(miens.length || attente.length){
    h += '<section class="pi-valider pi-cadeaux"><h3>🎁 Mes cartes cadeau</h3>'
      + miens.map(c => '<div class="pi-rep pi-cadeau-carte"><div class="pi-rep-q">🎁 Carte cadeau à offrir</div>'
        + '<button type="button" class="pi-btn" data-pca-envoyer="' + c.k + '">Envoyer à ' + nom + '</button></div>').join('')
      + attente.map(c => '<div class="pi-rep"><div class="pi-rep-q">⏳ Envoyée à ' + nom + ' : ' + desc(c) + '</div></div>').join('')
      + '</section>';
  }
  return h;
}

// Choix de la faveur au moment d'envoyer la carte.
function piCadeauEnvoyer(k){
  const el = document.createElement('div');
  el.className = 'env-voile secret-voile';
  el.innerHTML = '<div class="env-pop pi-pop"><div class="env-pop-ic">🎁</div><h2>Ta carte cadeau</h2>'
    + '<p>Que veux-tu recevoir de ' + escapeHtml(piNomAutre()) + ' ?</p>'
    + Object.entries(PI_FAVEURS).map(([t, f]) => '<button type="button" class="pi-btn pca-choix" data-pca-type="' + t + '">' + f.ic + ' ' + f.nom + '</button>').join('')
    + '<textarea class="pi-champ pca-detail" rows="2" maxlength="200" placeholder="Précise ta faveur (pour « Une faveur au choix »)…" style="display:none"></textarea>'
    + '<button type="button" class="btn-primary pca-valider" style="display:none">Envoyer la carte</button>'
    + '<button type="button" class="btn-ghost" data-pca-annuler>Annuler</button></div>';
  document.body.appendChild(el);
  let type = null;
  const detail = el.querySelector('.pca-detail'), valider = el.querySelector('.pca-valider');
  el.querySelectorAll('[data-pca-type]').forEach(b => b.onclick = () => {
    type = b.dataset.pcaType;
    el.querySelectorAll('[data-pca-type]').forEach(x => x.classList.toggle('sel', x === b));
    detail.style.display = type === 'autre' ? '' : 'none';
    valider.style.display = '';
  });
  valider.onclick = () => {
    if(!type) return;
    if(type === 'autre' && !detail.value.trim()){ detail.focus(); return; }
    roomRef.child('plaisirsCadeaux/' + k).update({ statut: 'envoyee', type, detail: type === 'autre' ? detail.value.trim() : null, tsEnvoi: Date.now() });
    const f = PI_FAVEURS[type];
    if(typeof notifyPartner === 'function')
      notifyPartner('🎁 ' + me.name + ' t’offre sa carte cadeau', 'Tu lui dois : ' + (type === 'autre' ? detail.value.trim() : f.nom) + ' 🔥', 'plaisirs');
    el.remove();
  };
  el.querySelector('[data-pca-annuler]').onclick = () => el.remove();
}

// Branche les boutons des cartes cadeau (appelé par piDessiner).
function piBrancherCadeaux(c){
  c.querySelectorAll('[data-pca-envoyer]').forEach(b => b.onclick = () => piCadeauEnvoyer(b.dataset.pcaEnvoyer));
  c.querySelectorAll('[data-pca-honorer]').forEach(b => b.onclick = () => {
    const k = b.dataset.pcaHonorer, cad = (state.plaisirsCadeaux || {})[k];
    if(!cad || !confirm('Confirmer que tu as accordé cette faveur ?')) return;
    roomRef.child('plaisirsCadeaux/' + k).update({ statut: 'honoree', tsHonore: Date.now() });
    if(typeof notifyPartner === 'function') notifyPartner('🎁 Faveur accordée', me.name + ' a honoré ta carte cadeau 💞', 'plaisirs');
  });
  c.querySelectorAll('[data-pca-photo]').forEach(b => b.onclick = () => {
    const k = b.dataset.pcaPhoto;
    pcChoisirPhoto(dataUrl => {
      if(!dataUrl) return;
      b.disabled = true; b.textContent = 'Envoi…';
      pcProteger(dataUrl, protegee => {
        roomRef.child('plaisirsCadeaux/' + k).update({ statut: 'photo', photo: protegee, tsPhoto: Date.now() });
        if(typeof notifyPartner === 'function')
          notifyPartner('📸 Ta photo cadeau est arrivée', me.name + ' t’a envoyé ta photo HOT : tu ne la verras que ' + Math.round(PC_VUE_MS / 1000) + ' secondes !', 'plaisirs');
      });
    });
  });
  c.querySelectorAll('[data-pca-ouvrir]').forEach(b => b.onclick = () => {
    const k = b.dataset.pcaOuvrir, cad = (state.plaisirsCadeaux || {})[k];
    const zone = c.querySelector('[data-pca-zone="' + k + '"]');
    if(!cad || !cad.photo || !zone) return;
    piPhotoEnVue = true;
    pcMontrer(zone, cad.photo, () => {
      piPhotoEnVue = false;
      const maj = {};
      maj['plaisirsCadeaux/' + k + '/photo'] = null;
      maj['plaisirsCadeaux/' + k + '/statut'] = 'honoree';
      maj['plaisirsCadeaux/' + k + '/tsHonore'] = Date.now();
      pcArchiver(maj, 'cadeau-' + k, cad.photo, cad.pour, 'Carte cadeau Plaisirs Intimes');
      roomRef.update(maj);
    });
  });
}
