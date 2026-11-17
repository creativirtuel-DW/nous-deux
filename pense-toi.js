/**
 * Nous Deux — « Je pense à toi »
 * ==============================
 * Case de l'accueil, sous le bouton « Jouer ». Elle ouvre une page plein
 * écran où l'on écrit un petit mot et où l'on peut joindre une photo prise
 * EN DIRECT (appareil photo uniquement : pas d'accès à la galerie).
 *
 * Chez le partenaire, la pensée s'ouvre en plein écran. La photo ne s'affiche
 * que PT_VUE_MS (5 s), puis elle est supprimée de la base pour de bon.
 *
 * Base : rooms/$room/pensees/<clé> = { by, nom, texte, photo, ts }
 * La pensée entière est effacée une fois lue (et sa photo vue, s'il y en a une).
 * La photo est chiffrée si le coffre est ouvert (pcProteger, photo-carte.js).
 */

const PT_VUE_MS = 5000;

let ptEnvoiOuvert = false;   // page d'écriture ouverte
let ptPhoto = null;          // photo prise (dataURL compressée), pas encore envoyée
let ptEnvoiEnCours = false;
let ptRecueCle = null;       // pensée reçue affichée en plein écran
let ptRecueMasquee = {};     // pensées refermées sans voir la photo (le temps de la session)
let ptVueEnCours = false;    // la photo est en train de s'afficher

function ptAutreId(){ return me && me.id === 'p1' ? 'p2' : 'p1'; }
function ptNomAutre(){ return (state && state.players && state.players[ptAutreId()]) || 'ton/ta partenaire'; }

// Pensées que l'autre m'a envoyées et qui attendent encore d'être lues.
function ptRecues(){
  const p = (state && state.pensees) || {};
  return Object.entries(p).filter(([k, v]) => v && v.by && v.by !== me.id)
    .sort((a, b) => (a[1].ts || 0) - (b[1].ts || 0));
}

// ---------- appareil photo (direct, sans galerie) ----------
function ptPrendrePhoto(){
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/*';
  input.setAttribute('capture', 'user');    // iPhone/Android : ouvre l'appareil photo, pas la photothèque
  input.style.display = 'none';
  input.addEventListener('change', () => {
    const f = input.files && input.files[0];
    input.remove();
    if(!f) return;
    pcCompresser(f, data => { if(data){ ptPhoto = data; ptMajPhoto(); } });
  });
  document.body.appendChild(input);
  input.click();
}

// ---------- page d'écriture ----------
function ptOuvrir(){
  ptEnvoiOuvert = true;
  ptPhoto = null;
  const el = ptEcran('pt-plein');
  el.innerHTML = '<button type="button" class="qdj-fermer" aria-label="Fermer" data-pt-fermer>✕</button>'
    + '<div class="pt-corps">'
    +   '<div class="pt-ic">💌</div>'
    +   '<h2 class="pt-titre">Je pense à toi</h2>'
    +   '<p class="pt-sous">Un petit mot pour ' + escapeHtml(ptNomAutre()) + ', maintenant.</p>'
    +   '<textarea id="pt-texte" class="pt-champ" rows="4" maxlength="500" placeholder="Écris ton message…"></textarea>'
    +   '<div id="pt-photo-zone"></div>'
    +   '<p class="pt-avert">📸 La photo est prise en direct. Elle s’affichera <b>5 secondes</b> sur l’écran de '
    +     escapeHtml(ptNomAutre()) + ', puis sera <b>supprimée</b>.</p>'
    +   '<button type="button" class="btn-primary pt-envoyer" id="pt-envoyer">Envoyer</button>'
    + '</div>';
  el.querySelector('[data-pt-fermer]').addEventListener('click', ptFermer);
  el.querySelector('#pt-envoyer').addEventListener('click', ptEnvoyer);
  el.querySelector('#pt-texte').addEventListener('input', ptMajBouton);
  ptMajPhoto();
}

function ptFermer(){
  ptEnvoiOuvert = false;
  ptPhoto = null;
  const el = document.getElementById('pt-plein');
  if(el) el.remove();
}

function ptMajPhoto(){
  const zone = document.getElementById('pt-photo-zone');
  if(!zone) return;
  zone.innerHTML = ptPhoto
    ? '<div class="pt-apercu"><img src="' + ptPhoto + '" alt=""><div class="pt-apercu-actions">'
      + '<button type="button" class="btn-ghost" id="pt-reprendre">📷 Reprendre</button>'
      + '<button type="button" class="btn-ghost" id="pt-retirer">Retirer</button></div></div>'
    : '<button type="button" class="pt-photo-btn" id="pt-prendre">📷 Prendre une photo</button>';
  const b = id => document.getElementById(id);
  if(b('pt-prendre')) b('pt-prendre').addEventListener('click', ptPrendrePhoto);
  if(b('pt-reprendre')) b('pt-reprendre').addEventListener('click', ptPrendrePhoto);
  if(b('pt-retirer')) b('pt-retirer').addEventListener('click', () => { ptPhoto = null; ptMajPhoto(); });
  ptMajBouton();
}

function ptMajBouton(){
  const btn = document.getElementById('pt-envoyer');
  const t = document.getElementById('pt-texte');
  if(btn) btn.disabled = ptEnvoiEnCours || !((t && t.value.trim()) || ptPhoto);
}

function ptEnvoyer(){
  const t = document.getElementById('pt-texte');
  const texte = t ? t.value.trim() : '';
  if(ptEnvoiEnCours || (!texte && !ptPhoto)) return;
  ptEnvoiEnCours = true;
  const btn = document.getElementById('pt-envoyer');
  if(btn){ btn.disabled = true; btn.textContent = 'Envoi…'; }

  const envoyer = photo => {
    const cle = roomRef.child('pensees').push().key;
    roomRef.child('pensees/' + cle).set({ by: me.id, nom: me.name, texte: texte, photo: photo || null, ts: Date.now() })
      .then(() => {
        ptEnvoiEnCours = false;
        notifyPartner('💌 ' + me.name + ' pense à toi',
          texte ? (texte.length > 80 ? texte.slice(0, 77) + '…' : texte) : 'Une photo t’attend (5 secondes).', 'pensee');
        const corps = document.querySelector('#pt-plein .pt-corps');
        if(corps) corps.innerHTML = '<div class="pt-ic">💌</div><h2 class="pt-titre">Envoyé !</h2>'
          + '<p class="pt-sous">' + escapeHtml(ptNomAutre()) + ' va recevoir ta pensée.</p>'
          + '<button type="button" class="btn-primary pt-envoyer" id="pt-ok">Fermer</button>';
        const ok = document.getElementById('pt-ok');
        if(ok) ok.addEventListener('click', ptFermer);
      }, () => {
        ptEnvoiEnCours = false;
        if(btn){ btn.textContent = 'Envoyer'; }
        ptMajBouton();
        alert("L'envoi n'a pas abouti. Vérifie ta connexion et réessaie.");
      });
  };
  if(ptPhoto) pcProteger(ptPhoto, envoyer); else envoyer(null);
}

// ---------- réception ----------
function ptOuvrirRecue(cle){ ptRecueMasquee[cle] = false; ptRecueCle = cle; renderPenseeRecue(true); }

function ptFermerRecue(){
  const cle = ptRecueCle;
  const p = cle && state && state.pensees && state.pensees[cle];
  ptRecueCle = null;
  const el = document.getElementById('pt-recu');
  if(el) el.remove();
  if(!p) return;
  // Lue, et plus de photo à voir : on l'efface. Sinon on la garde pour plus tard.
  if(!p.photo) roomRef.child('pensees/' + cle).remove();
  else ptRecueMasquee[cle] = true;
  render();
}

function ptVoirPhoto(){
  const cle = ptRecueCle;
  const p = cle && state && state.pensees && state.pensees[cle];
  const zone = document.getElementById('pt-recu-photo');
  if(!p || !p.photo || !zone || ptVueEnCours) return;
  ptVueEnCours = true;
  zone.innerHTML = '<div class="pt-vue"><div class="pc-chrono"><span id="pt-count">' + (PT_VUE_MS / 1000)
    + '</span><small>s</small></div><img id="pt-vue-img" alt=""></div>';
  pcLire(p.photo,
    clair => { const i = document.getElementById('pt-vue-img'); if(i) i.src = clair; },
    () => { zone.innerHTML = '<p class="pd-verrou">🔒 Photo chiffrée — ouvre le coffre avec votre phrase secrète pour la voir.</p>'; });
  const fin = Date.now() + PT_VUE_MS;
  const tic = setInterval(() => {
    const reste = fin - Date.now();
    const c = document.getElementById('pt-count');
    if(c) c.textContent = Math.max(0, Math.ceil(reste / 1000));
    if(reste <= 0){
      clearInterval(tic);
      ptVueEnCours = false;
      // 5 s écoulées : la photo est supprimée de la base, définitivement.
      roomRef.child('pensees/' + cle + '/photo').remove();
      const z = document.getElementById('pt-recu-photo');
      if(z) z.innerHTML = '<p class="pt-efface">La photo a disparu 💨</p>';
    }
  }, 100);
}

// Plein écran de la pensée reçue. Construit une seule fois par pensée.
function renderPenseeRecue(forcer){
  let el = document.getElementById('pt-recu');
  const p = ptRecueCle && state && state.pensees && state.pensees[ptRecueCle];
  if(!p){
    if(el && !ptVueEnCours){ el.remove(); }
    if(!ptVueEnCours) ptRecueCle = null;
    return;
  }
  if(el && el.dataset.cle === ptRecueCle && !forcer) return;
  if(!el){ el = document.createElement('div'); el.id = 'pt-recu'; document.body.appendChild(el); }
  el.dataset.cle = ptRecueCle;
  el.innerHTML = '<button type="button" class="qdj-fermer" aria-label="Fermer" data-pt-recu-fermer>✕</button>'
    + '<div class="pt-corps">'
    +   '<div class="pt-ic">💌</div>'
    +   '<h2 class="pt-titre">' + escapeHtml(p.nom || ptNomAutre()) + ' pense à toi</h2>'
    +   (p.texte ? '<div class="pt-message">' + escapeHtml(p.texte) + '</div>' : '')
    +   '<div id="pt-recu-photo">'
    +     (p.photo ? '<button type="button" class="pt-photo-btn" id="pt-voir">📸 Voir la photo</button>'
          + '<p class="pt-avert">Elle s’affichera <b>5 secondes</b>, puis sera <b>supprimée</b>.</p>' : '')
    +   '</div>'
    +   '<button type="button" class="btn-primary pt-envoyer" data-pt-recu-fermer>Fermer</button>'
    + '</div>';
  el.querySelectorAll('[data-pt-recu-fermer]').forEach(b => b.addEventListener('click', ptFermerRecue));
  const v = document.getElementById('pt-voir');
  if(v) v.addEventListener('click', ptVoirPhoto);
}

// ---------- rendu (appelé par render() à chaque mise à jour) ----------
function renderPenseToi(){
  const tuile = document.getElementById('pt-tuile');
  if(!tuile || !state || !me) return;
  const recues = ptRecues();
  tuile.style.display = accueilVisible() ? '' : 'none';
  const nouvelle = recues.length > 0;
  tuile.classList.toggle('pt-nouvelle', nouvelle);
  const sous = nouvelle
    ? (recues.length > 1 ? recues.length + ' pensées de ' : 'Une pensée de ') + escapeHtml(ptNomAutre()) + ' t’attend'
    : 'Un mot, une photo, maintenant';
  const html = '<span class="pt-tuile-ic">💌</span><span class="pt-tuile-txt"><strong>Je pense à toi</strong><small>' + sous + '</small></span>';
  if(tuile.innerHTML !== html) tuile.innerHTML = html;

  // Une nouvelle pensée arrive : elle s'ouvre toute seule en plein écran
  // (sauf si on l'a déjà refermée pendant cette session).
  if(!ptRecueCle){
    const aOuvrir = recues.find(([k]) => !ptRecueMasquee[k]);
    if(aOuvrir){ ptRecueCle = aOuvrir[0]; renderPenseeRecue(true); return; }
  }
  renderPenseeRecue(false);
}

// Toucher la case : s'il y a une pensée en attente, on la lit ; sinon on écrit.
function ptToucherTuile(){
  const recues = ptRecues();
  if(recues.length){ ptOuvrirRecue(recues[0][0]); return; }
  ptOuvrir();
}

// Écran plein (créé à la demande, comme le message du Mode HOT).
function ptEcran(id){
  let el = document.getElementById(id);
  if(!el){ el = document.createElement('div'); el.id = id; document.body.appendChild(el); }
  return el;
}
