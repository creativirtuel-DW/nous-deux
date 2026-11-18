/**
 * Nous Deux — « Le Coffre Surprise » (ex-coffre du jour)
 * =================================
 * Petit coffre illuminé à côté de « Une pensée par jour ». Chacun peut l'ouvrir
 * UNE fois par jour (jour civil, heure de Paris). Récompense tirée au hasard :
 *   - points bonus (crédités tout de suite),
 *   - points malus (retirés tout de suite),
 *   - bon cadeau de 1 € ou 2 €, gardé dans l'appli ; dès 10 € cumulés on peut les
 *     envoyer au/à la partenaire, qui doit alors offrir un cadeau de 10 € minimum,
 *   - gage à réaliser dans la journée.
 * Les gages coquins ne sortent que si le Mode HOT est débloqué.
 *
 * Base :
 *   rooms/$room/coffreJour/<pid>/<AAAA-MM-JJ> = { type, pts, texte, ts, fait }
 *   rooms/$room/bons/<clé> = { pour, de, montant, ts, utilise }   (pour = qui le détient)
 *   rooms/$room/cadeaux/<clé> = { pour, de, montant, ts, offert }  (bons envoyés : cadeau à offrir)
 * Le tirage passe par une TRANSACTION : impossible d'ouvrir deux fois le même jour.
 */

const CJ_TYPES = [               // poids du tirage
  { type:'bonus', poids:35 },
  { type:'bon',   poids:25 },
  { type:'gage',  poids:20 },
  { type:'malus', poids:20 }
];
const CJ_BONUS = [ [5,30], [10,30], [15,20], [20,15], [30,5] ];   // [points, poids]
const CJ_MALUS = [ [5,50], [10,35], [15,15] ];

const CJ_BONS_EUROS = [ [1,70], [2,30] ];   // [montant en €, poids]
const CJ_SEUIL_EUROS = 10;                   // cagnotte à atteindre pour envoyer ses bons
const CJ_GAGES = [
  'Envoie un message tendre à {autre} avant ce soir', 'Fais un compliment sincère à {autre} aujourd’hui',
  'Prépare une petite surprise pour {autre} avant ce soir', 'Embrasse {autre} pendant 30 secondes à la prochaine occasion',
  'Prends une photo souvenir de vous deux aujourd’hui', 'Rends un service à {autre} sans qu’on te le demande',
  'Dis à {autre} trois choses que tu aimes chez lui/elle'
];
const CJ_GAGES_HOT = [
  'Envoie une photo coquine à {autre} avant ce soir', 'Porte une tenue sexy ce soir',
  'Murmure un fantasme à l’oreille de {autre} aujourd’hui', 'Pas de sous-vêtements aujourd’hui… et préviens {autre}',
  'Envoie un message très coquin à {autre} avant 18 h'
];

let cjOuvert = false;      // page du coffre ouverte
let cjAnim = false;        // animation d'ouverture en cours

function cjAutreId(){ return me && me.id === 'p1' ? 'p2' : 'p1'; }
function cjNomAutre(){ return (state && state.players && state.players[cjAutreId()]) || 'ton/ta partenaire'; }
function cjJour(){ return qdjParis(new Date()).jour; }
function cjDuJour(){ const c = state && state.coffreJour && state.coffreJour[me.id]; return c && c[cjJour()]; }
function cjHot(){ return typeof mcDebloque === 'function' && mcDebloque(); }
function cjTexte(t){ return t.replace(/\{autre\}/g, cjNomAutre()); }

function cjPioche(liste){            // [[valeur, poids], …] ou [{…, poids}]
  const tot = liste.reduce((s, x) => s + (Array.isArray(x) ? x[1] : x.poids), 0);
  let r = Math.random() * tot;
  for(const x of liste){ r -= Array.isArray(x) ? x[1] : x.poids; if(r < 0) return x; }
  return liste[liste.length - 1];
}
function cjAuHasard(a){ return a[Math.floor(Math.random() * a.length)]; }

function cjTirer(){
  const t = cjPioche(CJ_TYPES).type;
  if(t === 'bonus') return { type:t, pts: cjPioche(CJ_BONUS)[0] };
  if(t === 'malus') return { type:t, pts: -cjPioche(CJ_MALUS)[0] };
  if(t === 'bon')  return { type:t, pts:0, montant: cjPioche(CJ_BONS_EUROS)[0] };
  const hot = cjHot() && Math.random() < 0.5;
  return { type:'gage', pts:0, texte: cjTexte(cjAuHasard(hot ? CJ_GAGES_HOT : CJ_GAGES)) };
}

// ---------- case de l'accueil ----------
function renderCoffreJour(){
  const t = document.getElementById('cj-tuile');
  if(!t || !state || !me || !me.id) return;
  t.style.display = accueilVisible() ? '' : 'none';
  const fait = !!cjDuJour();
  const html = cjCoffreSvg(false) + '<span class="cj-tuile-txt">' + (fait ? 'À demain' : 'Coffre<br>Surprise') + '</span>';
  if(t.dataset.sign !== String(fait)){
    t.dataset.sign = String(fait);
    t.innerHTML = html;
    t.classList.toggle('cj-dispo', !fait);
    t.classList.toggle('cj-fait', fait);
  }
  if(cjOuvert && !cjAnim) cjDessiner();
}

// ---------- le dessin du coffre ----------
// Trois couches superposées (même repère 120 × 100) : l'arrière (intérieur
// lumineux + couvercle), les trésors qui jaillissent, puis l'avant (la caisse).
// Les trésors passent DERRIÈRE l'avant : on les voit dépasser du coffre.
let cjNum = 0;
function cjCoffreSvg(ouvert){
  const n = ++cjNum, g = id => id + n;     // identifiants uniques (dégradés)
  const defs = '<defs>'
    + '<linearGradient id="' + g('o') + '" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFF1C1"/><stop offset=".45" stop-color="#F7C65A"/><stop offset="1" stop-color="#B9741F"/></linearGradient>'
    + '<linearGradient id="' + g('b') + '" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#A8432F"/><stop offset=".55" stop-color="#7A2A1E"/><stop offset="1" stop-color="#4A160F"/></linearGradient>'
    + '<linearGradient id="' + g('c') + '" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#C45A40"/><stop offset="1" stop-color="#7E2B20"/></linearGradient>'
    + '<radialGradient id="' + g('l') + '" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#FFF6D0"/><stop offset=".5" stop-color="#FFC94D"/><stop offset="1" stop-color="#B8641A" stop-opacity="0"/></radialGradient>'
    + '<linearGradient id="' + g('r') + '" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FF8FA3"/><stop offset="1" stop-color="#D6164A"/></linearGradient>'
    + '<linearGradient id="' + g('s') + '" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#C8F3FF"/><stop offset="1" stop-color="#3B9BD8"/></linearGradient>'
    + '</defs>';
  const O = 'url(#' + g('o') + ')';
  const rivets = (xs, y) => xs.map(x => '<circle cx="' + x + '" cy="' + y + '" r="1.6" fill="#FFF1C1" stroke="#9A5B17" stroke-width=".6"/>').join('');
  // arrière : lueur de l'intérieur + couvercle
  const arriere = '<svg class="cj-c cj-arriere" viewBox="0 0 120 100" aria-hidden="true">' + defs
    + '<ellipse class="cj-interieur" cx="60" cy="49" rx="47" ry="9" fill="#2A0D08"/>'
    + '<ellipse class="cj-lumiere" cx="60" cy="47" rx="52" ry="16" fill="url(#' + g('l') + ')"/>'
    + '<g class="cj-couvercle">'
    +   '<path d="M8 50 V32 Q8 8 60 8 Q112 8 112 32 V50 Z" fill="url(#' + g('c') + ')" stroke="#5A1C12" stroke-width="1.2"/>'
    +   '<path d="M12 46 V33 Q12 13 60 13 Q108 13 108 33 V46" fill="none" stroke="rgba(0,0,0,.22)" stroke-width="1"/>'
    +   '<path d="M20 15 Q60 6 100 15" fill="none" stroke="rgba(255,255,255,.28)" stroke-width="2.4" stroke-linecap="round"/>'
    +   '<path d="M8 50 V32 Q8 16 18 11 L26 10 V50 Z" fill="' + O + '"/>'
    +   '<path d="M112 50 V32 Q112 16 102 11 L94 10 V50 Z" fill="' + O + '"/>'
    +   '<rect x="52" y="8.5" width="16" height="41.5" fill="' + O + '"/>'
    +   '<rect x="8" y="44" width="104" height="6" fill="' + O + '"/>'
    +   rivets([13, 21, 99, 107], 47) + rivets([60], 18) + rivets([60], 30)
    +   '<path d="M60 22 l4 5 -4 5 -4 -5 z" fill="url(#' + g('r') + ')" stroke="#FFF1C1" stroke-width=".8"/>'
    + '</g></svg>';
  // trésors (HTML, au-dessus de l'arrière, sous l'avant)
  const menottes = '<svg viewBox="0 0 40 24" class="cj-menottes"><circle cx="9" cy="12" r="7" fill="none" stroke="#D8DDE6" stroke-width="3"/><circle cx="31" cy="12" r="7" fill="none" stroke="#D8DDE6" stroke-width="3"/><path d="M16 12 h2 m2 0 h2" stroke="#AEB6C2" stroke-width="2.4" stroke-linecap="round"/><circle cx="19" cy="12" r="1.6" fill="none" stroke="#AEB6C2" stroke-width="1.4"/><circle cx="22" cy="12" r="1.6" fill="none" stroke="#AEB6C2" stroke-width="1.4"/></svg>';
  // sextoys dessinés (on les devine parmi le reste)
  const vibro = '<svg viewBox="0 0 16 46" class="cj-jouet"><defs><linearGradient id="' + g('v') + '" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#FF9CC8"/><stop offset=".5" stop-color="#FF4F9A"/><stop offset="1" stop-color="#C21B66"/></linearGradient></defs>'
    + '<rect x="3" y="2" width="10" height="42" rx="5" fill="url(#' + g('v') + ')"/><path d="M3 30 H13 M3 33 H13" stroke="rgba(255,255,255,.55)" stroke-width="1"/><rect x="5.5" y="5" width="2" height="18" rx="1" fill="rgba(255,255,255,.45)"/></svg>';
  const lapin = '<svg viewBox="0 0 26 46" class="cj-jouet"><defs><linearGradient id="' + g('p') + '" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#C9A6FF"/><stop offset="1" stop-color="#7B3FE0"/></linearGradient></defs>'
    + '<path d="M5 44 V16 Q5 4 11 4 Q17 4 17 16 V44 Z" fill="url(#' + g('p') + ')"/><path d="M17 30 Q24 26 23 14 Q22 10 20 14 Q19 22 17 25 Z" fill="url(#' + g('p') + ')"/><rect x="7.5" y="7" width="2" height="16" rx="1" fill="rgba(255,255,255,.4)"/></svg>';
  const oeuf = '<svg viewBox="0 0 30 30" class="cj-jouet"><ellipse cx="11" cy="12" rx="8" ry="10" fill="#FF6FA8"/><ellipse cx="8.5" cy="8" rx="2.4" ry="3.2" fill="rgba(255,255,255,.5)"/><path d="M15 21 Q22 28 29 24" fill="none" stroke="#FF6FA8" stroke-width="1.6"/></svg>';
  const tresors = [               // [objet, gauche %, rotation, montée, délai ×]
    ['🎁', 15, -24, 26, 0],
    ['💎', 27, -14, 44, 1],
    [vibro, 37, -18, 40, 2],
    ['💶', 47, -6, 52, 3],
    [menottes, 59, 12, 46, 4],
    [lapin, 69, 20, 40, 5],
    ['🎁', 82, 18, 28, 6],
    ['💎', 54, 8, 30, 7],
    ['💎', 74, 28, 24, 8],
    ['💎', 22, -30, 22, 9],
    ['👙', 33, -28, 20, 10],
    [oeuf, 88, 30, 16, 11],
    ['💵', 64, -4, 22, 12],
    ['🪶', 44, 34, 18, 13]
  ];
  const milieu = '<div class="cj-tresors">' + tresors.map(t =>
    '<span class="cj-tr" style="--x:' + t[1] + '%;--r:' + t[2] + 'deg;--h:' + t[3] + ';--d:' + (0.25 + t[4] * 0.07) + 's">' + t[0] + '</span>').join('')
    + '<i class="cj-etincelle" style="--x:20%;--y:6%;--d:.9s"></i><i class="cj-etincelle" style="--x:78%;--y:2%;--d:1.3s"></i><i class="cj-etincelle" style="--x:50%;--y:-8%;--d:1.7s"></i></div>';
  // avant : la caisse
  const avant = '<svg class="cj-c cj-avant" viewBox="0 0 120 100" aria-hidden="true">' + defs
    + '<g class="cj-tas"><path d="M10 51 Q22 40 40 39 Q60 34 80 39 Q98 40 110 51 Z" fill="' + O + '"/>'
    + '<ellipse cx="44.5" cy="43.5" rx="3.2" ry="1.7" fill="' + O + '" stroke="#A8661A" stroke-width=".5"/><ellipse cx="73.3" cy="42.5" rx="3.2" ry="1.7" fill="' + O + '" stroke="#A8661A" stroke-width=".5"/><ellipse cx="63.2" cy="41.6" rx="3.2" ry="1.7" fill="' + O + '" stroke="#A8661A" stroke-width=".5"/><ellipse cx="21.1" cy="50.8" rx="3.2" ry="1.7" fill="' + O + '" stroke="#A8661A" stroke-width=".5"/><ellipse cx="19.3" cy="50.9" rx="3.2" ry="1.7" fill="' + O + '" stroke="#A8661A" stroke-width=".5"/><ellipse cx="22.1" cy="48.5" rx="3.2" ry="1.7" fill="' + O + '" stroke="#A8661A" stroke-width=".5"/><ellipse cx="53.4" cy="44.7" rx="3.2" ry="1.7" fill="' + O + '" stroke="#A8661A" stroke-width=".5"/><ellipse cx="26.9" cy="48.0" rx="3.2" ry="1.7" fill="' + O + '" stroke="#A8661A" stroke-width=".5"/><ellipse cx="71.2" cy="46.4" rx="3.2" ry="1.7" fill="' + O + '" stroke="#A8661A" stroke-width=".5"/><ellipse cx="66.8" cy="42.6" rx="3.2" ry="1.7" fill="' + O + '" stroke="#A8661A" stroke-width=".5"/><ellipse cx="101.9" cy="49.3" rx="3.2" ry="1.7" fill="' + O + '" stroke="#A8661A" stroke-width=".5"/><ellipse cx="91.5" cy="48.0" rx="3.2" ry="1.7" fill="' + O + '" stroke="#A8661A" stroke-width=".5"/><ellipse cx="28.7" cy="47.1" rx="3.2" ry="1.7" fill="' + O + '" stroke="#A8661A" stroke-width=".5"/><ellipse cx="43.1" cy="47.1" rx="3.2" ry="1.7" fill="' + O + '" stroke="#A8661A" stroke-width=".5"/><ellipse cx="31.9" cy="48.6" rx="3.2" ry="1.7" fill="' + O + '" stroke="#A8661A" stroke-width=".5"/><ellipse cx="72.2" cy="43.8" rx="3.2" ry="1.7" fill="' + O + '" stroke="#A8661A" stroke-width=".5"/><ellipse cx="64.2" cy="40.3" rx="3.2" ry="1.7" fill="' + O + '" stroke="#A8661A" stroke-width=".5"/><ellipse cx="21.2" cy="49.3" rx="3.2" ry="1.7" fill="' + O + '" stroke="#A8661A" stroke-width=".5"/><ellipse cx="75.9" cy="44.9" rx="3.2" ry="1.7" fill="' + O + '" stroke="#A8661A" stroke-width=".5"/><ellipse cx="43.6" cy="45.8" rx="3.2" ry="1.7" fill="' + O + '" stroke="#A8661A" stroke-width=".5"/><ellipse cx="55.9" cy="41.5" rx="3.2" ry="1.7" fill="' + O + '" stroke="#A8661A" stroke-width=".5"/><ellipse cx="85.9" cy="48.7" rx="3.2" ry="1.7" fill="' + O + '" stroke="#A8661A" stroke-width=".5"/><ellipse cx="37.5" cy="47.3" rx="3.2" ry="1.7" fill="' + O + '" stroke="#A8661A" stroke-width=".5"/><ellipse cx="62.2" cy="43.9" rx="3.2" ry="1.7" fill="' + O + '" stroke="#A8661A" stroke-width=".5"/><ellipse cx="80.2" cy="45.3" rx="3.2" ry="1.7" fill="' + O + '" stroke="#A8661A" stroke-width=".5"/><ellipse cx="102.3" cy="49.7" rx="3.2" ry="1.7" fill="' + O + '" stroke="#A8661A" stroke-width=".5"/>'
    + '<path d="M30 41 l3 3.5 -3 3.5 -3 -3.5 z" fill="url(#' + g('r') + ')"/><path d="M79 40 l3 3.5 -3 3.5 -3 -3.5 z" fill="url(#' + g('s') + ')"/><path d="M55 37.5 l2.6 3 -2.6 3 -2.6 -3 z" fill="url(#' + g('s') + ')"/><path d="M95 45 l2.4 2.8 -2.4 2.8 -2.4 -2.8 z" fill="url(#' + g('r') + ')"/><path d="M20 46 l2.4 2.8 -2.4 2.8 -2.4 -2.8 z" fill="url(#' + g('s') + ')"/>'
    + '<path d="M24 44 Q60 33 96 44" fill="none" stroke="rgba(255,255,255,.6)" stroke-width="1" stroke-linecap="round"/></g>'
    + '<path d="M8 50 H112 V88 Q112 95 104 95 H16 Q8 95 8 88 Z" fill="url(#' + g('b') + ')" stroke="#4A160F" stroke-width="1.2"/>'
    + '<path d="M8 66 H112 M8 81 H112" stroke="rgba(0,0,0,.28)" stroke-width="1"/>'
    + '<path d="M8 64.6 H112 M8 79.6 H112" stroke="rgba(255,255,255,.08)" stroke-width="1"/>'
    + '<rect x="8" y="50" width="104" height="7" fill="' + O + '"/>'
    + '<path d="M8 57 H26 V95 H16 Q8 95 8 88 Z" fill="' + O + '"/>'
    + '<path d="M112 57 H94 V95 H104 Q112 95 112 88 Z" fill="' + O + '"/>'
    + '<rect x="52" y="57" width="16" height="38" fill="' + O + '"/>'
    + rivets([13, 21, 99, 107], 53.5) + rivets([17], 72) + rivets([103], 72) + rivets([17], 88) + rivets([103], 88)
    + '<path d="M48 58 H72 V74 Q72 84 60 88 Q48 84 48 74 Z" fill="' + O + '" stroke="#9A5B17" stroke-width="1"/>'
    + '<path d="M51 61 H69 V73.5 Q69 81.5 60 84.5 Q51 81.5 51 73.5 Z" fill="#3A140C"/>'
    + '<circle cx="60" cy="69" r="3.2" fill="' + O + '"/><path d="M58.6 70.5 H61.4 L62.4 78 H57.6 Z" fill="' + O + '"/>'
    + '<path d="M17 76 l3.5 4 -3.5 4 -3.5 -4 z" fill="url(#' + g('s') + ')" stroke="#FFF1C1" stroke-width=".6"/>'
    + '<path d="M103 76 l3.5 4 -3.5 4 -3.5 -4 z" fill="url(#' + g('s') + ')" stroke="#FFF1C1" stroke-width=".6"/>'
    + '<path d="M30 53 H90" stroke="rgba(255,255,255,.55)" stroke-width="1.2" stroke-linecap="round"/>'
    + '</svg>';
  return '<div class="cj-coffre' + (ouvert ? ' ouvert' : '') + '">' + arriere + milieu + avant + '</div>';
}

// ---------- ouverture ----------
function cjCleAide(){ return 'nousdeux_coffre_jour_aide_masquee_' + roomCode + '_' + me.id; }
function cjAideMasquee(){ try{ return localStorage.getItem(cjCleAide()) === '1'; }catch(e){ return false; } }

function cjToucher(){
  if(cjDuJour()) cjDemain();          // déjà ouvert aujourd'hui
  else if(!cjAideMasquee()) cjExplication();
  else cjOuvrirPage();
}

// Coffre déjà ouvert aujourd'hui : petit pop-up « Reviens demain ».
function cjDemain(){
  const el = ptEcran('cj-aide');
  el.className = 'env-voile';
  el.innerHTML = '<div class="env-pop cj-pop">'
    + '<div class="cj-pop-ic">' + cjCoffreSvg(false) + '</div>'
    + '<h2>Reviens demain !</h2>'
    + '<p>Tu as déjà ouvert le Coffre Surprise aujourd’hui. Reviens demain pour une nouvelle surprise ! 🎁</p>'
    + '<p class="cj-demain-h">Prochain coffre ' + cjProchain() + '</p>'
    + '<button type="button" class="btn-primary" data-cj-ok>OK</button>'
    + '<button type="button" class="btn-ghost" data-cj-voir>Revoir ma surprise et mes bons</button>'
    + '</div>';
  el.querySelector('[data-cj-ok]').onclick = () => el.remove();
  el.querySelector('[data-cj-voir]').onclick = () => { el.remove(); cjOuvrirPage(); };
}

function cjExplication(){
  const el = ptEcran('cj-aide');
  el.className = 'env-voile';
  el.innerHTML = '<div class="env-pop cj-pop">'
    + '<div class="cj-pop-ic">' + cjCoffreSvg(false) + '</div>'
    + '<h2>Le Coffre Surprise</h2>'
    + '<p>Ce coffre contient toutes sortes de mystères. Il est possible de l’ouvrir <b>une fois par jour</b>.</p>'
    + '<p>La récompense est aléatoire. Tu pourras y trouver des <b>points bonus</b>, des <b>bons cadeaux</b> que ton/ta partenaire devra honorer, mais aussi des <b>points malus</b> ou encore des <b>gages</b> à réaliser dans la journée.</p>'
    + '<p>Alors ? Tenté·e d’ouvrir le coffre ? 😃</p>'
    + '<label class="qdj-aide-case env-aide-case"><input type="checkbox" id="cj-aide-masquer"> Ne plus afficher</label>'
    + '<button type="button" class="btn-primary" data-cj-ok>Voir le coffre</button>'
    + '<button type="button" class="btn-ghost" data-cj-annule>Plus tard</button>'
    + '</div>';
  el.querySelector('[data-cj-ok]').onclick = () => {
    try{ if(el.querySelector('#cj-aide-masquer').checked) localStorage.setItem(cjCleAide(), '1'); }catch(e){}
    el.remove(); cjOuvrirPage();
  };
  el.querySelector('[data-cj-annule]').onclick = () => el.remove();
}

function cjOuvrirPage(){
  cjOuvert = true;
  const el = ptEcran('cj-plein');
  el.innerHTML = '<button type="button" class="qdj-fermer" aria-label="Fermer" data-cj-fermer>✕</button><div class="cj-corps-page" id="cj-page"></div>';
  el.querySelector('[data-cj-fermer]').onclick = cjFermer;
  cjDessiner();
}
function cjFermer(){
  cjOuvert = false; cjAnim = false;
  const el = document.getElementById('cj-plein'); if(el) el.remove();
}

let cjSign = '';
function cjDessiner(forcer){
  const page = document.getElementById('cj-page');
  if(!page) return;
  const r = cjDuJour();
  const bons = Object.entries((state && state.bons) || {});
  const cadeaux = Object.entries((state && state.cadeaux) || {});
  const sign = JSON.stringify([r, bons, cadeaux]);
  if(!forcer && sign === cjSign) return;
  cjSign = sign;
  let h = '';
  if(!r){
    h += '<div class="cj-scene"><div class="cj-halo"></div><div class="cj-gros">' + cjCoffreSvg(false) + '</div></div>'
      + '<h2 class="pt-titre">Le Coffre Surprise</h2>'
      + '<p class="pt-sous">Une seule ouverture par jour. Bonne ou mauvaise surprise…</p>'
      + '<button type="button" class="btn-primary cj-ouvrir" id="cj-ouvrir">Ouvrir le coffre</button>';
  } else {
    h += '<div class="cj-scene"><div class="cj-halo"></div><div class="cj-gros">' + cjCoffreSvg(true) + '</div></div>'
      + cjCarte(r)
      + '<p class="cj-prochain">Prochain coffre ' + cjProchain() + '</p>';
  }
  // Bons cadeaux : ma cagnotte, puis les cadeaux à offrir / à recevoir
  const miens = bons.filter(([k, b]) => b.pour === me.id && !b.utilise);
  const total = miens.reduce((t, [k, b]) => t + (b.montant || 0), 0);
  h += '<div class="cj-bons"><h3>🎟️ Mes bons cadeaux</h3>';
  if(miens.length){
    h += '<div class="cj-cartes-bons">' + miens.map(([k, b]) => cjCarteBon(b.montant)).join('') + '</div>'
      + '<div class="cj-cagnotte"><span>Cagnotte</span><b>' + total + ' €</b><div class="cj-jauge"><div style="width:' + Math.min(100, total / CJ_SEUIL_EUROS * 100) + '%"></div></div></div>';
    h += total >= CJ_SEUIL_EUROS
      ? '<button type="button" class="btn-primary cj-envoyer" data-cj-envoyer>Envoyer mes ' + total + ' € à ' + escapeHtml(cjNomAutre()) + '</button>'
      : '<p class="cj-note">Encore ' + (CJ_SEUIL_EUROS - total) + ' € avant de pouvoir les envoyer à ' + escapeHtml(cjNomAutre()) + '.</p>';
  } else {
    h += '<p class="cj-note">Aucun bon pour l’instant. Ils sortent parfois du coffre (1 € ou 2 €).</p>';
  }
  const aOffrir = cadeaux.filter(([k, c]) => c.de === me.id && !c.offert);
  const aRecevoir = cadeaux.filter(([k, c]) => c.pour === me.id && !c.offert);
  aOffrir.forEach(([k, c]) => {
    h += '<div class="cj-cadeau"><b>🎁 Cadeau à offrir à ' + escapeHtml(cjNomAutre()) + '</b><span>Un cadeau d’au moins <b>' + c.montant + ' €</b>.</span>'
      + '<button type="button" class="btn-ghost" data-cj-offert="' + k + '">Cadeau offert ✓</button></div>';
  });
  aRecevoir.forEach(([k, c]) => {
    h += '<div class="cj-cadeau attente"><b>⏳ ' + escapeHtml(cjNomAutre()) + ' te doit un cadeau</b><span>D’au moins <b>' + c.montant + ' €</b>, en échange de tes bons.</span></div>';
  });
  h += '</div>';
  page.innerHTML = h;
  const b = page.querySelector('#cj-ouvrir'); if(b) b.onclick = cjOuvrirCoffre;
  const f = page.querySelector('[data-cj-gage-fait]'); if(f) f.onclick = cjGageFait;
  const env = page.querySelector('[data-cj-envoyer]'); if(env) env.onclick = cjEnvoyerBons;
  page.querySelectorAll('[data-cj-offert]').forEach(x => x.onclick = () => cjCadeauOffert(x.dataset.cjOffert));
}

function cjCarte(r){
  if(r.type === 'bonus') return '<div class="cj-carte bonus"><div class="cj-carte-ic">✨</div><b>+' + r.pts + ' points</b><span>Bonus ajouté à ton score.</span></div>';
  if(r.type === 'malus') return '<div class="cj-carte malus"><div class="cj-carte-ic">💀</div><b>' + r.pts + ' points</b><span>Pas de chance… retirés de ton score.</span></div>';
  if(r.type === 'bon') return '<div class="cj-carte bon">' + cjCarteBon(r.montant, true)
    + '<small>Conserve-le dans ton appli : tu pourras envoyer tes bons à ' + escapeHtml(cjNomAutre()) + ' une fois que tu auras atteint <b>' + CJ_SEUIL_EUROS + ' €</b>. Il/elle devra alors t’offrir un cadeau d’un montant de ' + CJ_SEUIL_EUROS + ' € minimum.</small></div>';
  return '<div class="cj-carte gage"><div class="cj-carte-ic">😈</div><b>Gage du jour</b><span>' + escapeHtml(r.texte) + '</span>'
    + (r.fait ? '<small>✓ Gage réalisé</small>' : '<small>À réaliser avant ce soir.</small><button type="button" class="btn-ghost" data-cj-gage-fait>C’est fait ✓</button>') + '</div>';
}

function cjCarteBon(montant, grande){
  return '<div class="cj-bon-carte' + (grande ? ' grande' : '') + '"><span class="cj-bon-titre">Bon cadeau</span>'
    + '<span class="cj-bon-montant">' + (montant || 0) + ' €</span><span class="cj-bon-pied">Nous Deux · Coffre Surprise</span></div>';
}

function cjProchain(){
  const p = qdjParis(new Date());
  const reste = 24 - p.heure;
  return reste <= 1 ? 'dans moins d’une heure' : 'dans ' + reste + ' h environ';
}

function cjOuvrirCoffre(){
  if(cjAnim || cjDuJour()) return;
  cjAnim = true;
  const jour = cjJour();
  const tirage = Object.assign(cjTirer(), { ts: Date.now() });
  const gros = document.querySelector('#cj-page .cj-gros');
  const btn = document.getElementById('cj-ouvrir');
  if(btn) btn.disabled = true;
  if(gros) gros.classList.add('secoue');
  roomRef.child('coffreJour/' + me.id + '/' + jour).transaction(v => v ? undefined : tirage, (err, ok, snap) => {
    if(err || !ok){ cjAnim = false; cjDessiner(true); return; }
    cjAppliquer(tirage);
    setTimeout(() => { cjAnim = false; cjDessiner(true); const c = document.querySelector('#cj-page .cj-carte'); if(c) c.classList.add('revele'); }, 1100);
  });
}

function cjAppliquer(t){
  const autre = cjAutreId();
  if(t.pts){
    roomRef.child('scores/' + me.id).transaction(s => (s || 0) + t.pts);
  }
  const hk = db.ref('rooms/' + roomCode + '/history').push().key;
  const txt = t.type === 'bonus' ? 'Coffre Surprise — bonus' : t.type === 'malus' ? 'Coffre Surprise — malus'
    : t.type === 'bon' ? 'Coffre Surprise — bon cadeau de ' + t.montant + ' €' : 'Coffre Surprise — gage : ' + t.texte;
  roomRef.child('history/' + hk).set({ who: me.name, cat: 'coffre', text: txt, pts: t.pts || 0, validated: true, ts: Date.now() });
  if(t.type === 'bon'){
    roomRef.child('bons').push({ pour: me.id, de: autre, montant: t.montant, ts: Date.now(), utilise: null });
  } else if(t.type === 'gage'){
    notifyPartner('😈 ' + me.name + ' a un gage aujourd’hui', 'Le Coffre Surprise lui a donné un gage… Ouvre l’œil !', 'coffre');
  }
}

function cjGageFait(){
  roomRef.child('coffreJour/' + me.id + '/' + cjJour() + '/fait').set(Date.now());
  const r = cjDuJour();
  notifyPartner('✓ Gage réalisé', me.name + ' a réalisé son gage du jour : ' + ((r && r.texte) || ''), 'coffre');
}

function cjEnvoyerBons(){
  const miens = Object.entries(state.bons || {}).filter(([k, b]) => b.pour === me.id && !b.utilise);
  const total = miens.reduce((t, [k, b]) => t + (b.montant || 0), 0);
  if(total < CJ_SEUIL_EUROS) return;
  if(!confirm('Envoyer tes ' + total + ' € de bons à ' + cjNomAutre() + ' ?\n\nIl/elle devra t’offrir un cadeau d’au moins ' + total + ' €.')) return;
  const maj = {}, now = Date.now();
  miens.forEach(([k]) => maj['bons/' + k + '/utilise'] = now);
  maj['cadeaux/' + db.ref('rooms/' + roomCode + '/cadeaux').push().key] = { pour: me.id, de: cjAutreId(), montant: total, ts: now, offert: null };
  roomRef.update(maj);
  notifyPartner('🎁 ' + me.name + ' t’envoie ses bons cadeaux', 'Tu lui dois un cadeau d’au moins ' + total + ' € !', 'coffre');
}

function cjCadeauOffert(cle){
  const c = state.cadeaux && state.cadeaux[cle];
  if(!c || !confirm('Confirmer que tu as offert le cadeau (' + c.montant + ' € minimum) ?')) return;
  roomRef.child('cadeaux/' + cle + '/offert').set(Date.now());
  notifyPartner('🎁 Cadeau offert', me.name + ' a offert ton cadeau. Profite !', 'coffre');
}

(function(){
  const t = document.getElementById('cj-tuile');
  if(t) t.addEventListener('click', cjToucher);
})();
