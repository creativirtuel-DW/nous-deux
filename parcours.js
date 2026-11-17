/* ====== PARCOURS ======
 * Carte façon jeu vidéo : un chemin sinueux qui monte, un pion par joueur
 * (placé selon SES points), et les étapes communes (cadeaux des paliers,
 * porte HOT) qui se débloquent avec les points À DEUX.
 * Pour que tout tienne sur la même échelle, une étape « X pts à deux » est
 * dessinée à X/2 : elle s'ouvre quand le cœur « vous deux » (la moyenne des
 * deux scores) la dépasse.
 */
const PRC_K = 2;           // pixels par point sur le chemin
const PRC_HAUT = 90, PRC_BAS = 70;
const PRC_MONDES = [
  { de:0,   nom:'Les premiers pas', teinte:'rgba(255,160,122,.07)', deco:['💌','✨','🌸'] },
  { de:100, nom:'Complices',        teinte:'rgba(142,140,255,.07)', deco:['🎲','⭐','💫'] },
  { de:250, nom:'Fusionnels',       teinte:'rgba(255,77,46,.08)',   deco:['🔥','💋','🌶️'] },
  { de:400, nom:'Âmes sœurs',       teinte:'rgba(255,210,122,.07)', deco:['👑','💎','🌙'] },
];
let prcDejaCentre = false;

// Les paliers actifs (mêmes règles que l'onglet Paliers), du plus petit au plus grand.
function prcPaliers(){
  let tous = DEFAULT_REWARDS.map((r,i) => ({ ...r, id:'r'+i }));
  if(state.customRewards) Object.entries(state.customRewards).forEach(([k,r]) => tous.push({ ...r, id:k }));
  const off = state.disabledRewards || {};
  return tous.filter(r => !off[r.id]).sort((a,b) => a.pts - b.pts);
}

function prcVisible(){
  const v = document.getElementById('view-parcours');
  return v && v.classList.contains('active');
}

function renderParcours(){
  if(!state || !me || !prcVisible()) return;
  const monde = document.getElementById('prc-monde');
  const W = monde.clientWidth;
  if(!W) return;

  const sMoi = (state.scores && state.scores[me.id]) || 0;
  const sAutre = (state.scores && state.scores[partnerId]) || 0;
  const nomMoi = me.name || 'Moi';
  const nomAutre = state.players[partnerId] || 'Partenaire';
  const equipe = sMoi + sAutre, coeur = equipe / 2;
  const paliers = prcPaliers();
  const hotPos = MC_SEUIL / 2, hotOuverte = mcDebloque();

  // En-tête
  document.getElementById('prc-duel').innerHTML =
      prcJoueur('moi', nomMoi, sMoi)
    + `<div class="prc-vs">VS<em>${sMoi === sAutre ? 'Égalité' : escapeHtml((sMoi > sAutre ? nomMoi : nomAutre)) + ' +' + Math.abs(sMoi - sAutre)}</em></div>`
    + prcJoueur('autre', nomAutre, sAutre);
  document.getElementById('prc-hot-txt').textContent = hotOuverte ? 'Ouverte ✓' : equipe + ' / ' + MC_SEUIL + ' à deux';
  document.getElementById('prc-hot-jauge').style.width = Math.min(100, equipe / MC_SEUIL * 100) + '%';

  // Longueur du chemin : toujours de l'avance à parcourir devant
  const plusLoin = Math.max(sMoi, sAutre, paliers.length ? paliers[paliers.length-1].pts / 2 : 0, hotPos);
  const MAX = Math.max(400, Math.ceil((plusLoin + 120) / 50) * 50);
  const H = MAX * PRC_K + PRC_HAUT + PRC_BAS;
  const X = p => W/2 + W*0.27 * Math.sin(p * Math.PI / 60);
  const Y = p => PRC_HAUT + (MAX - p) * PRC_K;
  monde.style.height = H + 'px';

  let h = '';
  // Mondes : bandes de couleur + décorations
  PRC_MONDES.forEach((z,i) => {
    const fin = i < PRC_MONDES.length-1 ? PRC_MONDES[i+1].de : MAX;
    const top = Y(fin), bas = Y(z.de);
    h += `<div class="prc-zone" style="top:${top}px;height:${bas-top}px;background:linear-gradient(180deg,transparent,${z.teinte} 30%,${z.teinte} 70%,transparent)"></div>`;
    for(let j=0;j<5;j++){
      const p = z.de + (fin - z.de) * (j + .5) / 5, cote = j % 2 ? .08 : .88;
      h += `<div class="prc-deco" style="left:${W*cote}px;top:${Y(p)}px;animation-delay:${j*.7}s">${z.deco[j%3]}</div>`;
    }
  });
  // Le chemin, éclairé jusqu'au cœur « vous deux »
  let d = '', d2 = '';
  for(let p=0; p<=MAX; p+=2) d += (p ? 'L' : 'M') + X(p).toFixed(1) + ' ' + Y(p).toFixed(1);
  for(let p=0; p<=Math.min(coeur, MAX); p+=2) d2 += (p ? 'L' : 'M') + X(p).toFixed(1) + ' ' + Y(p).toFixed(1);
  h += `<svg class="prc-chemin" viewBox="0 0 ${W} ${H}" aria-hidden="true">
    <defs><linearGradient id="prc-g" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#FB5A63"/><stop offset="1" stop-color="#FFA07A"/></linearGradient></defs>
    <path d="${d}" fill="none" stroke="#2E2D3A" stroke-width="14" stroke-linecap="round"/>
    <path d="${d}" fill="none" stroke="rgba(255,255,255,.08)" stroke-width="1.5" stroke-dasharray="2 8" stroke-linecap="round"/>
    ${d2 ? `<path d="${d2}" fill="none" stroke="url(#prc-g)" stroke-width="6" stroke-linecap="round" style="filter:drop-shadow(0 0 8px rgba(255,107,107,.6))"/>` : ''}
    <path d="M${X(MAX)} ${Y(MAX)} l0 -60" stroke="#2E2D3A" stroke-width="14" stroke-linecap="round" stroke-dasharray="1 24"/>
  </svg>`;
  // Frontières des mondes, du côté libre du chemin
  PRC_MONDES.forEach((z,i) => {
    const y = z.de ? Y(z.de - 22) : Y(0) + 40, cote = X(z.de - 22) < W/2 ? 'right:10px' : 'left:10px';
    h += `<div class="prc-frontiere" style="top:${y}px;${z.de ? '' : 'border:0'}"><span style="${cote}">Monde ${i+1} · ${z.nom}</span></div>`;
  });
  // Points d'étape tous les 50
  const etapes = paliers.map(p => p.pts / 2).concat([hotPos]);
  for(let p=50; p<MAX; p+=50){
    if(etapes.some(e => Math.abs(e - p) < 12)) continue;
    h += `<div class="prc-etape" style="left:${X(p)}px;top:${Y(p)}px"><div class="prc-pt ${coeur >= p ? 'fait' : ''}"></div></div>`;
  }
  // Départ
  h += prcCle(X(0), Y(0), W, '🚩', true, 'Départ', '0 pts', '', null);
  // Cadeaux
  paliers.forEach((pa, i) => {
    const pos = pa.pts / 2, ok = equipe >= pa.pts;
    h += prcCle(X(pos), Y(pos), W, '🎁', ok, 'Cadeau de niveau ' + (i+1), pa.pts + ' pts à deux', ok ? '✓' : '🔒', i);
  });
  // Porte HOT
  const xh = X(hotPos), gauche = xh < W/2;
  h += `<button type="button" class="prc-porte ${hotOuverte ? 'ouverte' : ''}" data-hot="1" style="left:${xh}px;top:${Y(hotPos)}px"><span>${hotOuverte ? '🔥' : '🔒'}</span></button>
    <div class="prc-porte-etiq" style="top:${Y(hotPos)}px;left:${gauche ? xh + 30 : xh - 130}px;${gauche ? '' : 'text-align:right'}"><b>Porte HOT</b><span>${hotOuverte ? 'Débloquée' : MC_SEUIL + ' pts à deux'}</span></div>`;
  // Fin provisoire
  h += `<div class="prc-etiq prc-suite" style="top:${PRC_HAUT - 60}px;left:${X(MAX) - 64}px"><b>☁️ La suite arrive…</b><span>De nouveaux mondes à venir</span></div>`;
  // Cœur « vous deux » puis les pions
  h += `<div class="prc-coeur" style="left:${X(Math.min(coeur, MAX))}px;top:${Y(Math.min(coeur, MAX))}px" title="Vous deux">💞</div>`;
  const proches = Math.abs(sMoi - sAutre) < 20;
  const devant = sMoi >= sAutre ? 'moi' : 'autre';
  h += prcPion('autre', nomAutre, sAutre, proches ? 13 : 0, devant === 'autre' && sMoi !== sAutre, X, Y, MAX);
  h += prcPion('moi', nomMoi, sMoi, proches ? -13 : 0, devant === 'moi' && sMoi !== sAutre, X, Y, MAX);
  monde.innerHTML = h;

  monde.querySelectorAll('[data-i]').forEach(b => b.onclick = () => prcFiche(paliers[+b.dataset.i], +b.dataset.i, equipe));
  monde.querySelector('[data-hot]').onclick = () => prcFicheHot(equipe, hotOuverte);

  if(!prcDejaCentre){ prcDejaCentre = true; prcAllerMoi(false); }
}

function prcJoueur(qui, nom, s){
  return `<div class="prc-joueur ${qui}"><div class="prc-av ${qui}">${escapeHtml((nom || '?').charAt(0).toUpperCase())}</div>`
    + `<div><b>${escapeHtml(nom)}</b><small>${s}<i>pts</i></small></div></div>`;
}

function prcCle(x, y, W, ic, fait, nom, pts, etat, i){
  const droite = x < W/2, ec = 28;
  return `<button type="button" class="prc-etape" ${i !== null ? `data-i="${i}"` : ''} style="left:${x}px;top:${y}px">
      <div class="prc-cle ${fait ? 'fait' : 'verrou'}"><span>${ic}</span>${fait && i !== null ? '<div class="prc-ok">✓</div>' : ''}</div></button>
    <div class="prc-etiq" style="top:${y}px;${droite ? `left:${x + ec}px` : `left:${x - ec - 120}px;text-align:right`}">
      <b>${nom}</b><span class="prc-pts">${pts}</span>${etat && etat !== '✓' ? ' <span>' + etat + '</span>' : ''}</div>`;
}

function prcPion(qui, nom, s, dx, couronne, X, Y, MAX){
  const p = Math.min(s, MAX);
  return `<div class="prc-pion ${qui}" style="left:${X(p) + dx}px;top:${Y(p) + 4}px">
    ${couronne ? `<div class="prc-bulle">👑 ${escapeHtml(nom)} · ${s}</div>` : ''}
    <div class="prc-tete">${escapeHtml((nom || '?').charAt(0).toUpperCase())}</div><div class="prc-pied"></div><div class="prc-ombre"></div></div>`;
}

function prcAllerMoi(doux){
  const v = document.getElementById('view-parcours');
  const pion = document.querySelector('#prc-monde .prc-pion.moi');
  if(!v || !pion) return;
  const cible = pion.offsetTop + document.getElementById('prc-monde').offsetTop - v.clientHeight * 0.55;
  v.scrollTo({ top: Math.max(0, cible), behavior: doux ? 'smooth' : 'auto' });
}

function prcOuvrirFiche(html){
  document.getElementById('prc-fiche').innerHTML = html;
  document.getElementById('prc-voile').style.display = 'block';
  requestAnimationFrame(() => document.getElementById('prc-fiche').classList.add('on'));
}
function prcFermerFiche(){
  document.getElementById('prc-fiche').classList.remove('on');
  document.getElementById('prc-voile').style.display = 'none';
}
function prcFiche(pa, i, equipe){
  const ok = equipe >= pa.pts;
  prcOuvrirFiche(`<div class="prc-f-ic">🎁</div><h2>Cadeau de niveau ${i+1}</h2>
    <p>${ok ? 'Votre cadeau : <b>' + escapeHtml(pa.desc || '') + '</b>' : 'Un cadeau surprise, révélé quand le niveau est atteint.'}</p>
    <div class="prc-ligne"><span>Vos points à deux</span><b>${equipe} / ${pa.pts}</b></div>
    ${ok ? '' : `<div class="prc-ligne"><span>Il vous manque</span><b>${pa.pts - equipe} pts</b></div>`}
    <button type="button" class="btn-primary" onclick="prcFermerFiche()">${ok ? 'Super !' : 'Jouer pour avancer'}</button>`);
}
function prcFicheHot(equipe, ouverte){
  prcOuvrirFiche(`<div class="prc-f-ic">🔥</div><h2>Porte HOT</h2>
    <p>Elle s’ouvre quand vos points à deux atteignent <b>${MC_SEUIL}</b>. Derrière : Cap ou pas, Soirée guidée et les questions coquines.</p>
    <div class="prc-ligne"><span>Vos points à deux</span><b>${ouverte ? 'Débloquée ✓' : equipe + ' / ' + MC_SEUIL}</b></div>
    <button type="button" class="btn-primary" onclick="prcFermerFiche()">${ouverte ? 'Super !' : 'Jouer pour avancer'}</button>`);
}

// Appelé quand on ouvre l'onglet
function prcOuvert(){
  prcDejaCentre = false;
  renderParcours();
}
window.addEventListener('resize', () => renderParcours());
