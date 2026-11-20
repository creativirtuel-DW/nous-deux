/**
 * Nous Deux — la cloche des notifications
 * =======================================
 * Chaque notification envoyée au/à la partenaire (notifyPartner, push.js)
 * est aussi rangée dans la room, même s'il/elle n'a pas activé les
 * notifications push. La cloche en haut de l'appli affiche le nombre de
 * notifications pas encore consultées ; un appui ouvre la liste, et un appui
 * sur une notification emmène au bon endroit.
 *
 * Base : rooms/$room/notifs/<pid destinataire>/<clé> = { t, b, tag, ts, de }
 *        rooms/$room/notifsLu/<pid> = horodatage de la dernière consultation
 */

const CLOCHE_GARDEES = 40;                     // notifications conservées par personne
const CLOCHE_DUREE_MS = 30 * 86400000;         // et pas plus vieilles que 30 jours

let clocheOuverte = false;
let clocheLuAvant = 0;      // « lu » au moment de l'ouverture : les nouvelles restent surlignées
let clocheSignature = '';

// Appelée par notifyPartner (push.js) avant l'envoi push.
function clocheEnregistrer(titre, texte, tag){
  try{
    if(!roomRef || !partnerId || !state || !state.players || !state.players[partnerId]) return;
    const ref = roomRef.child('notifs/' + partnerId);
    const updates = {};
    updates[ref.push().key] = { t: titre || '', b: texte || '', tag: tag || '', ts: Date.now(), de: me.id };
    // Ménage : on garde les plus récentes, et rien de plus vieux que 30 jours.
    const existantes = Object.entries((state.notifs && state.notifs[partnerId]) || {})
      .sort((x, y) => (y[1].ts || 0) - (x[1].ts || 0));
    existantes.forEach(([k, n], i) => {
      if(i >= CLOCHE_GARDEES - 1 || Date.now() - (n.ts || 0) > CLOCHE_DUREE_MS) updates[k] = null;
    });
    ref.update(updates);
  }catch(e){}
}

function clocheListe(){
  return Object.entries((state && state.notifs && state.notifs[me.id]) || {})
    .filter(([k, n]) => n && n.ts)
    .sort((x, y) => y[1].ts - x[1].ts);
}
function clocheDernierLu(){ return (state && state.notifsLu && state.notifsLu[me.id]) || 0; }
function clocheNonLues(){ const lu = clocheDernierLu(); return clocheListe().filter(([k, n]) => n.ts > lu).length; }

function clocheQuand(ts){
  const s = Math.floor((Date.now() - ts) / 1000);
  if(s < 60) return "à l'instant";
  if(s < 3600) return 'il y a ' + Math.floor(s / 60) + ' min';
  const d = new Date(ts), auj = new Date();
  const hh = String(d.getHours()).padStart(2, '0') + 'h' + String(d.getMinutes()).padStart(2, '0');
  if(d.toDateString() === auj.toDateString()) return "aujourd'hui à " + hh;
  const hier = new Date(auj); hier.setDate(auj.getDate() - 1);
  if(d.toDateString() === hier.toDateString()) return 'hier à ' + hh;
  return d.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' }) + ' à ' + hh;
}

function clocheOuvrir(){
  clocheOuverte = true;
  clocheLuAvant = clocheDernierLu();
  clocheSignature = '';
  if(roomRef) roomRef.child('notifsLu/' + me.id).set(Date.now());
  renderCloche();
}
function clocheFermer(){ clocheOuverte = false; clocheSignature = ''; renderCloche(); }

function clocheToutEffacer(){
  if(!confirm('Effacer toutes tes notifications ?')) return;
  roomRef.child('notifs/' + me.id).remove();
}

// Un appui sur une notification : on ferme et on emmène au bon endroit.
function clocheAller(tag){
  clocheFermer();
  const t = (tag || '').replace(/^rappel-/, '');
  const accueil = document.querySelector('.tab[data-view="view-play"]');
  if(accueil && !accueil.classList.contains('active')) accueil.click();
  const actions = {
    battle:   () => openBattle(),
    synchro:  () => openSynchro(),
    photo:    () => openPhoto(),
    soiree:   () => openSoiree(),
    plaisirs: () => piOuvrir(),
    pensee:   () => qdjOuvrir(),
    qdj:      () => qdjOuvrir(),
    coffre:   () => cjOuvrirPage()
  };
  try{
    if(actions[t]){ actions[t](); return; }
  }catch(e){}
  // Cartes (à valider, à jouer…) : elles sont sur l'accueil, sous « Jouer ».
  render();
  const cible = [...document.querySelectorAll('.pending-section')].find(s => s.style.display !== 'none');
  if(cible) cible.scrollIntoView({ behavior: 'smooth', block: 'start' });
  else window.scrollTo(0, 0);
}

function renderCloche(){
  const btn = $('#cloche-btn');
  if(!btn || !state || !me || !me.id) return;
  const n = clocheNonLues();
  const pastille = btn.querySelector('.cloche-n');
  pastille.textContent = n > 9 ? '9+' : n;
  pastille.style.display = n ? '' : 'none';
  btn.classList.toggle('a-lire', n > 0);
  btn.setAttribute('aria-label', n ? n + ' notification' + (n > 1 ? 's' : '') + ' à consulter' : 'Notifications');

  const panneau = $('#cloche-panel');
  if(!clocheOuverte){ panneau.style.display = 'none'; clocheSignature = ''; return; }
  const liste = clocheListe();
  const signature = JSON.stringify(liste) + '|' + Math.floor(Date.now() / 60000);
  if(signature === clocheSignature) return;
  clocheSignature = signature;
  panneau.style.display = '';

  let h = '<div class="cloche-feuille" role="dialog" aria-label="Notifications">'
    + '<div class="cloche-tete"><h3>Notifications</h3>'
    + '<button type="button" class="qdj-fermer cloche-fermer" aria-label="Fermer" data-cloche-fermer>✕</button></div>';
  if(!liste.length){
    h += '<p class="empty-state cloche-vide">Rien de neuf pour l’instant.<br>Les cartes jouées, validées, les défis lancés… apparaîtront ici.</p>';
  }else{
    h += '<div class="cloche-liste">' + liste.map(([k, n]) =>
      '<button type="button" class="cloche-item' + (n.ts > clocheLuAvant ? ' nouvelle' : '') + '" data-cloche-tag="' + escapeHtml(n.tag || '') + '">'
      + '<span class="cloche-item-t">' + escapeHtml(n.t) + '</span>'
      + (n.b ? '<span class="cloche-item-b">' + escapeHtml(n.b) + '</span>' : '')
      + '<span class="cloche-item-q">' + clocheQuand(n.ts) + '</span></button>'
    ).join('') + '</div>'
    + '<button type="button" class="btn-ghost cloche-effacer" data-cloche-effacer>Tout effacer</button>';
  }
  panneau.innerHTML = '<div class="cloche-voile" data-cloche-fermer></div>' + h + '</div>';
}

document.addEventListener('click', e => {
  const c = e.target.closest && e.target.closest('#cloche-btn, [data-cloche-fermer], [data-cloche-tag], [data-cloche-effacer]');
  if(!c) return;
  e.stopPropagation();
  if(c.id === 'cloche-btn') clocheOuverte ? clocheFermer() : clocheOuvrir();
  else if(c.hasAttribute('data-cloche-fermer')) clocheFermer();
  else if(c.hasAttribute('data-cloche-effacer')) clocheToutEffacer();
  else clocheAller(c.dataset.clocheTag);
}, true);
