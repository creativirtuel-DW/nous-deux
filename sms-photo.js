/**
 * Nous Deux — « 📱 Envoyer directement par SMS » pour tout ce qui demande une photo
 * ==================================================================================
 * smsDemandePhoto(texte) repère une carte / un défi / un gage qui demande
 * d'ENVOYER ou de PRENDRE une photo (pas une question qui en parle).
 * smsOuvrir(texte) ouvre Messages, adressé au/à la partenaire si son numéro est
 * enregistré (UNIQUEMENT dans ce téléphone, jamais dans la base), avec un petit
 * texte : il ne reste qu'à joindre la photo et envoyer.
 *
 * Qui l'utilise :
 *   · app.js     — cartes de la pioche : la carte part « en attente de validation »
 *                  (pendingCards/<clé>/sms = ts) et le/la partenaire la valide ;
 *   · plaisirs.js — défis HOT : une entrée plaisirsReponses {sms:true} à valider ;
 *   · coffre-jour.js — gage du Coffre : bouton SMS en plus de « Gage réalisé ».
 */
const SMS_PHOTO_RE = /(\b(envoie|envoies|envoyer|prends|prendre|fais|faire)\b[^.!?]{0,60}\b(photo|selfie)s?\b)|^(une )?photo de toi|\bselfie\b/i;

function smsDemandePhoto(texte){ return SMS_PHOTO_RE.test(String(texte || '')); }

function smsCleTel(){ return 'nousdeux_tel_partenaire_' + (typeof roomCode !== 'undefined' ? roomCode : ''); }
function smsLireTel(){ try{ return localStorage.getItem(smsCleTel()) || ''; }catch(e){ return ''; } }
function smsEcrireTel(t){ try{ if(t) localStorage.setItem(smsCleTel(), t); else localStorage.removeItem(smsCleTel()); }catch(e){} }
function smsNomAutre(){
  return (typeof state !== 'undefined' && state && state.players && typeof partnerId !== 'undefined' && state.players[partnerId]) || 'ton/ta partenaire';
}

// Bouton à insérer dans une carte
function smsBouton(attr){
  return '<button type="button" class="sms-btn" ' + attr + '>📱 Envoyer directement par SMS</button>';
}

// Ouvre Messages. Si aucun numéro n'est enregistré, on le demande une fois.
function smsOuvrir(texte){
  const tel = smsLireTel();
  if(tel === ''){ smsDemanderTel(texte); return; }
  smsLancer(tel === '-' ? '' : tel, texte);
}

function smsLancer(tel, texte){
  const corps = '📸 Nous Deux — ma photo pour : « ' + String(texte || '').replace(/\{autre\}/g, smsNomAutre()) + ' »';
  const ios = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const num = String(tel || '').replace(/[^\d+]/g, '');
  window.location.href = 'sms:' + num + (ios ? '&' : '?') + 'body=' + encodeURIComponent(corps);
}

// Numéro du/de la partenaire, gardé seulement dans ce téléphone.
function smsDemanderTel(texte){
  const el = ptEcran('sms-tel');
  el.className = 'env-voile';
  el.style.zIndex = '9600';
  el.innerHTML = '<div class="env-pop"><div class="env-pop-ic">📱</div><h2>Envoyer par SMS</h2>'
    + '<p>Le numéro de <b>' + escapeHtml(smsNomAutre()) + '</b>, pour ouvrir Messages directement sur votre conversation.</p>'
    + '<input type="tel" class="sms-tel" placeholder="06 12 34 56 78" autocomplete="tel">'
    + '<p class="sms-note">Il reste uniquement dans ce téléphone, il n’est envoyé nulle part.</p>'
    + '<button type="button" class="btn-primary" data-sms-ok>Enregistrer et ouvrir Messages</button>'
    + '<button type="button" class="btn-ghost" data-sms-sans>Choisir le contact moi-même</button></div>';
  const champ = el.querySelector('.sms-tel');
  el.querySelector('[data-sms-ok]').onclick = () => {
    const t = champ.value.trim();
    if(t.replace(/[^\d]/g, '').length < 6){ champ.focus(); return; }
    smsEcrireTel(t); el.remove(); smsLancer(t, texte);
  };
  el.querySelector('[data-sms-sans]').onclick = () => { smsEcrireTel('-'); el.remove(); smsLancer('', texte); };
}

// Mention affichée chez celui / celle qui valide.
function smsNoteValidation(nom){
  return '<div class="sms-recu">📱 ' + escapeHtml(nom || '') + ' t’a envoyé la photo <b>par SMS</b> : regarde tes messages, puis valide.</div>';
}
