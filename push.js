/**
 * Nous Deux — notifications push côté client
 * =========================================
 * · enregistre le service worker,
 * · demande la permission (sur un appui, iOS l'exige),
 * · range l'abonnement du téléphone dans la base, sous pushSubs/<joueur>,
 * · envoie une notification au/à la partenaire via le Worker Cloudflare.
 *
 * Sur iPhone : iOS 16.4 minimum, et l'app DOIT être installée sur l'écran
 * d'accueil. Dans un onglet Safari, l'abonnement est refusé — c'est une
 * limite d'Apple, pas un bug.
 */

const VAPID_PUBLIC_KEY = 'BL0HWYjjkYif-sbmug3Q_G-76Q6wK9UVTbIid5VUTzJ9W8RqqKviVj1dHEpQxfc4xpcPz_26Yd_QL7IDB13iTI0';

// Relais Cloudflare (compte creativirtuel, Worker « shy-scene-49bc »).
const PUSH_WORKER_URL = 'https://shy-scene-49bc.creativirtuel.workers.dev';

let swRegistration = null;
let pushBusy = false;

function pushSupported(){
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

// Safari n'expose le push que dans l'app installée sur l'écran d'accueil.
function isStandalone(){
  return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
}

function isIOS(){
  return /iPad|iPhone|iPod/.test(navigator.userAgent);
}

function urlB64ToUint8Array(base64String){
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for(let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

function registerServiceWorker(){
  if(!('serviceWorker' in navigator)) return;
  navigator.serviceWorker.register('sw.js')
    .then(reg => { swRegistration = reg; })
    .catch(err => console.warn('Service worker non enregistré :', err));
}

// Appelée après connexion à la room : si la permission est déjà accordée,
// on remet l'abonnement à jour silencieusement (il peut avoir été renouvelé).
function syncPushSubscription(){
  if(!pushSupported() || Notification.permission !== 'granted') return;
  subscribeToPush(true);
}

function subscribeToPush(silencieux){
  if(!pushSupported() || pushBusy) return Promise.resolve(false);
  pushBusy = true;

  return navigator.serviceWorker.ready
    .then(reg => {
      swRegistration = reg;
      return reg.pushManager.getSubscription().then(existing => existing || reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlB64ToUint8Array(VAPID_PUBLIC_KEY)
      }));
    })
    .then(sub => {
      if(!sub) return false;
      if(roomRef && me.id) roomRef.child('pushSubs/' + me.id).set(JSON.parse(JSON.stringify(sub)));
      return true;
    })
    .catch(err => {
      console.warn('Abonnement push impossible :', err);
      if(!silencieux) alert("L'abonnement aux notifications a échoué.\n\n" + (err && err.message ? err.message : ''));
      return false;
    })
    .finally(() => { pushBusy = false; render(); });
}

function askPushPermission(){
  if(!pushSupported()) return;

  if(isIOS() && !isStandalone()){
    alert("Sur iPhone, les notifications ne fonctionnent que depuis l'app installée sur l'écran d'accueil.\n\nDans Safari : bouton Partager → « Sur l'écran d'accueil », puis ouvre l'app depuis l'icône et réessaie.");
    return;
  }

  Notification.requestPermission().then(perm => {
    if(perm === 'granted') subscribeToPush(false);
    else render();
  });
}

// ---------- ENVOI ----------
// Prévient le/la partenaire. Sans abonnement enregistré de son côté,
// on ne fait rien : le jeu doit continuer même sans notifications.
function notifyPartner(title, body, tag){
  try{
    if(!state || !state.pushSubs) return;
    const sub = state.pushSubs[partnerId];
    if(!sub || !sub.endpoint) return;
    if(PUSH_WORKER_URL.indexOf('REMPLACER') !== -1) return;

    fetch(PUSH_WORKER_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sub: sub, payload: { title: title, body: body, tag: tag || 'nous-deux', url: './index.html' } })
    })
    .then(r => r.json())
    .then(res => {
      // Abonnement périmé (téléphone réinstallé, app supprimée) : on le retire.
      if(res && res.gone) roomRef.child('pushSubs/' + partnerId).remove();
    })
    .catch(() => {});   // pas de notification, tant pis : ça ne bloque jamais le jeu
  }catch(e){}
}

// ---------- BANDEAU DANS L'APP ----------
function renderPushBanner(){
  const el = $('#push-banner');
  if(!el) return;

  if(!pushSupported()){ el.style.display = 'none'; return; }

  const perm = Notification.permission;
  const abonne = state && state.pushSubs && state.pushSubs[me.id];

  if(perm === 'granted' && abonne){ el.style.display = 'none'; return; }

  el.style.display = 'flex';

  if(perm === 'denied'){
    el.className = 'push-banner muted';
    el.innerHTML = '<span class="push-ic">🔕</span><div class="push-txt"><strong>Notifications bloquées</strong>'
      + '<span>Réglages → Nous Deux → Notifications pour les réautoriser.</span></div>';
    return;
  }

  if(isIOS() && !isStandalone()){
    el.className = 'push-banner muted';
    el.innerHTML = '<span class="push-ic">📲</span><div class="push-txt"><strong>Installe l\'app pour les notifications</strong>'
      + '<span>Partager → « Sur l\'écran d\'accueil », puis ouvre-la depuis l\'icône.</span></div>';
    return;
  }

  el.className = 'push-banner';
  el.innerHTML = '<span class="push-ic">🔔</span><div class="push-txt"><strong>Activer les notifications</strong>'
    + '<span>Pour être prévenu·e des défis et des cartes à valider.</span></div>'
    + '<button class="push-btn" id="push-enable">Activer</button>';
  const b = $('#push-enable');
  if(b) b.addEventListener('click', askPushPermission);
}

window.addEventListener('DOMContentLoaded', registerServiceWorker);
