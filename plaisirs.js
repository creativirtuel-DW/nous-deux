/**
 * Nous Deux — mode de jeu « Plaisirs Intimes » (monde 3 du Parcours : Fusionnels)
 * ===============================================================================
 * S'ouvre EN MÊME TEMPS que le Mode HOT (mode-couple.js) : quand l'un ou
 * l'autre atteint MC_SEUIL (300) points — harmonisé le 18/11/2026.
 * Une case « HOT » apparaît alors dans la page des jeux (« Jouer ») — elle
 * était sur l'accueil jusqu'au 23/11/2026 — ; elle ouvre un mode aux
 * couleurs chaudes avec deux choix : Question (très explicite) ou Défi (très HOT).
 *
 * PI_ACTIF = false couperait le jeu pour tout le monde (sauf aperçu dev mod).
 *
 * Banque : plaisirs-data.js (GÉNÉRÉ depuis Plaisirs-Intimes.xlsx, voir outils/).
 * Anti-répétition partagée : rooms/$room/plaisirsVus/<questions|defis>/<id> = true,
 * remis à zéro quand toute la catégorie est sortie.
 *
 * Passes : chacun peut PASSER 5 cartes par jour (questions + défis confondus,
 * jour civil Paris) → rooms/$room/plaisirsPasses/<pid>/<AAAA-MM-JJ> = nombre.
 * Au-delà, un pop-up demande d'accepter de perdre PI_MALUS points par passe.
 * « C'est fait » (carte réalisée) ne compte pas comme une passe.
 *
 * Questions : la réponse s'ÉCRIT dans l'appli, puis le partenaire la VALIDE
 * sur son téléphone → rooms/$room/plaisirsReponses/<clé> =
 *   { de, pour, qid, q, rep, ts, valide: ts|null }
 * Le partenaire est prévenu (notification) ; la case HOT et l'écran du mode
 * affichent les réponses en attente de sa validation.
 */
const PI_ACTIF = true;
const PI_SEUIL = MC_SEUIL;     // même seuil que le Mode HOT (300)
const PI_PASSES = 5;           // passes gratuites par jour
const PI_MALUS = 20;
const PI_SYNC_GAIN = 10;       // question « synchro » : même réponse = +10 chacun (compteur Plaisirs seulement)
const PI_SYNC_PERTE = 5;       // réponses différentes = −5 chacun (jamais sous 0)
const PI_DEFI_PTS = 20;        // défi validé = le double d'une question (pour celui/celle qui l'a relevé)
const PI_MAX_ATTENTE = 5;      // cartes envoyées par personne en attente de validation (23/11/2026)
function piLimiteAtteinte(){ return piEnAttente().length >= PI_MAX_ATTENTE; }
const PI_MSG_LIMITE = PI_MAX_ATTENTE + ' cartes sont envoyées : ton/ta partenaire doit y répondre, ou les valider, pour que tu puisses en envoyer d’autres !';           // points perdus par passe au-delà

let piOuvert = false;          // plein écran ouvert
let piCarte = null;            // { mode, id, t } carte affichée
let piChoix = null;            // réponse cochée sur la question en cours (format synchro, 25/11/2026)
let piLieu = null;             // 'e' = ensemble, 'd' = à distance — choisi à chaque ouverture (23/11/2026)
// Une carte se joue-t-elle dans ce lieu ? l = 'e' (ensemble), 'd' (distance) ou '2' (les deux).
function piCarteJouable(x){ const l = x.l || '2'; return l === '2' || l === piLieu; }

function piDebloque(){ return PI_ACTIF && typeof mcDebloque === 'function' && mcDebloque(); }
function piVisible(){ return piDebloque() || (typeof isAdminUnlocked === 'function' && isAdminUnlocked()); }

// « Débloqué ! » : tant que ce téléphone n'a jamais ouvert Plaisirs Intimes,
// une bannière sur l'accueil et un ruban sur la case invitent à le découvrir.
function piCleDecouvert(){ return 'nousdeux_pi_decouvert_' + roomCode + '_' + me.id; }
function piDecouvert(){ try{ return localStorage.getItem(piCleDecouvert()) === '1'; }catch(e){ return false; } }
function piMarquerDecouvert(){ try{ localStorage.setItem(piCleDecouvert(), '1'); }catch(e){} }

// « Mode HOT débloqué » reste affiché (bouton Jouer + case Plaisirs Intimes) pendant
// 7 jours après le déblocage, et de toute façon tant que ce téléphone n'a jamais ouvert le jeu.
const HOT_NOUVEAU_JOURS = 7;
function hotNouveau(){
  if(!piDebloque()) return false;
  const ts = state && state.modeCouple && state.modeCouple.debloque;
  const recent = typeof ts === 'number' && Date.now() - ts < HOT_NOUVEAU_JOURS * 86400000;
  return recent || !piDecouvert();
}

// Bannière de l'accueil : un appui ouvre la page des jeux, où est la case HOT.
function renderHotBanniere(){
  // Ruban sur le gros bouton « Jouer » de l'accueil.
  const jouer = document.getElementById('jouer-btn');
  if(jouer){
    let r = jouer.querySelector(':scope > .hot-ruban-jouer');
    if(hotNouveau()){
      if(!r){ r = document.createElement('span'); r.className = 'hot-ruban-jouer'; r.textContent = '🔥 Mode HOT débloqué !'; jouer.appendChild(r); }
    } else if(r) r.remove();
  }
  const b = document.getElementById('hot-banniere');
  if(!b) return;
  const vis = piDebloque() && !piDecouvert() && accueilVisible();
  b.style.display = vis ? '' : 'none';
  if(!vis) return;
  const html = '<span class="hot-ban-ic">🔥</span>'
    + '<span class="hot-ban-txt"><strong>Mode HOT débloqué !</strong><small>Nouveau jeu : Plaisirs Intimes</small></span>'
    + '<span class="hot-ban-go">Découvrir ›</span>';
  if(b.innerHTML !== html) b.innerHTML = html;
}
document.addEventListener('click', e => {
  if(e.target.closest && e.target.closest('#hot-banniere')){
    ouvrirJeux();
    setTimeout(() => { const t = document.getElementById('pi-tuile'); if(t) t.scrollIntoView({ behavior: 'smooth', block: 'center' }); }, 60);
  }
});

// ---------- case de la page des jeux ----------
function renderPlaisirs(){
  renderHotBanniere();
  if(piDebloque() && typeof piVerifierPaliers === 'function') piVerifierPaliers();
  const t = document.getElementById('pi-tuile');
  if(!t || !state || !me || !me.id) return;
  if(piOuvert && !piCarte) piDessiner();
  const vis = piVisible() && jeuxOuvert && !panneauJeuOuvert();
  t.style.display = vis ? '' : 'none';
  const etiqV = document.getElementById('pi-etiquette'); if(etiqV) etiqV.style.display = vis ? '' : 'none';
  if(!vis) return;
  const dev = !piDebloque();
  const n = piAValider().length;
  const nouveau = !dev && hotNouveau();
  // Étiquette « Mode HOT débloqué » à cheval sur le haut de la case (la case coupe ce qui dépasse :
  // l'étiquette est donc posée juste avant elle).
  let etiq = document.getElementById('pi-etiquette');
  if(nouveau){
    if(!etiq){ etiq = document.createElement('span'); etiq.id = 'pi-etiquette'; etiq.className = 'hot-ruban-jouer pi-etiquette'; etiq.textContent = '🔥 Mode HOT débloqué !'; t.parentNode.insertBefore(etiq, t); }
  } else if(etiq) etiq.remove();
  const html = '<span class="pi-tuile-hot">HOT</span>'
    + '<span class="pi-tuile-txt"><strong>Plaisirs Intimes</strong><small>'
    + (n ? '✍️ ' + n + (n > 1 ? ' réponses' : ' réponse') + ' à valider' : dev ? 'Aperçu dev mod · verrouillé pour vous deux' : 'Questions & défis très chauds… 🔥') + '</small></span>'
    + '<span class="pi-tuile-ic">🌶️</span>' + (n ? '<span class="pi-badge">' + n + '</span>' : '');
  if(t.innerHTML !== html) t.innerHTML = html;
}

// ---------- réponses écrites aux questions ----------
function piAutreId(){ return me && me.id === 'p1' ? 'p2' : 'p1'; }
function piNomAutre(){ return (state && state.players && state.players[piAutreId()]) || 'ton/ta partenaire'; }
function piReponses(){ return Object.entries((state && state.plaisirsReponses) || {}).map(([k, r]) => Object.assign({ k }, r)); }
// Réponses de mon/ma partenaire que je dois valider
function piAValider(){ return piReponses().filter(r => r.pour === me.id && !r.valide).sort((a, b) => a.ts - b.ts); }
// Mes réponses encore en attente
// Mes cartes validées par l'autre avec un commentaire, pas encore marquées comme lues.
function piRetours(){ return piReponses().filter(r => r.de === me.id && r.valide && (r.retour || r.sync) && !r.retourVu).sort((a, b) => b.valide - a.valide); }
function piBlocRetours(){
  const l = piRetours();
  if(!l.length) return '';
  return '<section class="pi-valider pi-retours"><h3>💬 ' + escapeHtml(piNomAutre()) + ' t’a répondu</h3>'
    + l.slice(0, 10).map(r => '<div class="pi-rep' + (r.sync ? (r.ok ? ' pi-sync-ok' : ' pi-sync-ko') : '') + '"><div class="pi-rep-q">' + (r.sync ? (r.ok ? '💞 Synchro ! +' + PI_SYNC_GAIN + ' · ' : '💔 Pas synchro −' + PI_SYNC_PERTE + ' · ') : r.sms || r.defi ? '🔥 ' : '💬 ') + escapeHtml(r.q || '') + '</div>'
      + (r.defi || r.sms ? '' : '<div class="pi-rep-txt">Toi : « ' + escapeHtml(r.rep || '') + ' »</div>')
      + (r.sync ? '<div class="pi-rep-txt">' + escapeHtml(piNomAutre()) + ' a deviné : « ' + escapeHtml((r.a || [])[r.choixAutre] || '') + ' »</div>' : '')
      + (r.retour ? '<div class="pi-rep-txt pi-rep-retour">' + escapeHtml(piNomAutre()) + ' : « ' + escapeHtml(r.retour) + ' »</div>' : '')
      + '<button type="button" class="pi-btn ghost" data-pi-retour-vu="' + r.k + '">Lu ✓</button></div>').join('')
    + '</section>';
}

function piEnAttente(){ return piReponses().filter(r => r.de === me.id && !r.valide); }

function piEnvoyerReponse(txt){
  txt = String(txt || '').trim();
  if(!txt || !piCarte) return false;
  roomRef.child('plaisirsReponses').push({ de: me.id, pour: piAutreId(), qid: piCarte.id, q: piCarte.t, rep: txt, ts: Date.now(), valide: null });
  if(typeof notifyPartner === 'function')
    notifyPartner('🌶️ ' + me.name + ' a répondu à une question HOT', 'Ouvre Plaisirs Intimes pour lire sa réponse et la valider.', 'plaisirs');
  return true;
}
function piValider(k){
  const r = (state.plaisirsReponses || {})[k];
  if(!r || r.pour !== me.id) return;
  // Commentaire facultatif du validateur, rendu à celui/celle qui a joué (24/11/2026).
  const champ = document.querySelector('[data-pi-retour="' + k + '"]');
  const retour = champ ? champ.value.trim().slice(0, 400) : '';
  roomRef.child('plaisirsReponses/' + k).update({ valide: Date.now(), retour: retour || null });
  piAjouterPoints(r.de, r.defi || r.sms ? PI_DEFI_PTS : PI_SYNC_GAIN);   // compteur Plaisirs (25/11/2026)
  const extrait = retour ? ' « ' + retour.slice(0, 90) + (retour.length > 90 ? '…' : '') + ' »' : '';
  if(typeof notifyPartner === 'function')
    notifyPartner(r.defi || r.sms ? '✓ Défi validé' : '✓ Réponse validée',
      me.name + (r.defi || r.sms ? ' a validé ton défi 🔥' : ' a lu et validé ta réponse 🔥') + extrait, 'plaisirs');
}
// Question « synchro » reçue : je dois deviner la réponse de l'autre.
function piBlocDeviner(r){
  return '<div class="pi-rep pi-sync"><div class="pi-rep-q">💞 ' + escapeHtml(r.q || '') + '</div>'
    + '<p class="pi-sync-aide">Qu’a répondu ' + escapeHtml(piNomAutre()) + ' ? Devine la même réponse !</p>'
    + '<div class="pi-sync-choix">' + (r.a || []).map((t, i) => '<button type="button" class="pi-sync-opt" data-pi-devine="' + r.k + '" data-i="' + i + '">' + escapeHtml(t) + '</button>').join('') + '</div>'
    + '<textarea class="pi-champ pi-retour" data-pi-retour="' + r.k + '" rows="2" maxlength="400" placeholder="Un petit mot pour ' + escapeHtml(piNomAutre()) + ' (optionnel)…"></textarea>'
    + '<button type="button" class="pi-btn" data-pi-sync-valider="' + r.k + '">💞 Valider ma réponse</button></div>';
}
const piDevine = {};   // clé -> réponse cochée (avant validation)

// Je valide ma réponse : synchro ou pas, points pour les deux (compteur Plaisirs seulement).
function piSyncValider(k){
  const r = (state.plaisirsReponses || {})[k];
  if(!r || r.pour !== me.id || r.valide || piDevine[k] === undefined) return false;
  const choix = piDevine[k];
  const ok = choix === r.choix;
  const delta = ok ? PI_SYNC_GAIN : -PI_SYNC_PERTE;
  const champ = document.querySelector('[data-pi-retour="' + k + '"]');
  const retour = champ ? champ.value.trim().slice(0, 400) : '';
  roomRef.child('plaisirsReponses/' + k).update({ valide: Date.now(), choixAutre: choix, ok: ok, gain: delta, retour: retour || null });
  ['p1', 'p2'].forEach(pid => piAjouterPoints(pid, delta));
  delete piDevine[k];
  if(typeof synchroAnimer === 'function') synchroAnimer(ok, delta, r.q);
  const extrait = retour ? ' « ' + retour.slice(0, 90) + (retour.length > 90 ? '…' : '') + ' »' : '';
  if(typeof notifyPartner === 'function')
    notifyPartner(ok ? '💞 Synchro !' : '💔 Pas synchro…',
      (ok ? me.name + ' a deviné ta réponse : +' + PI_SYNC_GAIN + ' pts chacun 🔥' : me.name + ' n’a pas deviné ta réponse : −' + PI_SYNC_PERTE + ' pts chacun') + extrait, 'plaisirs');
  return true;
}

function piBlocValider(){
  const l = piAValider();
  if(!l.length) return '';
  return '<section class="pi-valider"><h3>✍️ ' + escapeHtml(piNomAutre()) + ' t’a répondu</h3>'
    + l.map(r => r.sync ? piBlocDeviner(r) : '<div class="pi-rep"><div class="pi-rep-q">' + (r.sms || r.defi ? '🔥 ' : '💬 ') + escapeHtml(r.q || '') + '</div>'
      + (r.photo ? '<div class="pc-ouvrir-zone pi-photo-zone" data-pi-photo-zone="' + r.k + '"><button type="button" class="pi-btn" data-pi-photo-ouvrir="' + r.k + '">📸 Ouvrir sa photo (' + Math.round(PC_VUE_MS / 1000) + ' s)</button><p class="pc-note">Une seule fois : elle disparaît ensuite.</p></div>'
        : r.photoVue ? '<div class="pi-rep-txt pi-rep-sms">📸 Photo vue.</div>'
        : r.sms ? '<div class="pi-rep-txt pi-rep-sms">📱 Photo envoyée par SMS : regarde tes messages.</div>'
        : r.defi ? '<div class="pi-rep-txt pi-rep-sms">🔥 ' + escapeHtml(piNomAutre()) + ' dit avoir relevé ce défi.</div>'
        : '<div class="pi-rep-txt">« ' + escapeHtml(r.rep || '') + ' »</div>')
      + (r.photo ? '' :   // on ne valide pas une photo sans l'avoir vue
        '<textarea class="pi-champ pi-retour" data-pi-retour="' + r.k + '" rows="2" maxlength="400" placeholder="Ta réponse à ' + escapeHtml(piNomAutre()) + ' (optionnel)…"></textarea>'
        + '<button type="button" class="pi-btn" data-pi-valider="' + r.k + '">' + (r.sms || r.photoVue ? '✓ Photo reçue, je valide' : r.defi ? '✓ Je valide son défi' : '✓ Je valide sa réponse') + '</button>') + '</div>').join('')
    + '</section>';
}

// ---------- pop-up de présentation (23/11/2026) ----------
// S'affiche à chaque ouverture du jeu, tant que « Ne plus afficher » n'est pas coché (par téléphone).
function piCleAide(){ return 'nousdeux_pi_aide_masquee_' + roomCode + '_' + me.id; }
function piAideMasquee(){ try{ return localStorage.getItem(piCleAide()) === '1'; }catch(e){ return false; } }
function piPresentation(){
  const el = ptEcran('pi-aide');
  el.className = 'env-voile';
  el.innerHTML = '<div class="env-pop pi-pop">'
    + '<div class="env-pop-ic">🔥</div>'
    + '<h2>Plaisirs Intimes</h2>'
    + '<p>Vous voici maintenant dans un <b>mode HOT</b> pour votre couple ! Vous y trouverez des questions et des défis à réaliser, ciblés sur votre vie sexuelle.</p>'
    + '<p>Ce jeu n’a pas pour but de vous amener à faire l’amour, mais plutôt à <b>vous ouvrir à l’autre sans tabou</b>, et à faire <b class="pi-chaud">monter la température</b> entre vous !</p>'
    + '<p>Le tirage des cartes est aléatoire et le niveau HOT de la carte peut varier.</p>'
    + '<p>Vous pouvez passer une carte jusqu’à ' + PI_PASSES + ' fois par jour. Au-delà, vous perdrez des points…</p>'
    + '<p><b>Alors détendez-vous, oubliez les tabous, et amusez-vous en couple !</b></p>'
    + '<label class="qdj-aide-case env-aide-case"><input type="checkbox" id="pi-aide-masquer"' + (piAideMasquee() ? ' checked' : '') + '> Ne plus afficher</label>'
    + '<button type="button" class="btn-primary" data-pi-aide-ok>C’est parti</button>'
    + '</div>';
  el.querySelector('[data-pi-aide-ok]').onclick = () => {
    try{ localStorage.setItem(piCleAide(), el.querySelector('#pi-aide-masquer').checked ? '1' : '0'); }catch(e){}
    el.remove();
  };
}

// ---------- code personnel (23/11/2026) ----------
// Chaque téléphone protège l'entrée de Plaisirs Intimes par SON propre code, créé
// à la 1re entrée puis demandé à chaque entrée. Seule une empreinte (SHA-256) est
// gardée sur le téléphone, jamais le code ni rien dans la base.
// Code oublié : il se réinitialise avec le code du dev mod.
let piPhotoEnVue = false;          // une photo reçue est affichée (5 s)
let piPinOuvert = false;          // code tapé pour CETTE entrée dans le jeu
function piPinCle(){ return 'nousdeux_pi_pin_' + roomCode + '_' + me.id; }
function piPinLire(){ try{ return localStorage.getItem(piPinCle()) || ''; }catch(e){ return ''; } }
async function piPinEmpreinte(code){
  const h = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('nous-deux/pin/' + roomCode + '/' + me.id + '/' + code));
  return Array.from(new Uint8Array(h)).map(b => b.toString(16).padStart(2, '0')).join('');
}
function piDemanderPin(){
  return new Promise((ok, ko) => {
    const creation = !piPinLire();
    const el = document.createElement('div');
    el.id = 'pi-pin';
    el.className = 'env-voile secret-voile';
    el.innerHTML = '<div class="env-pop pi-pop secret-pop">'
      + '<div class="env-pop-ic">🔥</div><h2>Plaisirs Intimes</h2>'
      + (creation
        ? '<p>Choisis ton <b>code personnel</b> : il protégera l’entrée de ce jeu sur <b>ton</b> téléphone. Il te sera demandé à chaque fois.</p>'
          + '<input type="password" inputmode="numeric" class="coffre-input secret-champ" data-pin1 autocomplete="off" placeholder="Ton code (4 caractères ou plus)">'
          + '<input type="password" inputmode="numeric" class="coffre-input secret-champ" data-pin2 autocomplete="off" placeholder="Retape-le">'
        : '<p>Entre ton code personnel.</p>'
          + '<input type="password" inputmode="numeric" class="coffre-input secret-champ" data-pin1 autocomplete="off" placeholder="Ton code">')
      + '<p class="coffre-erreur secret-erreur"></p>'
      + '<button type="button" class="btn-primary" data-pin-ok>' + (creation ? 'Créer mon code' : 'Entrer') + '</button>'
      + (creation ? '' : '<button type="button" class="btn-ghost pi-pin-oubli" data-pin-oubli>Code oublié ?</button>')
      + '<button type="button" class="btn-ghost" data-pin-annuler>Annuler</button></div>';
    document.body.appendChild(el);
    const c1 = el.querySelector('[data-pin1]'), c2 = el.querySelector('[data-pin2]');
    const erreur = el.querySelector('.secret-erreur');
    setTimeout(() => c1.focus(), 50);
    const fermer = () => el.remove();
    const valider = async () => {
      const code = c1.value.trim();
      if(creation){
        if(code.length < 4){ erreur.textContent = 'Au moins 4 caractères.'; return; }
        if(code !== c2.value.trim()){ erreur.textContent = 'Les deux codes ne sont pas identiques.'; c2.select(); return; }
        try{ localStorage.setItem(piPinCle(), await piPinEmpreinte(code)); }catch(e){}
      } else if(await piPinEmpreinte(code) !== piPinLire()){
        erreur.textContent = 'Code incorrect.'; c1.select(); return;
      }
      piPinOuvert = true; fermer(); ok();
    };
    el.querySelector('[data-pin-ok]').onclick = valider;
    el.querySelectorAll('.secret-champ').forEach(c => c.addEventListener('keydown', e => { if(e.key === 'Enter') valider(); }));
    el.querySelector('[data-pin-annuler]').onclick = () => { fermer(); ko(new Error('annulé')); };
    const oubli = el.querySelector('[data-pin-oubli]');
    if(oubli) oubli.onclick = () => {
      const admin = state && state.adminPin;
      const saisi = prompt('Pour réinitialiser ton code personnel, entre le code du dev mod :');
      if(saisi === null) return;
      if(!admin || saisi.trim() !== String(admin)){ erreur.textContent = 'Code du dev mod incorrect.'; return; }
      try{ localStorage.removeItem(piPinCle()); }catch(e){}
      fermer();
      piDemanderPin().then(ok, ko);
    };
  });
}

// ---------- plein écran ----------
function piOuvrir(){
  if(!piVisible()) return;
  // 1. Le code personnel de ce téléphone, à chaque entrée dans le jeu.
  if(!piPinOuvert){ piDemanderPin().then(piOuvrir, () => {}); return; }
  // 2. Le contenu chiffré (secret.js) : clé récupérée toute seule dans la base.
  if(typeof secretContenu !== 'undefined' && !secretContenu){
    secretAssurer('Le contenu de Plaisirs Intimes est chiffré.').then(piOuvrir, () => {});
    return;
  }
  if(piDebloque()){ piMarquerDecouvert(); renderHotBanniere(); }
  piOuvert = true; piCarte = null; piLieu = null;
  const el = ptEcran('pi-plein');
  el.innerHTML = '<div class="pi-flammes" aria-hidden="true"></div>'
    + '<button type="button" class="qdj-fermer" aria-label="Fermer" data-pi-fermer>✕</button>'
    + '<div class="pi-corps" id="pi-corps"></div>';
  el.querySelector('[data-pi-fermer]').onclick = piFermer;
  piDessiner();
  // Cinématique d'ouverture (pi-intro.js), puis la présentation si elle n'est pas masquée.
  const apres = () => { if(!piAideMasquee()) piPresentation(); };
  if(typeof piIntro === 'function') piIntro(apres); else apres();
}
function piFermer(){
  piOuvert = false; piCarte = null; piPinOuvert = false;   // le code sera redemandé à la prochaine entrée
  const el = document.getElementById('pi-plein'); if(el) el.remove();
}

function piDessiner(){
  const c = document.getElementById('pi-corps');
  if(!c) return;
  const actif = document.activeElement;
  if(!piCarte && actif && actif.matches && actif.matches('.pi-retour') && c.contains(actif)) return;
  if(piPhotoEnVue) return;   // photo affichée 5 s : on ne redessine pas pendant la vue
  if(!piCarte){
    c.innerHTML = '<div class="pi-logo">🔥</div>'
      + '<h2 class="pi-titre">Plaisirs Intimes</h2>'
      + '<p class="pi-sous">Rien que vous deux. Choisis ton jeu…</p>'
      + (piDebloque() ? '' : '<p class="pi-dev">🔧 Aperçu dev mod : ce mode est encore verrouillé pour vous deux.</p>')
      + (typeof piBlocCompteur === 'function' ? piBlocCompteur() : '')
      + piBlocValider()
      + (typeof piBlocCadeaux === 'function' ? piBlocCadeaux() : '')
      + piBlocRetours()
      + (piLimiteAtteinte()
        ? '<div class="pi-limite"><div class="pi-limite-ic">⏳</div><p>' + PI_MSG_LIMITE + '</p>'
          + '<small>' + piEnAttente().length + ' / ' + PI_MAX_ATTENTE + ' en attente chez ' + escapeHtml(piNomAutre()) + '</small></div>'
        : (piEnAttente().length ? '<p class="pi-attente">⏳ ' + piEnAttente().length + ' / ' + PI_MAX_ATTENTE + (piEnAttente().length > 1 ? ' cartes envoyées attendent' : ' carte envoyée attend') + ' la validation de ' + escapeHtml(piNomAutre()) + '</p>' : ''))
      + (piLimiteAtteinte() ? '' : !piLieu
        ? '<p class="pi-lieu-q">Comment jouez-vous ?</p>'
          + '<button type="button" class="pi-choix pi-lieu" data-pi-lieu="e"><span>💑</span><b>Jouer ensemble</b><small>Vous êtes tous les deux au même endroit.</small></button>'
          + '<button type="button" class="pi-choix pi-lieu defi" data-pi-lieu="d"><span>📱</span><b>Jouer à distance</b><small>Chacun de son côté : seules les cartes faisables à distance sortent.</small></button>'
        : '<button type="button" class="pi-lieu-actuel" data-pi-lieu-changer>' + (piLieu === 'e' ? '💑 Ensemble' : '📱 À distance') + ' · changer</button>'
          + '<button type="button" class="pi-choix" data-pi-mode="questions"><span>💬</span><b>Question</b><small>Réponds, et ton/ta partenaire doit deviner la même réponse !</small></button>'
          + '<button type="button" class="pi-choix defi" data-pi-mode="defis"><span>🔥</span><b>Défi</b><small>' + (piLieu === 'd' ? 'Un défi HOT à relever chacun de son côté.' : 'Un défi très HOT à réaliser, maintenant.') + '</small></button>');
    c.querySelectorAll('[data-pi-mode]').forEach(b => b.onclick = () => piTirer(b.dataset.piMode));
    c.querySelectorAll('[data-pi-lieu]').forEach(b => b.onclick = () => { piLieu = b.dataset.piLieu; piDessiner(); });
    const changer = c.querySelector('[data-pi-lieu-changer]');
    if(changer) changer.onclick = () => { piLieu = null; piDessiner(); };
    c.querySelectorAll('[data-pi-valider]').forEach(b => b.onclick = () => piValider(b.dataset.piValider));
    if(typeof piBrancherCadeaux === 'function') piBrancherCadeaux(c);
    c.querySelectorAll('[data-pi-devine]').forEach(b => {
      const k = b.dataset.piDevine;
      if(piDevine[k] === +b.dataset.i) b.classList.add('sel');
      b.onclick = () => {
        piDevine[k] = +b.dataset.i;
        c.querySelectorAll('[data-pi-devine="' + k + '"]').forEach(x => x.classList.toggle('sel', x === b));
      };
    });
    c.querySelectorAll('[data-pi-sync-valider]').forEach(b => b.onclick = () => {
      if(!piSyncValider(b.dataset.piSyncValider)){
        const z = b.parentNode.querySelector('.pi-sync-choix'); z.classList.add('vide'); setTimeout(() => z.classList.remove('vide'), 900);
      }
    });
    c.querySelectorAll('[data-pi-photo-ouvrir]').forEach(b => b.onclick = () => {
      const k = b.dataset.piPhotoOuvrir, r = (state.plaisirsReponses || {})[k];
      const zone = c.querySelector('[data-pi-photo-zone="' + k + '"]');
      if(!r || !r.photo || !zone) return;
      piPhotoEnVue = true;
      pcMontrer(zone, r.photo, () => {
        piPhotoEnVue = false;
        const maj = {};
        maj['plaisirsReponses/' + k + '/photo'] = null;
        maj['plaisirsReponses/' + k + '/photoVue'] = Date.now();
        pcArchiver(maj, 'plaisirs-' + k, r.photo, r.de, r.q);   // 12 h en dev mod, comme les autres photos
        roomRef.update(maj);
      });
    });
    c.querySelectorAll('[data-pi-retour-vu]').forEach(b => b.onclick = () => roomRef.child('plaisirsReponses/' + b.dataset.piRetourVu + '/retourVu').set(true));
    return;
  }
  const q = piCarte.mode === 'questions';
  c.innerHTML = '<div class="pi-carte ' + (q ? '' : 'defi') + '">'
    + '<div class="pi-carte-type">' + (q ? '💬 Question' : '🔥 Défi') + '</div>'
    + '<p class="pi-carte-texte">' + escapeHtml(piCarte.t) + '</p>'
    + '<div class="pi-carte-pied">Plaisirs Intimes</div></div>'
    + (q && piCarte.a
        ? '<p class="pi-sync-aide">Coche ta réponse : ' + escapeHtml(piNomAutre()) + ' devra deviner la même !</p>'
          + '<div class="pi-sync-choix">' + piCarte.a.map((t, i) => '<button type="button" class="pi-sync-opt" data-pi-choix="' + i + '">' + escapeHtml(t) + '</button>').join('') + '</div>'
          + '<textarea class="pi-champ pi-sync-com" maxlength="300" rows="2" placeholder="Un petit mot pour pimenter ta réponse (optionnel)…"></textarea>'
        : q ? '<textarea class="pi-champ" maxlength="600" rows="4" placeholder="Écris ta réponse… ' + escapeHtml(piNomAutre()) + ' la lira et la validera."></textarea>' : '')
    + (!q && smsDemandePhoto(piCarte.t)
        ? smsConsigne(true)
          + smsChoixAppli('<button type="button" class="pi-btn" data-pi-photo>📸 Envoyer depuis l’appli · défi suivant</button>')
          + smsBouton('data-pi-sms-ouvrir') + '<button type="button" class="pi-btn sms-pi" data-pi-sms>✓ Le SMS est envoyé · défi suivant</button><p class="pi-sms-note">' + escapeHtml(piNomAutre()) + ' validera ton défi une fois la photo reçue.</p>'
        : '<button type="button" class="pi-btn" data-pi-fait>' + (q ? '📨 Envoyer ma réponse · question suivante' : '✓ Défi réalisé · défi suivant') + '</button>')
    + '<button type="button" class="pi-btn ghost" data-pi-passer>' + (q ? 'Passer cette question' : 'Passer ce défi') + ' <small>' + piTextePasses() + '</small></button>'
    + '<button type="button" class="pi-btn ghost" data-pi-retour>Changer de jeu</button>';
  const smsB = c.querySelector('[data-pi-sms]');
  if(smsB) smsB.onclick = () => {
    const t = piCarte.t;
    roomRef.child('plaisirsReponses').push({ de: me.id, pour: piAutreId(), qid: piCarte.id, q: t, rep: '📱 Photo envoyée par SMS', sms: true, ts: Date.now(), valide: null });
    if(typeof notifyPartner === 'function')
      notifyPartner('🌶️ ' + me.name + ' t’a envoyé une photo par SMS', 'Regarde tes messages, puis valide son défi dans Plaisirs Intimes.', 'plaisirs');
    piCarte.fait = true; piTirer(piCarte.mode);
  };
  const smsO = c.querySelector('[data-pi-sms-ouvrir]');
  if(smsO) smsO.onclick = () => smsOuvrir(piCarte.t);
  // Photo prise dans l'appli (24/11/2026) : chiffrée (code secret), vue 5 s par l'autre puis effacée.
  const photoB = c.querySelector('[data-pi-photo]');
  if(photoB) photoB.onclick = () => {
    const carte = piCarte;
    pcChoisirPhoto(dataUrl => {
      if(!dataUrl) return;
      photoB.disabled = true; photoB.textContent = 'Envoi…';
      pcProteger(dataUrl, protegee => {
        roomRef.child('plaisirsReponses').push({ de: me.id, pour: piAutreId(), qid: carte.id, q: carte.t, rep: '📸 Photo', photo: protegee, defi: true, ts: Date.now(), valide: null });
        if(typeof notifyPartner === 'function')
          notifyPartner('🌶️ ' + me.name + ' t’a envoyé une photo HOT', 'Ouvre Plaisirs Intimes : tu ne la verras que ' + Math.round(PC_VUE_MS / 1000) + ' secondes !', 'plaisirs');
        piCarte.fait = true; piTirer(piCarte.mode);
      });
    });
  };
  c.querySelectorAll('[data-pi-choix]').forEach(b => b.onclick = () => {
    piChoix = +b.dataset.piChoix;
    c.querySelectorAll('[data-pi-choix]').forEach(x => x.classList.toggle('sel', x === b));
  });
  const faitB = c.querySelector('[data-pi-fait]');
  if(faitB) faitB.onclick = () => {
    if(q && piCarte.a){
      if(piChoix === null){
        const zone = c.querySelector('.pi-sync-choix');
        zone.classList.add('vide'); setTimeout(() => zone.classList.remove('vide'), 900);
        return;
      }
      const com = (c.querySelector('.pi-sync-com') || {}).value || '';
      roomRef.child('plaisirsReponses').push({ de: me.id, pour: piAutreId(), qid: piCarte.id, q: piCarte.t, a: piCarte.a,
        choix: piChoix, rep: piCarte.a[piChoix], com: com.trim().slice(0, 300) || null, sync: true, ts: Date.now(), valide: null });
      if(typeof notifyPartner === 'function')
        notifyPartner('💞 ' + me.name + ' a répondu à une question HOT', 'Devine sa réponse dans Plaisirs Intimes pour gagner des points !', 'plaisirs');
    }
    else if(q){
      const champ = c.querySelector('.pi-champ');
      if(!piEnvoyerReponse(champ.value)){
        champ.classList.add('vide'); champ.placeholder = 'Écris ta réponse avant de l’envoyer…'; champ.focus();
        setTimeout(() => champ.classList.remove('vide'), 900);
        return;
      }
    }
    else {
      roomRef.child('plaisirsReponses').push({ de: me.id, pour: piAutreId(), qid: piCarte.id, q: piCarte.t, rep: '🔥 Défi réalisé', defi: true, ts: Date.now(), valide: null });
      if(typeof notifyPartner === 'function')
        notifyPartner('🌶️ ' + me.name + ' a relevé un défi HOT', 'Ouvre Plaisirs Intimes pour le valider.', 'plaisirs');
    }
    piCarte.fait = true; piTirer(piCarte.mode);
  };
  c.querySelector('[data-pi-passer]').onclick = () => piPasser(() => piTirer(piCarte.mode));
  // Changer de jeu sans avoir fait la carte = passer aussi.
  c.querySelector('[data-pi-retour]').onclick = () => {
    if(piCarte.fait) { piCarte = null; piDessiner(); return; }
    piPasser(() => { piCarte = null; piDessiner(); });
  };
}

// ---------- passes (5 par jour, puis malus) ----------
function piJour(){ return typeof qdjParis === 'function' ? qdjParis(new Date()).jour : new Date().toISOString().slice(0, 10); }
function piNbPasses(){
  const p = state && state.plaisirsPasses && state.plaisirsPasses[me.id];
  return (p && p[piJour()]) || 0;
}
function piTextePasses(){
  const reste = PI_PASSES - piNbPasses();
  return reste > 0 ? '(' + reste + ' restante' + (reste > 1 ? 's' : '') + ' aujourd’hui)' : '(−' + PI_MALUS + ' pts)';
}
function piPasser(suite){
  if(piNbPasses() < PI_PASSES){
    roomRef.child('plaisirsPasses/' + me.id + '/' + piJour()).transaction(n => (n || 0) + 1);
    suite();
    return;
  }
  // Plus de passe gratuite : on demande l'accord pour perdre des points.
  const el = ptEcran('pi-malus');
  el.className = 'env-voile pi-voile';
  el.innerHTML = '<div class="env-pop pi-pop"><div class="env-pop-ic">⚠️</div><h2>Plus de passe gratuite</h2>'
    + '<p>Tu as déjà passé <b>' + PI_PASSES + ' cartes</b> aujourd’hui.</p>'
    + '<p>Si tu passes encore, tu acceptes de <b>perdre ' + PI_MALUS + ' points</b>.</p>'
    + '<button type="button" class="btn-primary" data-pi-relever>Je relève le défi 🔥</button>'
    + '<button type="button" class="btn-ghost" data-pi-accepte>Je passe quand même (−' + PI_MALUS + ' pts)</button></div>';
  el.querySelector('[data-pi-relever]').onclick = () => el.remove();
  el.querySelector('[data-pi-accepte]').onclick = () => {
    el.remove();
    roomRef.child('plaisirsPasses/' + me.id + '/' + piJour()).transaction(n => (n || 0) + 1);
    roomRef.child('scores/' + me.id).transaction(sc => (sc || 0) - PI_MALUS);
    const hk = roomRef.child('history').push().key;
    roomRef.child('history/' + hk).set({ who: me.name, cat: 'plaisirs', text: 'Plaisirs Intimes — carte passée', pts: -PI_MALUS, validated: true, ts: Date.now() });
    suite();
  };
}

function piTirer(mode){
  if(typeof PLAISIRS === 'undefined' || !PLAISIRS[mode] || !PLAISIRS[mode].length) return;
  // Limite : 5 cartes envoyées en attente de validation par personne.
  if(piLimiteAtteinte()){ piCarte = null; piDessiner(); return; }
  const vus = (state.plaisirsVus && state.plaisirsVus[mode]) || {};
  const jouables = PLAISIRS[mode].filter(piCarteJouable);
  if(!jouables.length) return;
  let dispo = jouables.filter(x => !vus[x.id] && (!piCarte || x.id !== piCarte.id));
  const ref = roomRef.child('plaisirsVus/' + mode);
  if(!dispo.length){                     // tout est sorti : on repart à zéro
    ref.remove();
    dispo = jouables.filter(x => !piCarte || x.id !== piCarte.id);
    if(!dispo.length) dispo = jouables;
  }
  const x = dispo[Math.floor(Math.random() * dispo.length)];
  ref.child(x.id).set(true);
  piCarte = { mode, id: x.id, t: x.t, a: x.a || null };
  piChoix = null;
  piDessiner();
}

(function(){
  const t = document.getElementById('pi-tuile');
  if(t) t.addEventListener('click', piOuvrir);
})();
