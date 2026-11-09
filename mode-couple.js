/**
 * Nous Deux — le « mode couple » (contenus réservés aux adultes)
 * ==============================================================
 * Verrouillé par défaut. Il se déverrouille quand le couple a cumulé
 * MC_SEUIL points à deux (score de l'un + score de l'autre), et reste
 * ensuite déverrouillé pour de bon (rooms/$room/modeCouple/debloque),
 * même si les scores redescendent.
 *
 * Tant qu'il est verrouillé :
 *   · les tuiles Soirée guidée et Défi Photo sont grisées (cadenas) ;
 *   · la pioche ne sort que les cartes sans « adulte:true » (cards-data.js) ;
 *   · la Battle ne tire aucune question « coquin » ;
 *   · la question du jour saute la catégorie « coquin ».
 *
 * Dev mod : modeCouple/manuel = 'verrouille' | 'debloque' force l'état
 * (pour tester), sans rien effacer.
 */

const MC_SEUIL = 300;
const MC_TUILES = ['soiree', 'photo'];   // tuiles entièrement réservées au mode couple

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
      if(res && res.committed) notifyPartner('🔓 Mode couple déverrouillé',
        'Vous avez atteint ' + MC_SEUIL + ' points à deux : les contenus coquins sont ouverts !', 'mode-couple');
    }, () => { mcEcritureEnCours = false; });
}

// Garde-fou pour les modules : une carte / question est-elle autorisée ?
function mcCarteAutorisee(c){ return mcDebloque() || !(c && c.adulte); }

function mcAnnonceCle(){ return 'nousdeux_mc_vu_' + roomCode; }
function mcAnnonceVue(){ try{ return localStorage.getItem(mcAnnonceCle()) === '1'; }catch(e){ return true; } }
function mcMarquerAnnonceVue(){ try{ localStorage.setItem(mcAnnonceCle(), '1'); }catch(e){} }

// Clic sur une tuile verrouillée : on montre le bandeau explicatif.
function mcSignalerVerrou(){
  const b = $('#mc-bandeau');
  if(!b) return;
  b.scrollIntoView({ behavior: 'smooth', block: 'center' });
  b.classList.remove('mc-secoue');
  void b.offsetWidth;            // relance l'animation
  b.classList.add('mc-secoue');
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
      pastille.textContent = '🔒 ' + MC_SEUIL + ' pts';
    }else if(pastille){
      pastille.remove();
    }
  });

  // Bandeau explicatif, sous les tuiles.
  const b = $('#mc-bandeau');
  if(!b) return;
  const picker = $('#cat-picker');
  if(picker && picker.style.display === 'none'){ b.style.display = 'none'; return; }

  const m = (state && state.modeCouple) || {};
  const admin = isAdminUnlocked();
  const outilsAdmin = admin
    ? '<div class="mc-admin">Dev mod · '
      + (m.manuel ? 'forcé « ' + (m.manuel === 'verrouille' ? 'verrouillé' : 'déverrouillé') + ' » · ' : '')
      + '<button class="qdj-lien" data-mc="verrouille">verrouiller</button> · '
      + '<button class="qdj-lien" data-mc="debloque">déverrouiller</button> · '
      + '<button class="qdj-lien" data-mc="">automatique</button></div>'
    : '';

  if(ouvert){
    if(mcAnnonceVue() && !admin){ b.style.display = 'none'; return; }
    b.style.display = '';
    b.className = 'mc-bandeau ouvert';
    b.innerHTML = mcAnnonceVue()
      ? '<div class="mc-ligne"><span class="mc-ic">🔓</span><div class="mc-txt"><strong>Mode couple déverrouillé</strong></div></div>' + outilsAdmin
      : '<div class="mc-ligne"><span class="mc-ic">🔓</span><div class="mc-txt"><strong>Mode couple déverrouillé !</strong>'
        + '<span>Soirée guidée, Défi Photo, cartes et questions coquines sont maintenant ouvertes.</span></div>'
        + '<button class="push-btn" id="mc-ok">Génial</button></div>' + outilsAdmin;
  }else{
    const total = mcTotal();
    const reste = Math.max(0, MC_SEUIL - total);
    const pct = Math.min(100, Math.round(total / MC_SEUIL * 100));
    b.style.display = '';
    b.className = 'mc-bandeau';
    b.innerHTML = '<div class="mc-ligne"><span class="mc-ic">🔒</span><div class="mc-txt">'
      + '<strong>Mode couple verrouillé</strong>'
      + '<span>Déverrouillez-le en atteignant au minimum <b>' + MC_SEUIL + ' points</b> à deux. '
      + 'Encore ' + reste + ' point' + (reste > 1 ? 's' : '') + '.</span></div></div>'
      + '<div class="mc-jauge"><div class="mc-jauge-plein" style="width:' + pct + '%"></div></div>'
      + '<div class="mc-jauge-legende">' + total + ' / ' + MC_SEUIL + ' points</div>'
      + outilsAdmin;
  }

  const ok = $('#mc-ok');
  if(ok) ok.addEventListener('click', () => { mcMarquerAnnonceVue(); renderModeCouple(); });
  b.querySelectorAll('[data-mc]').forEach(el => el.addEventListener('click', () => mcForcer(el.dataset.mc)));
}
