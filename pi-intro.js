/**
 * Nous Deux — cinématique d'ouverture de « Plaisirs Intimes » (23/11/2026)
 * ========================================================================
 * À l'ouverture du jeu : ~4 s de photos d'objets coquins (générées avec
 * Qwen-Image 2.1, détourées, dans hot/*.webp) qui montent à l'écran, mêlées de
 * silhouettes de couples et de cœurs, avec le titre au centre.
 * Les images sont chiffrées sur le site (hot/*.nd) : voir secret.js. Un appui la
 * passe. Ensuite vient le pop-up de présentation (plaisirs.js).
 */
const PI_INTRO_MS = 5200;

const PI_EMOJIS = ['💋', '❤️', '💗', '🔥', '❤️‍🔥', '💞'];
// Photos réalistes (générées avec Qwen-Image 2.1, détourées, WebP) — 23/11/2026.
// Elles sont publiées CHIFFRÉES (hot/<nom>.nd) et déchiffrées avec le code secret (secret.js).
const PI_PHOTOS = ['wand', 'rabbit', 'lecheur', 'plug', 'menottes', 'martinet', 'baillon', 'collier', 'masque',
  'plume', 'soutif', 'string', 'jarretelle', 'escarpin'];
// Illustrations Kamasutra (homme rouge foncé, femme jaune, sans détail anatomique), générées et détourées.
const PI_SILHOUETTES = ['andromaque', 'levrette', 'debout', 'lotus', 'missionnaire', 'cuillere'].map(n => 'sil_' + n);
const piUrls = {};   // nom -> URL déchiffrée
let piPhotosPretes = null;
function piPrecharger(){
  if(!piPhotosPretes) piPhotosPretes = Promise.all(PI_PHOTOS.concat(PI_SILHOUETTES).map(nom =>
    secretImage(nom).then(url => new Promise(ok => {
      piUrls[nom] = url; const i = new Image(); i.onload = i.onerror = ok; i.src = url;
    }), () => {})));
  return piPhotosPretes;
}

let piIntroFin = null;

function piIntro(suite){
  const ancien = document.getElementById('pi-intro');
  if(ancien) ancien.remove();
  const el = document.createElement('div');
  el.id = 'pi-intro';
  let fini = false;
  const finir = () => {
    if(fini) return; fini = true;
    clearTimeout(piIntroFin);
    el.classList.add('pii-sortie');
    setTimeout(() => { el.remove(); if(typeof suite === 'function') suite(); }, 450);
  };
  el.addEventListener('click', finir);
  document.body.appendChild(el);
  // On attend les photos (au plus 2,5 s : il faut aussi les déchiffrer) pour qu'elles ne surgissent pas à moitié chargées.
  Promise.race([piPrecharger(), new Promise(ok => setTimeout(ok, 2500))]).then(() => {
    if(fini) return;
    // Chaque photo passe une fois (dans le désordre), plus les silhouettes et quelques cœurs.
    const melange = a => a.slice().sort(() => Math.random() - .5);
    const liste = melange(PI_PHOTOS.filter(n => piUrls[n]).map(n => ({ src: piUrls[n], taille: 100 + Math.random() * 40 }))
      .concat(PI_SILHOUETTES.filter(n => piUrls[n]).map(n => ({ src: piUrls[n], taille: 120 + Math.random() * 30, sil: true })))
      .concat(Array.from({ length: 10 }, () => ({ emoji: PI_EMOJIS[Math.floor(Math.random() * PI_EMOJIS.length)], taille: 26 + Math.random() * 16 }))));
    let h = '';
    liste.forEach((o, i) => {
      // Couloirs gauche / milieu / droite à tour de rôle, départs étalés sur ~2,6 s : pas de paquet.
      const couloir = i % 3;
      const gauche = (couloir * 30 + Math.random() * 22 - 4).toFixed(1);
      const duree = (3.1 + Math.random() * .8).toFixed(2);
      const delai = (i / liste.length * 2.6 + Math.random() * .15).toFixed(2);
      const rot = Math.round(-30 + Math.random() * 60);
      const contenu = o.emoji ? '<span>' + o.emoji + '</span>' : '<img src="' + o.src + '" alt="">';
      h += '<div class="pii-obj' + (o.sil ? ' pii-sil' : '') + '" style="left:' + gauche + '%;width:' + o.taille.toFixed(0) + 'px;height:' + o.taille.toFixed(0)
        + 'px;font-size:' + (o.taille * .8).toFixed(0) + 'px;animation-duration:' + duree + 's;animation-delay:' + delai + 's;--rot:' + rot + 'deg">' + contenu + '</div>';
    });
    h += '<div class="pii-centre"><div class="pii-coeur">❤️‍🔥</div><div class="pii-titre">Plaisirs Intimes</div><div class="pii-sous">Mode HOT</div></div>'
      + '<div class="pii-passer">Touche pour passer</div>';
    el.insertAdjacentHTML('beforeend', h);
    piIntroFin = setTimeout(finir, PI_INTRO_MS);
  });
}
