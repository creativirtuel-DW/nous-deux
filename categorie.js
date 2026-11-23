/**
 * Nous Deux — page d'un jeu de cartes (pour l'instant : Défi)
 * ===========================================================
 * Demande du 23/11/2026 : toucher « Défi » (puis aussi « Question » et
 * « Cap ou pas ») ne pioche plus directement. On
 * arrive sur une page qui regroupe tout ce qui concerne ce jeu :
 *   · le bouton « Nouveau défi » (la pioche, comme avant : la carte s'ouvre
 *     en plein écran) ;
 *   · les défis reçus de l'autre, à valider ;
 *   · mes défis en cours (à réaliser, ou en attente de validation) ;
 *   · les défis piochés par l'autre et pas encore faits.
 * Les cartes restent aussi dans la cloche. Pour donner la même page à
 * Question ou à Cap ou pas, il suffit d'ajouter leur clé dans CAT_PAGES.
 */
const CAT_PAGES = ['question', 'defi', 'gage'];   // 23/11/2026 : les trois jeux de cartes

const CAT_INFOS = {
  defi:     { ic: '🔥', titre: 'Défi', nouveau: 'Nouveau défi', un: 'défi', des: 'défis', ce: 'ce défi', ces: 'ces défis',
              fait: 'a réalisé', pasFait: 'ne l’a pas encore réalisé', aucun: 'Aucun défi en cours',
              sous: 'Pioche un défi, réalise-le, et ton/ta partenaire le valide pour te donner les points.' },
  question: { ic: '💬', titre: 'Question', nouveau: 'Nouvelle question', un: 'question', des: 'questions', ce: 'cette question', ces: 'ces questions',
              fait: 'a répondu à', pasFait: 'n’y a pas encore répondu', aucun: 'Aucune question en cours',
              sous: 'Pioche une question, réponds-y, et ton/ta partenaire valide ta réponse.' },
  gage:     { ic: '😈', titre: 'Cap ou pas', nouveau: 'Nouvelle carte', un: 'carte', des: 'cartes', ce: 'cette carte', ces: 'ces cartes',
              fait: 'a relevé', pasFait: 'ne l’a pas encore relevée', aucun: 'Aucune carte en cours',
              sous: 'Cap ou pas cap ? Pioche une carte et relève le défi.' }
};

let catPageActive = null;     // 'defi' quand la page est ouverte
let catSignature = '';

function catPageOuvrir(cat){ catPageActive = cat; catSignature = ''; render(); window.scrollTo(0, 0); }
function catPageFermer(){ catPageActive = null; catSignature = ''; render(); }

function renderCatPage(){
  const panel = $('#cat-panel');
  if(!panel) return;
  if(!catPageActive || !state){ panel.style.display = 'none'; return; }
  panel.style.display = 'flex';

  const cat = catPageActive;
  const info = CAT_INFOS[cat];
  const tous = getPendingEntries().filter(([k, p]) => p.cat === cat);
  const aValider = tous.filter(([k, p]) => p.by !== me.id && p.status === 'review');
  const miens = tous.filter(([k, p]) => p.by === me.id);
  const chezAutre = tous.filter(([k, p]) => p.by === partnerId && p.status !== 'review');
  const pleine = getPendingEntries().length >= MAX_PENDING;
  const nomAutre = (state.players && state.players[partnerId]) || 'ton/ta partenaire';

  // On ne reconstruit que si quelque chose a changé, et jamais pendant une
  // saisie (sinon le commentaire en cours serait effacé).
  const body = $('#cat-body');
  const actif = document.activeElement;
  if(actif && /^(TEXTAREA|INPUT)$/.test(actif.tagName) && body.contains(actif)) return;
  const signature = JSON.stringify([cat, tous, pleine, nomAutre, getSkipCount(me.id, cat), state.rappels || null]);
  if(signature === catSignature) return;
  catSignature = signature;

  const nb = (n, un, des) => n + ' ' + (n > 1 ? des : un);
  body.innerHTML = `
    <div class="jds-intro">
      <span class="jds-emoji">${info.ic}</span>
      <h3 class="jds-title">${info.titre}</h3>
      <p class="jds-sub">${info.sous}</p>
    </div>
    <button type="button" class="btn-primary cat-nouveau" id="cat-nouveau"${pleine ? ' disabled' : ''}>${info.ic} ${info.nouveau}</button>
    ${pleine ? `<p class="cat-note">🚫 File pleine (${MAX_PENDING}/${MAX_PENDING}) : valide ou termine une carte pour en piocher une nouvelle.</p>` : ''}
    <div class="cat-section" id="cat-avalider" ${aValider.length ? '' : 'style="display:none;"'}>
      <h3 class="pending-title">À toi de valider <span class="cat-compte">${aValider.length}</span></h3>
      <p class="cat-note">${escapeHtml(nomAutre)} ${info.fait} ${aValider.length > 1 ? info.ces : info.ce} : à toi de dire si c’est validé.</p>
      <div class="pending-list"></div>
    </div>
    <div class="cat-section" id="cat-miens" ${miens.length ? '' : 'style="display:none;"'}>
      <h3 class="pending-title">Tes ${info.des} en cours <span class="cat-compte">${miens.length}</span></h3>
      <div class="pending-list"></div>
    </div>
    <div class="cat-section" id="cat-autre" ${chezAutre.length ? '' : 'style="display:none;"'}>
      <h3 class="pending-title">Chez ${escapeHtml(nomAutre)} <span class="cat-compte">${chezAutre.length}</span></h3>
      <div class="pending-list"></div>
    </div>
    ${!aValider.length && !miens.length && !chezAutre.length
      ? `<p class="empty-state cat-vide">${info.aucun}.<br>Touche « ${info.nouveau} » pour commencer !</p>` : ''}
  `;

  const nouveau = $('#cat-nouveau');
  if(nouveau) nouveau.addEventListener('click', () => { if(!pleine) drawCard(cat); });

  const liste = id => body.querySelector('#' + id + ' .pending-list');
  aValider.forEach(([key, p]) => liste('cat-avalider').appendChild(construireCarteAValider(key, p)));
  miens.forEach(([key, p]) => {
    const row = construireCarteMine(key, p);
    // Un appui sur le texte d'une carte à jouer la rouvre en plein écran.
    if(p.status !== 'review'){
      const t = row.querySelector('.pending-text');
      if(t){ t.classList.add('pending-text-ouvrir'); t.addEventListener('click', () => cpOuvrir(key, false)); }
    }
    liste('cat-miens').appendChild(row);
  });
  chezAutre.forEach(([key, p]) => {
    const row = document.createElement('div');
    row.className = 'pending-card waiting';
    row.innerHTML = `<div class="pending-card-top"><span class="pending-cat">${info.ic} ${info.titre}</span>
        <span class="pending-who">chez ${escapeHtml(nomAutre)}</span></div>
      <div class="skip-note">⏳ ${escapeHtml(nomAutre)} a pioché ${info.ce} et ${info.pasFait}.</div>
      ${rappelHTML('carte_' + key, cat === 'question' ? 'question' : 'defi')}`;
    liste('cat-autre').appendChild(row);
  });
}

document.addEventListener('click', e => {
  if(e.target.closest && e.target.closest('#cat-back')) catPageFermer();
});
