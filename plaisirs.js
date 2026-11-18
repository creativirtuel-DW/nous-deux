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
 */
const PI_ACTIF = false;
const PI_SEUIL = 250;          // début du monde 3 « Fusionnels » (parcours.js)

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
  const vis = piVisible() && accueilVisible();
  t.style.display = vis ? '' : 'none';
  if(!vis) return;
  const dev = !piDebloque();
  const html = '<span class="pi-tuile-hot">HOT</span>'
    + '<span class="pi-tuile-txt"><strong>Plaisirs Intimes</strong><small>' + (dev ? 'Aperçu dev mod · verrouillé pour vous deux' : 'Questions & défis très chauds… 🔥') + '</small></span>'
    + '<span class="pi-tuile-ic">🌶️</span>';
  if(t.innerHTML !== html) t.innerHTML = html;
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
      + '<button type="button" class="pi-choix" data-pi-mode="questions"><span>💬</span><b>Question</b><small>Une question très explicite, à laquelle répondre sans tabou.</small></button>'
      + '<button type="button" class="pi-choix defi" data-pi-mode="defis"><span>🔥</span><b>Défi</b><small>Un défi très HOT à réaliser, maintenant.</small></button>';
    c.querySelectorAll('[data-pi-mode]').forEach(b => b.onclick = () => piTirer(b.dataset.piMode));
    return;
  }
  const q = piCarte.mode === 'questions';
  c.innerHTML = '<div class="pi-carte ' + (q ? '' : 'defi') + '">'
    + '<div class="pi-carte-type">' + (q ? '💬 Question' : '🔥 Défi') + '</div>'
    + '<p class="pi-carte-texte">' + escapeHtml(piCarte.t) + '</p>'
    + '<div class="pi-carte-pied">Plaisirs Intimes</div></div>'
    + '<button type="button" class="pi-btn" data-pi-autre>' + (q ? 'Une autre question' : 'Un autre défi') + '</button>'
    + '<button type="button" class="pi-btn ghost" data-pi-retour>Changer de jeu</button>';
  c.querySelector('[data-pi-autre]').onclick = () => piTirer(piCarte.mode);
  c.querySelector('[data-pi-retour]').onclick = () => { piCarte = null; piDessiner(); };
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
