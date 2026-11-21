/**
 * Nous Deux — la cloche des notifications
 * =======================================
 * Chaque notification envoyée au/à la partenaire (notifyPartner, push.js)
 * est aussi rangée dans la room, même s'il/elle n'a pas activé les
 * notifications push. La cloche en haut de l'appli affiche le nombre de
 * notifications pas encore consultées ; un appui ouvre la liste, et un appui
 * sur une notification emmène au bon endroit.
 *
 * Depuis le 21/11/2026, les cartes en attente (à valider, à jouer, chez
 * l'autre) ne sont plus sur l'accueil : elles sont en tête de ce volet.
 * Pastilles rouges : sur la cloche, sur les tuiles de jeux (et le bouton
 * Jouer) qui attendent une action, et sur l'icône de l'appli (API Badging,
 * iPhone 16.4+ avec l'appli installée et les notifications acceptées).
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
// Notifications qui annoncent une carte à valider : la carte elle-même est
// comptée (tant qu'elle n'est pas validée), on ne compte pas la notif en plus.
const CLOCHE_TAGS_CARTES = ['valider', 'rappel-question', 'rappel-defi'];

function clocheNonLuesDe(pid){
  const lu = (state && state.notifsLu && state.notifsLu[pid]) || 0;
  return Object.values((state && state.notifs && state.notifs[pid]) || {})
    .filter(n => n && n.ts > lu && CLOCHE_TAGS_CARTES.indexOf(n.tag || '') === -1).length;
}
function clocheNonLues(){ return clocheNonLuesDe(me.id); }

// Ce qui attend une action de `pid`, jeu par jeu.
function aFaireParJeu(pid){
  const r = { question: 0, defi: 0, gage: 0, battle: 0, synchro: 0, photo: 0 };
  if(!state || !pid) return r;
  Object.values(state.pendingCards || {}).forEach(p => {
    if(!p || !(p.cat in r)) return;
    const aValider = p.by !== pid && p.status === 'review';   // jouée par l'autre, à valider
    const aJouer = p.by === pid && p.status !== 'review';     // piochée, pas encore jouée
    if(aValider || aJouer) r[p.cat]++;
  });
  const b = state.battle;
  if(b && b.status === 'attente' && b.by && b.by !== pid) r.battle = 1;
  Object.values(state.synchro || {}).forEach(x => { if(x && x.status === 'attente' && x.by && x.by !== pid) r.synchro++; });
  const d = state.photoDefi;
  if(d && d.by && d.by !== pid && ['sent', 'viewing', 'answering', 'lost'].indexOf(d.status) !== -1) r.photo = 1;
  return r;
}
// Résultats pas encore consultés : notifications « <jeu>-resultat » arrivées
// depuis la dernière ouverture du jeu (rooms/$room/vus/<pid>/<jeu>).
const JEUX_RESULTATS = ['battle', 'synchro', 'photo'];
const vusLocal = {};   // marqué « vu » ici, avant le retour de la base
function resultatsNonVus(pid, jeu){
  const vu = Math.max((state && state.vus && state.vus[pid] && state.vus[pid][jeu]) || 0, pid === me.id ? (vusLocal[jeu] || 0) : 0);
  return Object.values((state && state.notifs && state.notifs[pid]) || {})
    .filter(n => n && n.tag === jeu + '-resultat' && n.ts > vu);
}
// Jeu ouvert : ses résultats sont vus. Dans « On est synchro », on rejoue
// l'animation du dernier résultat arrivé pendant l'absence.
function marquerResultatsVus(){
  const ouverts = { battle: typeof battleActive !== 'undefined' && battleActive,
                    synchro: typeof synchroActive !== 'undefined' && synchroActive,
                    photo: typeof photoActive !== 'undefined' && photoActive };
  JEUX_RESULTATS.forEach(jeu => {
    if(!ouverts[jeu] || !roomRef) return;
    const nv = resultatsNonVus(me.id, jeu);
    if(!nv.length) return;
    const maintenant = Date.now();
    vusLocal[jeu] = maintenant;
    setTimeout(() => roomRef.child('vus/' + me.id + '/' + jeu).set(maintenant), 0);
    if(jeu === 'synchro' && typeof synchroAnimer === 'function' && typeof synchroResultats === 'function'){
      const dernier = synchroResultats().find(([k, s]) => s.by === me.id);
      if(dernier) synchroAnimer(!!dernier[1].ok, dernier[1].gain || 0, dernier[1].q);
    }
  });
}

function cartesAFaire(pid){ const r = aFaireParJeu(pid); return r.question + r.defi + r.gage; }

// Le chiffre de la cloche (et de l'icône de l'appli) : notifications non lues
// + cartes qui attendent une action.
function clocheTotal(pid){ return clocheNonLuesDe(pid) + cartesAFaire(pid); }

// Pastille sur l'icône de l'appli (écran d'accueil). Sans effet si le
// téléphone ne sait pas faire.
function clocheIcone(n){
  try{
    if(!('setAppBadge' in navigator)) return;
    (n > 0 ? navigator.setAppBadge(n) : navigator.clearAppBadge()).catch(() => {});
  }catch(e){}
}

// Pastilles rouges sur les tuiles de la page des jeux et sur le bouton Jouer.
function renderPastillesJeux(){
  if(!state || !me || !me.id) return;
  marquerResultatsVus();
  const r = aFaireParJeu(me.id);
  JEUX_RESULTATS.forEach(jeu => { r[jeu] += resultatsNonVus(me.id, jeu).length; });
  let total = 0;
  document.querySelectorAll('.cat-btn').forEach(btn => {
    const n = r[btn.dataset.cat] || 0;
    total += n;
    clochePastille(btn, n);
  });
  const jouer = document.getElementById('jouer-btn');
  if(jouer) clochePastille(jouer, total);
}
function clochePastille(el, n){
  let p = el.querySelector(':scope > .jeu-n');
  if(!n){ if(p) p.remove(); return; }
  if(!p){ p = document.createElement('span'); p.className = 'jeu-n'; el.appendChild(p); }
  p.textContent = n > 9 ? '9+' : n;
}

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
  if(!clocheOuverte){
    clocheOuverte = true;
    clocheLuAvant = clocheDernierLu();
    clocheSignature = '';
    if(roomRef) roomRef.child('notifsLu/' + me.id).set(Date.now());
    renderCloche();
  }
  const zone = $('#cloche-defile');
  if(zone) zone.scrollTop = 0;   // les cartes en attente sont en tête
}
function clocheFermer(){ clocheOuverte = false; clocheSignature = ''; renderCloche(); }

function clocheToutEffacer(){
  if(!confirm('Effacer toutes tes notifications ?')) return;
  roomRef.child('notifs/' + me.id).remove();
}

// Un appui sur une notification : on ferme et on emmène au bon endroit.
function clocheAller(tag){
  const t = (tag || '').replace(/^rappel-/, '').replace(/-resultat$/, '');
  // Cartes (à valider, à jouer…) : elles sont en tête de ce volet.
  if(!t || t === 'valider' || t === 'question' || t === 'defi'){
    const zone = $('#cloche-defile');
    if(zone) zone.scrollTo({ top: 0, behavior: 'smooth' });
    return;
  }
  clocheFermer();
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
  render();
  window.scrollTo(0, 0);
}

function renderCloche(){
  const btn = $('#cloche-btn');
  if(!btn || !state || !me || !me.id) return;
  const n = clocheTotal(me.id);
  const pastille = btn.querySelector('.cloche-n');
  pastille.textContent = n > 9 ? '9+' : n;
  pastille.style.display = n ? '' : 'none';
  btn.classList.toggle('a-lire', n > 0);
  btn.setAttribute('aria-label', n ? n + ' notification' + (n > 1 ? 's' : '') + ' à consulter' : 'Notifications');
  clocheIcone(n);

  const panneau = $('#cloche-panel');
  if(!clocheOuverte){ panneau.style.display = 'none'; clocheSignature = ''; return; }
  panneau.style.display = '';
  const cartes = [...document.querySelectorAll('#cloche-cartes .pending-section')].some(x => x.style.display !== 'none');
  const liste = clocheListe();
  const signature = JSON.stringify(liste) + '|' + cartes + '|' + Math.floor(Date.now() / 60000);
  if(signature === clocheSignature) return;
  clocheSignature = signature;

  let h = '';
  if(!liste.length){
    if(!cartes) h = '<p class="empty-state cloche-vide">Rien de neuf pour l’instant.<br>Les cartes jouées, validées, les défis lancés… apparaîtront ici.</p>';
  }else{
    if(cartes) h += '<h3 class="pending-title cloche-sous-titre">Dernières notifications</h3>';
    h += '<div class="cloche-liste">' + liste.map(([k, n]) =>
      '<button type="button" class="cloche-item' + (n.ts > clocheLuAvant ? ' nouvelle' : '') + '" data-cloche-tag="' + escapeHtml(n.tag || '') + '">'
      + '<span class="cloche-item-t">' + escapeHtml(n.t) + '</span>'
      + (n.b ? '<span class="cloche-item-b">' + escapeHtml(n.b) + '</span>' : '')
      + '<span class="cloche-item-q">' + clocheQuand(n.ts) + '</span></button>'
    ).join('') + '</div>'
    + '<button type="button" class="btn-ghost cloche-effacer" data-cloche-effacer>Effacer les notifications</button>';
  }
  $('#cloche-notifs').innerHTML = h;
}

document.addEventListener('click', e => {
  // Appui sur la pastille d'une tuile Question / Défi / Cap ou pas : on montre
  // les cartes en attente au lieu de piocher. (Les autres tuiles ouvrent leur
  // jeu, où l'action attend déjà.)
  const pastille = e.target.closest && e.target.closest('.cat-btn > .jeu-n');
  if(pastille && ['question', 'defi', 'gage'].indexOf(pastille.parentNode.dataset.cat) !== -1){
    e.stopPropagation(); e.preventDefault();
    clocheOuvrir();
    return;
  }
  const c = e.target.closest && e.target.closest('#cloche-btn, [data-cloche-fermer], [data-cloche-tag], [data-cloche-effacer]');
  if(!c) return;
  e.stopPropagation();
  if(c.id === 'cloche-btn') clocheOuverte ? clocheFermer() : clocheOuvrir();
  else if(c.hasAttribute('data-cloche-fermer')) clocheFermer();
  else if(c.hasAttribute('data-cloche-effacer')) clocheToutEffacer();
  else clocheAller(c.dataset.clocheTag);
}, true);

// ====== RAPPEL À L'OUVERTURE (21/11/2026) ======
// À la connexion, si le/la partenaire a laissé des choses à faire (cartes à
// valider, Battle, Synchro, photo, Plaisirs Intimes) ou des résultats à
// découvrir, une fenêtre le rappelle en premier, juste après l'animation
// d'ouverture et au-dessus du message de bienvenue.
let rappelOuvertureFait = false;

function rappelOuvertureLignes(){
  const r = aFaireParJeu(me.id);
  // Les cartes que j'ai piochées moi-même ne viennent pas du/de la partenaire.
  const aValider = { question: 0, defi: 0, gage: 0 };
  Object.values(state.pendingCards || {}).forEach(p => {
    if(p && p.by !== me.id && p.status === 'review' && p.cat in aValider) aValider[p.cat]++;
  });
  const pl = (n, un, plusieurs) => n + ' ' + (n > 1 ? plusieurs : un);
  const lignes = [];
  if(aValider.question) lignes.push(['💬', 'Question', pl(aValider.question, 'réponse à valider', 'réponses à valider')]);
  if(aValider.defi) lignes.push(['🔥', 'Défi', pl(aValider.defi, 'défi à valider', 'défis à valider')]);
  if(aValider.gage) lignes.push(['😈', 'Cap ou pas', pl(aValider.gage, 'carte à valider', 'cartes à valider')]);
  const res = jeu => resultatsNonVus(me.id, jeu).length;
  if(r.battle) lignes.push(['⚔️', 'Battle', 'une Battle t’attend']);
  else if(res('battle')) lignes.push(['⚔️', 'Battle', 'résultat à découvrir']);
  if(r.synchro) lignes.push(['💞', 'On est synchro !', pl(r.synchro, 'question t’attend', 'questions t’attendent')]);
  if(res('synchro')) lignes.push(['💞', 'On est synchro !', pl(res('synchro'), 'résultat à découvrir', 'résultats à découvrir')]);
  if(r.photo) lignes.push(['📸', 'T’as la date ?', 'une photo t’attend']);
  else if(res('photo')) lignes.push(['📸', 'T’as la date ?', 'résultat à découvrir']);
  if(typeof piVisible === 'function' && piVisible() && typeof piAValider === 'function'){
    const n = piAValider().length;
    if(n) lignes.push(['🌶️', 'Plaisirs Intimes', pl(n, 'réponse à valider', 'réponses à valider')]);
  }
  return lignes;
}

function rappelOuverture(){
  if(rappelOuvertureFait) return;
  rappelOuvertureFait = true;
  // On attend la fin de l'animation d'ouverture.
  const attendre = () => {
    if(document.getElementById('splash')) return setTimeout(attendre, 300);
    rappelOuvertureAfficher();
  };
  setTimeout(attendre, 0);
}

function rappelOuvertureAfficher(){
  if(!state || !me || !me.id || document.getElementById('rp-ouverture')) return;
  const lignes = rappelOuvertureLignes();
  if(!lignes.length) return;
  const nom = (state.players && state.players[partnerId]) || 'Ton/ta partenaire';
  const el = document.createElement('div');
  el.id = 'rp-ouverture';
  el.className = 'rp-ouverture';
  el.innerHTML = '<div class="rp-carte" role="dialog" aria-label="À ne pas manquer">'
    + '<div class="rp-ic">💌</div>'
    + '<h3>' + escapeHtml(nom) + ' attend ta réponse !</h3>'
    + '<p class="rp-intro">Pendant ton absence, il s’est passé des choses :</p>'
    + '<div class="rp-liste">' + lignes.map(([ic, jeu, txt]) =>
        '<div class="rp-ligne"><span class="rp-ligne-ic">' + ic + '</span>'
        + '<span class="rp-ligne-txt"><b>' + jeu + '</b><small>' + txt + '</small></span></div>').join('') + '</div>'
    + '<p class="rp-astuce">Les pastilles rouges t’indiquent où aller.</p>'
    + '<button type="button" class="btn-primary" data-rp-fermer>Je vais aller voir !</button></div>';
  document.body.appendChild(el);
  el.addEventListener('click', e => {
    if(e.target.closest('[data-rp-fermer]')){ el.classList.add('rp-sortie'); setTimeout(() => el.remove(), 250); }
  });
}
