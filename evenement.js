/**
 * Nous Deux — bannière d'événement à venir
 * ========================================
 * Bannière clignotante en haut de l'accueil (au-dessus de « Une pensée par
 * jour ») qui annonce le prochain événement avec un compte à rebours en
 * jours + heures. Pour l'instant : le calendrier de l'Avent, dont la première
 * case s'ouvre le 1er décembre 2026 à minuit (heure de Paris).
 * Simple annonce : la bannière n'ouvre rien encore.
 */

const EVT = {
  titre: "Calendrier de l'Avent",
  icone: '🎄',
  date: new Date('2026-12-01T00:00:00+01:00')   // minuit, heure de Paris (hiver)
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
    + '<span class="evt-txt"><small>Bientôt</small><strong>' + EVT.titre + '</strong></span>'
    + '<span class="evt-decompte">'
    + (d.jours > 0 ? '<span class="evt-case"><b>' + d.jours + '</b>j</span>' : '')
    + '<span class="evt-case"><b>' + d.heures + '</b>h</span></span>';
  if(el.innerHTML !== html) el.innerHTML = html;
}

// Le compte à rebours avance même sans activité dans la partie.
setInterval(renderEvenement, 60000);
