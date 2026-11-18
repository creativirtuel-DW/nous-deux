/**
 * Nous Deux — mode de jeu « Plaisirs Intimes » (monde 3 du Parcours : Fusionnels)
 * ===============================================================================
 * Se débloque quand L'UN OU L'AUTRE atteint PI_SEUIL points (début du monde 3).
 * Une case « HOT » apparaît alors sur l'accueil ; elle ouvre un mode aux
 * couleurs chaudes avec deux choix : Question (très explicite) ou Défi (très HOT).
 *
 * ⚠️ PAS ENCORE ACCESSIBLE : PI_ACTIF = false → la case n'apparaît pour personne
 * (sauf en dev mod, pour l'aperçu). Passer PI_ACTIF à true pour l'ouvrir.
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
const PI_ACTIF = false;
const PI_SEUIL = 250;          // début du monde 3 « Fusionnels » (parcours.js)
const PI_PASSES = 5;           // passes gratuites par jour
const PI_MALUS = 20;           // points perdus par passe au-delà

let piOuvert = false;          // plein écran ouvert
let piCarte = null;            // { mode, id, t } carte affichée

function piAtteint(){
  const s = (state && state.scores) || {};
  return Math.max(s.p1 || 0, s.p2 || 0) >= PI_SEUIL;
}
function piDebloque(){ return PI_ACTIF && piAtteint(); }
function piVisible(){ return piDebloque() || (typeof isAdminUnlocked === 'function' && isAdminUnlocked()); }

// ---------- case de l'accueil ----------
function renderPlaisirs(){
  const t = document.getElementById('pi-tuile');
  if(!t || !state || !me || !me.id) return;
  if(piOuvert && !piCarte) piDessiner();
  const vis = piVisible() && accueilVisible();
  t.style.display = vis ? '' : 'none';
  if(!vis) return;
  const dev = !piDebloque();
  const n = piAValider().length;
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
  roomRef.child('plaisirsReponses/' + k + '/valide').set(Date.now());
  if(typeof notifyPartner === 'function')
    notifyPartner('✓ Réponse validée', me.name + ' a lu et validé ta réponse 🔥', 'plaisirs');
}
function piBlocValider(){
  const l = piAValider();
  if(!l.length) return '';
  return '<section class="pi-valider"><h3>✍️ ' + escapeHtml(piNomAutre()) + ' t’a répondu</h3>'
    + l.map(r => '<div class="pi-rep"><div class="pi-rep-q">💬 ' + escapeHtml(r.q || '') + '</div>'
      + '<div class="pi-rep-txt">« ' + escapeHtml(r.rep || '') + ' »</div>'
      + '<button type="button" class="pi-btn" data-pi-valider="' + r.k + '">✓ Je valide sa réponse</button></div>').join('')
    + '</section>';
}

// ---------- plein écran ----------
function piOuvrir(){
  if(!piVisible()) return;
  piOuvert = true; piCarte = null;
  const el = ptEcran('pi-plein');
  el.innerHTML = '<div class="pi-flammes" aria-hidden="true"></div>'
    + '<button type="button" class="qdj-fermer" aria-label="Fermer" data-pi-fermer>✕</button>'
    + '<div class="pi-corps" id="pi-corps"></div>';
  el.querySelector('[data-pi-fermer]').onclick = piFermer;
  piDessiner();
}
function piFermer(){
  piOuvert = false; piCarte = null;
  const el = document.getElementById('pi-plein'); if(el) el.remove();
}

function piDessiner(){
  const c = document.getElementById('pi-corps');
  if(!c) return;
  if(!piCarte){
    c.innerHTML = '<div class="pi-logo">🔥</div>'
      + '<h2 class="pi-titre">Plaisirs Intimes</h2>'
      + '<p class="pi-sous">Rien que vous deux. Choisis ton jeu…</p>'
      + (piDebloque() ? '' : '<p class="pi-dev">🔧 Aperçu dev mod : ce mode est encore verrouillé pour vous deux.</p>')
      + piBlocValider()
      + (piEnAttente().length ? '<p class="pi-attente">⏳ ' + piEnAttente().length + (piEnAttente().length > 1 ? ' réponses attendent' : ' réponse attend') + ' la validation de ' + escapeHtml(piNomAutre()) + '</p>' : '')
      + '<button type="button" class="pi-choix" data-pi-mode="questions"><span>💬</span><b>Question</b><small>Une question très explicite : réponds par écrit, sans tabou.</small></button>'
      + '<button type="button" class="pi-choix defi" data-pi-mode="defis"><span>🔥</span><b>Défi</b><small>Un défi très HOT à réaliser, maintenant.</small></button>';
    c.querySelectorAll('[data-pi-mode]').forEach(b => b.onclick = () => piTirer(b.dataset.piMode));
    c.querySelectorAll('[data-pi-valider]').forEach(b => b.onclick = () => piValider(b.dataset.piValider));
    return;
  }
  const q = piCarte.mode === 'questions';
  c.innerHTML = '<div class="pi-carte ' + (q ? '' : 'defi') + '">'
    + '<div class="pi-carte-type">' + (q ? '💬 Question' : '🔥 Défi') + '</div>'
    + '<p class="pi-carte-texte">' + escapeHtml(piCarte.t) + '</p>'
    + '<div class="pi-carte-pied">Plaisirs Intimes</div></div>'
    + (q ? '<textarea class="pi-champ" maxlength="600" rows="4" placeholder="Écris ta réponse… ' + escapeHtml(piNomAutre()) + ' la lira et la validera."></textarea>' : '')
    + '<button type="button" class="pi-btn" data-pi-fait>' + (q ? '📨 Envoyer ma réponse · question suivante' : '✓ Défi réalisé · défi suivant') + '</button>'
    + '<button type="button" class="pi-btn ghost" data-pi-passer>' + (q ? 'Passer cette question' : 'Passer ce défi') + ' <small>' + piTextePasses() + '</small></button>'
    + '<button type="button" class="pi-btn ghost" data-pi-retour>Changer de jeu</button>';
  c.querySelector('[data-pi-fait]').onclick = () => {
    if(q){
      const champ = c.querySelector('.pi-champ');
      if(!piEnvoyerReponse(champ.value)){
        champ.classList.add('vide'); champ.placeholder = 'Écris ta réponse avant de l’envoyer…'; champ.focus();
        setTimeout(() => champ.classList.remove('vide'), 900);
        return;
      }
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
  const vus = (state.plaisirsVus && state.plaisirsVus[mode]) || {};
  let dispo = PLAISIRS[mode].filter(x => !vus[x.id] && (!piCarte || x.id !== piCarte.id));
  const ref = roomRef.child('plaisirsVus/' + mode);
  if(!dispo.length){                     // tout est sorti : on repart à zéro
    ref.remove();
    dispo = PLAISIRS[mode].filter(x => !piCarte || x.id !== piCarte.id);
  }
  const x = dispo[Math.floor(Math.random() * dispo.length)];
  ref.child(x.id).set(true);
  piCarte = { mode, id: x.id, t: x.t };
  piDessiner();
}

(function(){
  const t = document.getElementById('pi-tuile');
  if(t) t.addEventListener('click', piOuvrir);
})();
