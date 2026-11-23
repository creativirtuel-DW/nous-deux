/**
 * Nous Deux — cinématique d'ouverture de « Plaisirs Intimes » (23/11/2026)
 * ========================================================================
 * À l'ouverture du jeu : ~4 s de photos d'objets coquins (générées avec
 * Qwen-Image 2.1, détourées, dans hot/*.webp) qui montent à l'écran, mêlées de
 * silhouettes de couples et de cœurs, avec le titre au centre.
 * (Les dessins SVG de PI_OBJETS sont l'ancienne version, gardés en secours.) Un appui la
 * passe. Ensuite vient le pop-up de présentation (plaisirs.js).
 */
const PI_INTRO_MS = 5200;

// Dessins 64 × 64, aux couleurs de l'appli.
const PI_OBJETS = {
  // Vibromasseur « wand » : grosse tête ronde sur un long manche
  wand: '<svg viewBox="0 0 64 64"><circle cx="32" cy="15" r="12.5" fill="#FF6B9A"/><ellipse cx="28" cy="10" rx="5" ry="3" fill="#FFB3C9" opacity=".7"/>'
    + '<rect x="28.5" y="25" width="7" height="7" rx="2" fill="#E8234A"/><rect x="26.5" y="30" width="11" height="31" rx="5.5" fill="#F4F1EC"/>'
    + '<circle cx="32" cy="39" r="2.2" fill="#E8234A"/><circle cx="32" cy="46" r="1.6" fill="#FF6B9A"/></svg>',
  // Vibromasseur « rabbit » : tige + bras aux oreilles de lapin
  rabbit: '<svg viewBox="0 0 64 64"><rect x="19" y="3" width="14" height="42" rx="7" fill="#B983FF"/>'
    + '<path d="M22 12h8M22 19h8M22 26h8" stroke="#D9BFFF" stroke-width="2" stroke-linecap="round"/>'
    + '<rect x="36" y="27" width="7" height="17" rx="3.5" fill="#B983FF"/>'
    + '<ellipse cx="37" cy="22" rx="2.6" ry="6.5" fill="#B983FF" transform="rotate(-16 37 22)"/><ellipse cx="43.5" cy="22" rx="2.6" ry="6.5" fill="#B983FF" transform="rotate(16 43.5 22)"/>'
    + '<rect x="16" y="43" width="30" height="18" rx="5" fill="#7C4DDB"/><circle cx="26" cy="52" r="2.3" fill="#D9BFFF"/><circle cx="35" cy="52" r="2.3" fill="#D9BFFF"/></svg>',
  // Menottes à fourrure rose
  menottes: '<svg viewBox="0 0 64 64"><circle cx="18" cy="42" r="12" fill="none" stroke="#FF8FB8" stroke-width="8"/><circle cx="18" cy="42" r="12" fill="none" stroke="#FFC2D9" stroke-width="2" stroke-dasharray="2 3"/>'
    + '<circle cx="46" cy="42" r="12" fill="none" stroke="#FF8FB8" stroke-width="8"/><circle cx="46" cy="42" r="12" fill="none" stroke="#FFC2D9" stroke-width="2" stroke-dasharray="2 3"/>'
    + '<ellipse cx="25" cy="24" rx="3.2" ry="2.2" fill="none" stroke="#C9CDD6" stroke-width="2"/><ellipse cx="32" cy="21" rx="3.2" ry="2.2" fill="none" stroke="#C9CDD6" stroke-width="2"/><ellipse cx="39" cy="24" rx="3.2" ry="2.2" fill="none" stroke="#C9CDD6" stroke-width="2"/>'
    + '<path d="M20 30l3-4M44 30l-3-4" stroke="#C9CDD6" stroke-width="2.4" stroke-linecap="round"/></svg>',
  // Martinet : manche noir et lanières
  martinet: '<svg viewBox="0 0 64 64"><circle cx="32" cy="5" r="3" fill="none" stroke="#C9CDD6" stroke-width="2"/>'
    + '<rect x="28.5" y="7" width="7" height="22" rx="3" fill="#1D1C25" stroke="#E8234A" stroke-width="1.5"/><path d="M28.5 13h7M28.5 19h7M28.5 25h7" stroke="#E8234A" stroke-width="1.2"/>'
    + '<path d="M32 29C28 40 20 50 14 61M32 29C30 42 26 52 23 62M32 29C32 42 32 52 32 63M32 29C34 42 38 52 41 62M32 29C36 40 44 50 50 61" fill="none" stroke="#2A2833" stroke-width="2.6" stroke-linecap="round"/>'
    + '<path d="M32 29C30 42 26 52 23 62M32 29C34 42 38 52 41 62" fill="none" stroke="#E8234A" stroke-width="1.4" stroke-linecap="round"/></svg>',
  // Masque pour les yeux, satin noir bordé de dentelle rose
  masque: '<svg viewBox="0 0 64 64"><path d="M2 30c6-1 8-2 10-3M62 30c-6-1-8-2-10-3" stroke="#1D1C25" stroke-width="3" stroke-linecap="round"/>'
    + '<path d="M9 30C9 21 21 19 32 25C43 19 55 21 55 30C55 40 45 44 38 40C35 38 29 38 26 40C19 44 9 40 9 30Z" fill="#1D1C25" stroke="#FF8FB8" stroke-width="2" stroke-dasharray="3 2"/>'
    + '<path d="M15 27c4-3 9-3 12-1M37 26c3-2 8-2 12 1" stroke="#4A4656" stroke-width="2" stroke-linecap="round" fill="none"/></svg>',
  // Bâillon boule
  baillon: '<svg viewBox="0 0 64 64"><path d="M3 31h58" stroke="#1D1C25" stroke-width="6" stroke-linecap="round"/><path d="M3 31h58" stroke="#3A3744" stroke-width="2" stroke-dasharray="4 4"/>'
    + '<rect x="47" y="26" width="7" height="10" rx="1.5" fill="none" stroke="#C9CDD6" stroke-width="2"/>'
    + '<circle cx="28" cy="31" r="11" fill="#E8234A"/><ellipse cx="24" cy="26" rx="4" ry="2.6" fill="#FF8FA8" opacity=".75"/></svg>',
  // Plug bijou
  plug: '<svg viewBox="0 0 64 64"><path d="M32 4C41 14 44 27 37 36L36 44H28L27 36C20 27 23 14 32 4Z" fill="#C9CDD6"/><path d="M29 10C26 16 26 24 29 31" stroke="#F4F1EC" stroke-width="2.4" stroke-linecap="round" fill="none"/>'
    + '<ellipse cx="32" cy="51" rx="13" ry="8" fill="#9AA0AD"/><path d="M32 44l8 7-8 7-8-7z" fill="#FF3D7F"/><path d="M32 44l4 7h-8z" fill="#FF8FB8"/></svg>',
  // Soutien-gorge en dentelle
  soutif: '<svg viewBox="0 0 64 64"><path d="M11 24L15 6M53 24L49 6" stroke="#E8234A" stroke-width="2.2" stroke-linecap="round"/>'
    + '<path d="M5 24Q5 46 19 46Q32 46 32 26Z" fill="#E8234A"/><path d="M59 24Q59 46 45 46Q32 46 32 26Z" fill="#E8234A"/>'
    + '<path d="M5 24Q5 46 19 46Q32 46 32 26M59 24Q59 46 45 46Q32 46 32 26" fill="none" stroke="#FFB3C7" stroke-width="1.6" stroke-dasharray="2 2"/>'
    + '<path d="M2 44h12M50 44h12" stroke="#E8234A" stroke-width="3" stroke-linecap="round"/><circle cx="32" cy="27" r="2.8" fill="#FFE29A"/></svg>',
  // String / tanga en dentelle noire
  string: '<svg viewBox="0 0 64 64"><path d="M4 16Q32 26 60 16" stroke="#1D1C25" stroke-width="3.2" fill="none" stroke-linecap="round"/>'
    + '<path d="M12 20L52 20L36 50L28 50Z" fill="#1D1C25"/><path d="M12 20L28 50M52 20L36 50" stroke="#FF8FB8" stroke-width="1.8" stroke-dasharray="2.5 2"/>'
    + '<path d="M28 24l4 3 4-3-4 6z" fill="#E8234A"/></svg>',
  // Bas résille et porte-jarretelle : un bas
  bas: '<svg viewBox="0 0 64 64"><path d="M22 4H40L38 48C38 54 44 56 50 58C52 60 50 62 46 62H26C24 62 22 60 23 56L24 48Z" fill="#2A2833"/>'
    + '<path d="M22 4H40V11H22Z" fill="#E8234A"/><path d="M24 15l14 10M24 25l14 10M24 35l14 10M38 15L24 25M38 25L24 35M38 35L24 45" stroke="#4A4656" stroke-width="1"/>'
    + '<path d="M31 11V2" stroke="#E8234A" stroke-width="1.6"/></svg>'
};
const PI_EMOJIS = ['💋', '❤️', '💗', '🔥', '❤️‍🔥', '💞'];
// Photos réalistes (générées avec Qwen-Image 2.1, détourées, WebP) — 23/11/2026.
const PI_PHOTOS = ['wand', 'rabbit', 'lecheur', 'plug', 'menottes', 'martinet', 'baillon', 'collier', 'masque',
  'plume', 'soutif', 'string', 'jarretelle', 'escarpin'].map(n => 'hot/' + n + '.webp');
// Illustrations Kamasutra (homme rouge foncé, femme jaune, sans détail anatomique), générées et détourées.
const PI_SILHOUETTES = ['andromaque', 'levrette', 'debout', 'lotus', 'missionnaire', 'cuillere'].map(n => 'hot/sil_' + n + '.webp');
let piPhotosPretes = null;
function piPrecharger(){
  if(!piPhotosPretes) piPhotosPretes = Promise.all(PI_PHOTOS.concat(PI_SILHOUETTES).map(src => new Promise(ok => {
    const i = new Image(); i.onload = i.onerror = ok; i.src = src;
  })));
  return piPhotosPretes;
}

let piIntroFin = null;

function piIntro(suite){
  const ancien = document.getElementById('pi-intro');
  if(ancien) ancien.remove();
  const el = document.createElement('div');
  el.id = 'pi-intro';
  // Chaque photo passe une fois (dans le désordre), plus les silhouettes et quelques cœurs.
  const melange = a => a.slice().sort(() => Math.random() - .5);
  const liste = melange(PI_PHOTOS.map(src => ({ src, taille: 100 + Math.random() * 40 }))
    .concat(PI_SILHOUETTES.map(src => ({ src, taille: 120 + Math.random() * 30, sil: true })))
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
  let fini = false;
  const finir = () => {
    if(fini) return; fini = true;
    clearTimeout(piIntroFin);
    el.classList.add('pii-sortie');
    setTimeout(() => { el.remove(); if(typeof suite === 'function') suite(); }, 450);
  };
  el.addEventListener('click', finir);
  document.body.appendChild(el);
  // On attend les photos (au plus 1,5 s) pour qu'elles ne surgissent pas à moitié chargées.
  Promise.race([piPrecharger(), new Promise(ok => setTimeout(ok, 1500))]).then(() => {
    if(fini) return;
    el.insertAdjacentHTML('beforeend', h);
    piIntroFin = setTimeout(finir, PI_INTRO_MS);
  });
}
