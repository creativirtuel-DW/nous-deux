/**
 * Nous Deux — le « mode HOT » (contenus réservés aux adultes)
 * ==============================================================
 * Verrouillé par défaut. Il se déverrouille quand le couple a cumulé
 * MC_SEUIL points à deux (score de l'un + score de l'autre), et reste
 * ensuite déverrouillé pour de bon (rooms/$room/modeCouple/debloque),
 * même si les scores redescendent.
 *
 * Tant qu'il est verrouillé :
 *   · les tuiles Cap ou pas et Soirée guidée sont grisées (pastille 🔥) ;
 *   · la pioche ne sort que les cartes sans « adulte:true » (cards-data.js) ;
 *   · la Battle ne tire qu'UNE question « coquin » (au lieu de 2) ;
 *   · la question du jour saute la catégorie « coquin ».
 *
 * Dev mod : modeCouple/manuel = 'verrouille' | 'debloque' force l'état
 * (pour tester), sans rien effacer.
 */

const MC_SEUIL = 300;
const MC_TUILES = ['gage', 'soiree'];   // tuiles entièrement réservées au mode HOT (Cap ou pas, Soirée guidée)

let mcEcritureEnCours = false;

function mcTotal(){
  const s = (state && state.scores) || {};
  return (s.p1 || 0) + (s.p2 || 0);
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
        'Vous avez atteint ' + MC_SEUIL + ' points à deux : les contenus coquins sont ouverts !', 'mode-couple');
    }, () => { mcEcritureEnCours = false; });
}

// Garde-fou pour les modules : une carte / question est-elle autorisée ?
function mcCarteAutorisee(c){ return mcDebloque() || !(c && c.adulte); }

function mcAnnonceCle(){ return 'nousdeux_mc_vu_' + roomCode; }
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
  const contenu = mcPleinOuvert === 'debloque'
    ? '<div class="mc-plein-ic">🔥</div><h2>Mode HOT débloqué !</h2>'
      + '<p>Cap ou pas, Soirée guidée, cartes et questions coquines sont maintenant ouverts.</p>'
      + '<button class="mc-plein-btn" data-mc-fermer>C’est parti</button>'
    : '<div class="mc-plein-ic">🔥</div><h2>Mode HOT à débloquer</h2>'
      + '<p>Débloquez-le en atteignant au minimum <b>' + MC_SEUIL + ' points</b> à deux.</p>'
      + '<div class="mc-jauge"><div class="mc-jauge-plein" style="width:' + pct + '%"></div></div>'
      + '<div class="mc-plein-legende">' + total + ' / ' + MC_SEUIL + ' points · encore ' + reste + ' point' + (reste > 1 ? 's' : '') + '</div>'
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
    + '<button class="qdj-lien" data-mc="">automatique</button></div>'
    + '<div class="mc-admin mc-mesures">' + mcMesuresEcran() + '</div>';
  b.querySelectorAll('[data-mc]').forEach(el => el.addEventListener('click', () => mcForcer(el.dataset.mc)));
}
