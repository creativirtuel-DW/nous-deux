/**
 * Nous Deux — le « mode HOT » (contenus réservés aux adultes)
 * ==============================================================
 * Verrouillé par défaut. Il se déverrouille quand L'UN OU L'AUTRE atteint
 * MC_SEUIL points (meilleur des deux scores, depuis le 18/11/2026), et reste
 * ensuite déverrouillé pour de bon (rooms/$room/modeCouple/debloque),
 * même si les scores redescendent.
 *
 * Tant qu'il est verrouillé :
 *   · les tuiles Cap ou pas et Soirée guidée sont grisées (pastille 🔥) ;
 *   · la pioche ne sort que les cartes sans « adulte:true » (cards-data.js) ;
 *   · la Battle ne tire qu'UNE question « coquin » (au lieu de 2) ;
 *   · la question du jour saute la catégorie « coquin ».
 *
 * Le même seuil ouvre le jeu « Plaisirs Intimes » (plaisirs.js : piDebloque = mcDebloque).
 * Au déblocage : grande annonce animée, une fois par téléphone.
 *
 * Dev mod : modeCouple/manuel = 'verrouille' | 'debloque' force l'état
 * (pour tester), sans rien effacer.
 */

const MC_SEUIL = 300;
const MC_TUILES = ['gage', 'soiree'];   // tuiles entièrement réservées au mode HOT (Cap ou pas, Soirée guidée)

let mcEcritureEnCours = false;

// Meilleur des deux scores : il suffit que L'UN des deux atteigne le seuil.
function mcTotal(){
  const s = (state && state.scores) || {};
  return Math.max(s.p1 || 0, s.p2 || 0);
}
// Prénom de celui / celle qui mène (pour l'annonce).
function mcMeneur(){
  const s = (state && state.scores) || {}, p = (state && state.players) || {};
  return (s.p2 || 0) > (s.p1 || 0) ? p.p2 : p.p1;
}

// Vrai si les contenus adultes sont accessibles.
function mcDebloque(){
  if(!state) return false;
  const m = state.modeCouple || {};
  if(m.manuel === 'verrouille') return false;
  if(m.manuel === 'debloque') return true;
  return !!m.debloque || mcTotal() >= MC_SEUIL;
}

// Le seuil est atteint pour la première fois : on l'inscrit dans la base,
// une seule fois (transaction), pour que le mode reste ouvert ensuite.
function mcEnregistrerSiAtteint(){
  if(!state || mcEcritureEnCours) return;
  const m = state.modeCouple || {};
  if(m.debloque || mcTotal() < MC_SEUIL) return;
  mcEcritureEnCours = true;
  roomRef.child('modeCouple/debloque').transaction(v => v ? undefined : Date.now())
    .then(res => {
      mcEcritureEnCours = false;
      if(res && res.committed) notifyPartner('🔥 Mode HOT débloqué',
        (mcMeneur() || 'L’un de vous') + ' a atteint ' + MC_SEUIL + ' points : sujets intimes et nouveau jeu Plaisirs Intimes ouverts !', 'mode-couple');
    }, () => { mcEcritureEnCours = false; });
}

// Garde-fou pour les modules : une carte / question est-elle autorisée ?
function mcCarteAutorisee(c){ return mcDebloque() || !(c && c.adulte); }

function mcAnnonceCle(){ return 'nousdeux_hot_vu_' + roomCode; }   // nouvelle annonce (18/11/2026)
function mcAnnonceVue(){ try{ return localStorage.getItem(mcAnnonceCle()) === '1'; }catch(e){ return true; } }
function mcMarquerAnnonceVue(){ try{ localStorage.setItem(mcAnnonceCle(), '1'); }catch(e){} }

// Message plein écran (#mc-plein, créé à la demande) :
//   'verrou' → on a touché une tuile bloquée : explication + progression ;
//   'debloque' → annonce unique, sur chaque téléphone, quand le seuil est atteint.
let mcPleinOuvert = null;

function mcSignalerVerrou(){ mcPleinOuvert = 'verrou'; renderMcPlein(); }
function mcFermerPlein(){
  if(mcPleinOuvert === 'debloque') mcMarquerAnnonceVue();
  mcPleinOuvert = null;
  renderMcPlein();
}
function mcRevoirAnnonce(){ mcPleinOuvert = 'debloque'; renderMcPlein(); }   // dev mod

// Grande annonce animée du déblocage.
function mcAnnonceHtml(){
  const parts = ['🔥', '🌶️', '💋', '❤️', '✨', '🔥', '💦', '🌶️', '✨', '💋', '🔥', '❤️'];
  const pluie = parts.map((e, i) => '<span style="left:' + (4 + i * 8) + '%;animation-delay:' + (i * 0.23).toFixed(2) + 's;--d:' + (2.6 + (i % 4) * 0.5) + 's">' + e + '</span>').join('');
  const qui = mcMeneur();
  return '<div class="hot-annonce">'
    + '<div class="hot-rayons" aria-hidden="true"></div><div class="hot-pluie" aria-hidden="true">' + pluie + '</div>'
    + '<div class="hot-corps">'
    + '<div class="hot-flamme">🔥</div>'
    + '<div class="hot-sur">' + MC_SEUIL + ' points atteints' + (qui ? ' par ' + escapeHtml(qui) : '') + ' !</div>'
    + '<h2 class="hot-titre">Mode HOT<br>débloqué !</h2>'
    + '<div class="hot-point"><span>🔓</span><p><b>Des sujets plus intimes</b> s’ouvrent dans tous vos jeux : cartes, Battle, pensée du jour, Cap ou pas, Soirée guidée…</p></div>'
    + '<div class="hot-point"><span>🌶️</span><p><b>Nouveau jeu à tester : « Plaisirs Intimes »</b> — des questions très explicites et des défis brûlants. Retrouvez-le sur la case <b>HOT</b> de l’accueil.</p></div>'
    + '<button class="hot-btn" data-mc-tester>Tester Plaisirs Intimes 🌶️</button>'
    + '<button class="hot-btn ghost" data-mc-fermer>Plus tard</button>'
    + '</div></div>';
}

function renderMcPlein(){
  let el = document.getElementById('mc-plein');
  if(!mcPleinOuvert){ if(el) el.remove(); return; }
  if(!el){
    el = document.createElement('div');
    el.id = 'mc-plein';
    document.body.appendChild(el);
  }
  const total = mcTotal();
  const reste = Math.max(0, MC_SEUIL - total);
  const pct = Math.min(100, Math.round(total / MC_SEUIL * 100));
  el.classList.toggle('hot', mcPleinOuvert === 'debloque');
  if(mcPleinOuvert === 'debloque'){
    el.innerHTML = mcAnnonceHtml();
    el.querySelectorAll('[data-mc-fermer]').forEach(b => b.addEventListener('click', mcFermerPlein));
    el.querySelector('[data-mc-tester]').addEventListener('click', () => {
      mcFermerPlein();
      if(typeof piOuvrir === 'function') piOuvrir();
    });
    return;
  }
  const contenu = '<div class="mc-plein-ic">🔥</div><h2>Mode HOT à débloquer</h2>'
      + '<p>Il se débloque dès que <b>l’un de vous deux</b> atteint <b>' + MC_SEUIL + ' points</b>. Au programme : des sujets plus intimes dans tous les jeux et un nouveau jeu, « Plaisirs Intimes ».</p>'
      + '<div class="mc-jauge"><div class="mc-jauge-plein" style="width:' + pct + '%"></div></div>'
      + '<div class="mc-plein-legende">Meilleur score : ' + total + ' / ' + MC_SEUIL + ' points · encore ' + reste + ' point' + (reste > 1 ? 's' : '') + '</div>'
      + '<button class="mc-plein-btn" data-mc-fermer>Continuer à jouer</button>';
  el.innerHTML = '<button type="button" class="qdj-fermer" data-mc-fermer aria-label="Fermer">✕</button>'
    + '<div class="mc-plein-corps">' + contenu + '</div>';
  el.querySelectorAll('[data-mc-fermer]').forEach(b => b.addEventListener('click', mcFermerPlein));
}

// Dev mod, temporaire : mesures d'écran pour traquer la bande en bas sur iPhone.
function mcMesuresEcran(){
  const sonde = document.createElement('div');
  sonde.style.cssText = 'position:fixed;left:0;bottom:0;width:1px;height:0;padding-bottom:env(safe-area-inset-bottom);visibility:hidden';
  document.body.appendChild(sonde);
  const zoneGeste = sonde.offsetHeight;
  sonde.remove();
  const app = document.getElementById('app').getBoundingClientRect();
  const installee = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
  return '📏 écran ' + screen.width + '×' + screen.height
    + ' · page ' + window.innerWidth + '×' + window.innerHeight
    + ' · visible ' + (window.visualViewport ? Math.round(window.visualViewport.height) : '?')
    + ' · html ' + document.documentElement.clientHeight
    + ' · zone geste ' + zoneGeste
    + ' · trou ' + getComputedStyle(document.documentElement).getPropertyValue('--trou').trim()
    + ' · bas appli ' + Math.round(app.bottom)
    + ' · ' + (installee ? 'installée' : 'navigateur');
}

function mcForcer(valeur){
  roomRef.child('modeCouple/manuel').set(valeur || null);
}

// ---------- rendu ----------
function renderModeCouple(){
  mcEnregistrerSiAtteint();
  const ouvert = mcDebloque();

  // Tuiles réservées : grisées avec un cadenas tant que le mode est fermé.
  $$('.cat-btn').forEach(btn => {
    const reserve = MC_TUILES.indexOf(btn.dataset.cat) !== -1;
    btn.classList.toggle('locked', reserve && !ouvert);
    let pastille = btn.querySelector('.cat-lock');
    if(reserve && !ouvert){
      if(!pastille){
        pastille = document.createElement('span');
        pastille.className = 'cat-lock';
        btn.appendChild(pastille);
      }
      pastille.textContent = '🔥 ' + MC_SEUIL + ' pts';
    }else if(pastille){
      pastille.remove();
    }
  });

  // Annonce plein écran unique quand le mode vient d'être débloqué.
  if(ouvert && !mcAnnonceVue() && !mcPleinOuvert){ mcPleinOuvert = 'debloque'; renderMcPlein(); }
  if(!ouvert && mcPleinOuvert === 'debloque'){ mcPleinOuvert = null; renderMcPlein(); }
  if(ouvert && mcPleinOuvert === 'verrou'){ mcPleinOuvert = null; renderMcPlein(); }

  // Plus d'encadré sur l'accueil : seul le dev mod y garde ses outils.
  const b = $('#mc-bandeau');
  if(!b) return;
  const admin = isAdminUnlocked();
  if(!admin || !accueilVisible()){ b.style.display = 'none'; return; }

  const m = (state && state.modeCouple) || {};
  b.style.display = '';
  b.className = 'mc-bandeau';
  b.innerHTML = '<div class="mc-admin" style="margin:0;padding:0;border:0">Dev mod · Mode HOT ' + (ouvert ? 'débloqué' : 'bloqué') + ' (' + mcTotal() + '/' + MC_SEUIL + ')'
    + (m.manuel ? ' · forcé « ' + (m.manuel === 'verrouille' ? 'verrouillé' : 'déverrouillé') + ' »' : '') + ' · '
    + '<button class="qdj-lien" data-mc="verrouille">verrouiller</button> · '
    + '<button class="qdj-lien" data-mc="debloque">déverrouiller</button> · '
    + '<button class="qdj-lien" data-mc="">automatique</button> · '
    + '<button class="qdj-lien" data-mc-annonce>revoir l’annonce</button></div>'
    + '<div class="mc-admin mc-mesures">' + mcMesuresEcran() + '</div>';
  b.querySelectorAll('[data-mc]').forEach(el => el.addEventListener('click', () => mcForcer(el.dataset.mc)));
  b.querySelector('[data-mc-annonce]').addEventListener('click', mcRevoirAnnonce);
}
