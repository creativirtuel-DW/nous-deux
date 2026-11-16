/**
 * Nous Deux — la carte piochée, en plein écran
 * ============================================
 * Quand je pioche une carte (Question, Défi, Cap ou pas), elle s'ouvre en
 * plein écran : un cœur apparaît, bat, s'ouvre en deux et révèle la carte,
 * avec ses boutons (répondre, c'est fait, je passe, photo…).
 *
 * L'écran se ferme tout seul dès que la carte quitte l'état « à jouer »
 * (envoyée, faite ou passée). La croix le ferme sans rien jouer : la carte
 * reste dans la liste sous les tuiles, et un appui sur son texte la rouvre.
 *
 * Le rendu global est rejoué à chaque notification Firebase : on ne
 * reconstruit la carte que si elle a changé (signature), sinon le champ de
 * réponse serait vidé en pleine frappe.
 */

let cpCle = null;         // clé de la carte affichée en plein écran
let cpAnimer = false;     // jouer l'animation d'ouverture au prochain rendu
let cpSignature = '';

function cpOuvrir(cle, animer){
  cpCle = cle;
  cpAnimer = !!animer;
  cpSignature = '';
  renderCartePlein();
}

function cpFermer(){
  cpCle = null;
  cpSignature = '';
  renderCartePlein();
}

const CP_COEUR = 'M50 84 C 22 62, 8 44, 17 29 C 26 14, 45 16, 50 33 C 55 16, 74 14, 83 29 C 92 44, 78 62, 50 84 Z';

function cpRevelation(){
  const moitie = cote => '<svg class="cp-moitie cp-' + cote + '" viewBox="0 0 100 100">'
    + '<defs><linearGradient id="cpGrad-' + cote + '" x1="0" y1="0" x2="1" y2="1">'
    + '<stop offset="0" stop-color="#FF7A8E"/><stop offset="1" stop-color="#C8102E"/></linearGradient></defs>'
    + '<path d="' + CP_COEUR + '" fill="url(#cpGrad-' + cote + ')" stroke="#FFB38A" stroke-width="2.5" stroke-linejoin="round"/></svg>';
  let eclats = '';
  for(let i = 0; i < 10; i++){
    eclats += '<span class="cp-eclat" style="--a:' + (i * 36) + 'deg;--l:' + (90 + (i % 3) * 30) + 'px">♥</span>';
  }
  return '<div class="cp-revele" aria-hidden="true">' + moitie('g') + moitie('d') + eclats + '</div>';
}

function renderCartePlein(){
  const ecran = $('#carte-plein');
  const scene = $('#cp-scene');
  if(!ecran || !scene) return;

  const p = cpCle && state && state.pendingCards && state.pendingCards[cpCle];
  // Plus rien à jouer (carte envoyée, faite, passée ou annulée) : on ferme.
  if(!p || p.by !== me.id || p.status === 'review'){
    cpCle = null;
    cpSignature = '';
    ecran.style.display = 'none';
    scene.innerHTML = '';
    return;
  }

  const signature = [cpCle, p.status, getSkipCount(me.id, p.cat), !!p.photoData].join('|');
  if(signature === cpSignature) return;
  cpSignature = signature;

  ecran.style.display = '';
  scene.innerHTML = '';
  const animer = cpAnimer;
  cpAnimer = false;

  if(animer) scene.insertAdjacentHTML('beforeend', cpRevelation());
  const carte = document.createElement('div');
  carte.className = 'cp-carte' + (animer ? ' cp-anime' : '');
  carte.appendChild(construireCarteMine(cpCle, p));
  scene.appendChild(carte);
  // Le cœur s'est ouvert : on le retire pour ne pas gêner les appuis.
  if(animer) setTimeout(() => { const r = scene.querySelector('.cp-revele'); if(r) r.remove(); }, 1500);
}
