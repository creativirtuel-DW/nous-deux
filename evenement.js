/**
 * Nous Deux — bannière d'événement à venir
 * ========================================
 * Bannière clignotante en haut de l'accueil (au-dessus de « Une pensée par
 * jour ») qui annonce le prochain événement avec un compte à rebours en
 * jours + heures. Pour l'instant : le calendrier de l'Avent, dont la première
 * case s'ouvre le 1er décembre 2026 à minuit (heure de Paris).
 * Pastille « En savoir + » (21/11/2026) : ouvre une fenêtre de présentation.
 */

const EVT = {
  titre: "Calendrier de l'Avent",
  icone: '🎄',
  date: new Date('2026-12-01T00:00:00+01:00'),  // minuit, heure de Paris (hiver)
  description: [
    "Le mois de décembre et son traditionnel calendrier de l'Avent approchent ! Rien que pour vous, ce calendrier de l'Avent de couple vous permettra de découvrir chaque jour une surprise.",
    "Cela pourra être une action que devra réaliser votre partenaire, un petit cadeau qui devra vous trouver, ou encore une attention que votre partenaire vous fera lorsque vous en déciderez.",
    "Restez connectés, d'autres détails et précisions seront bientôt disponibles…"
  ]
};

// Jours et heures restants avant l'ouverture, ou null si la date est passée.
function evtCompteARebours(){
  const reste = EVT.date.getTime() - Date.now();
  if(reste <= 0) return null;
  return { jours: Math.floor(reste / 86400000), heures: Math.floor((reste % 86400000) / 3600000) };
}

// Aspect « ruban » festif, volontairement différent des cases de l'accueil :
// bande en dégradé cerise → or, reflet qui passe en boucle, décompte en pastilles.
function renderEvenement(){
  const el = document.getElementById('evt-banniere');
  if(!el) return;
  const d = evtCompteARebours();
  // Visible seulement sur l'accueil, et jusqu'à la date de l'événement.
  if(!d || typeof accueilVisible !== 'function' || !accueilVisible()){ el.style.display = 'none'; return; }
  el.style.display = '';
  const html = '<span class="evt-ic">' + EVT.icone + '</span>'
    + '<span class="evt-txt"><small>Bientôt <button type="button" class="evt-plus" data-evt-plus>En savoir +</button></small><strong>' + EVT.titre + '</strong></span>'
    + '<span class="evt-decompte">'
    + (d.jours > 0 ? '<span class="evt-case"><b>' + d.jours + '</b>j</span>' : '')
    + '<span class="evt-case"><b>' + d.heures + '</b>h</span></span>';
  if(el.innerHTML !== html) el.innerHTML = html;
}

// Le compte à rebours avance même sans activité dans la partie.
setInterval(renderEvenement, 60000);

// Fenêtre « En savoir + » : un appui sur la pastille (ou sur la bannière).
function evtOuvrirInfos(){
  if(document.getElementById('evt-popup')) return;
  const el = document.createElement('div');
  el.id = 'evt-popup';
  el.className = 'evt-popup';
  el.innerHTML = '<div class="evt-popup-carte" role="dialog" aria-label="' + EVT.titre + '">'
    + '<div class="evt-popup-ic">' + EVT.icone + '</div>'
    + '<h3>' + EVT.titre + '</h3>'
    + EVT.description.map(p => '<p>' + p + '</p>').join('')
    + '<button type="button" class="btn-primary" data-evt-fermer>J’ai hâte !</button></div>';
  document.body.appendChild(el);
  el.addEventListener('click', e => {
    if(e.target === el || e.target.closest('[data-evt-fermer]')) el.remove();
  });
}
document.addEventListener('click', e => {
  if(e.target.closest && e.target.closest('#evt-banniere')) evtOuvrirInfos();
});
