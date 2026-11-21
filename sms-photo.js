/**
 * Nous Deux — « 📱 Envoyer directement par SMS » pour tout ce qui demande une photo
 * ==================================================================================
 * smsDemandePhoto(texte) repère une carte / un défi / un gage qui demande
 * d'ENVOYER ou de PRENDRE une photo (pas une question qui en parle).
 * smsOuvrir(texte) ouvre Messages sans destinataire (AUCUN numéro demandé, choix
 * de l'utilisateur du 19/11/2026), avec un petit texte : la personne choisit
 * la conversation, joint sa photo et envoie elle-même.
 *
 * Depuis le 21/11/2026, les photos de cartes/défis/gages peuvent partir par
 * SMS. Là où l'appli savait déjà envoyer la photo (cartes de la pioche,
 * Soirée guidée), la personne CHOISIT : depuis l'appli, ou par SMS. Deux boutons : « 📱 Ouvrir Messages »
 * (raccourci, ne valide rien) et « ✓ Le SMS est envoyé » (confirme que la
 * carte est réalisée → validation chez l'autre).
 *
 * Qui l'utilise :
 *   · app.js     — cartes de la pioche : la carte part « en attente de validation »
 *                  (pendingCards/<clé>/sms = ts) et le/la partenaire la valide ;
 *   · plaisirs.js — défis HOT : une entrée plaisirsReponses {sms:true} à valider ;
 *   · coffre-jour.js — gage du Coffre : bouton SMS en plus de « Gage réalisé ».
 */
const SMS_PHOTO_RE = /(\b(envoie|envoies|envoyer|prends|prendre|fais|faire)\b[^.!?]{0,60}\b(photo|selfie)s?\b)|^(une )?photo de toi|\bselfie\b/i;

function smsDemandePhoto(texte){ return SMS_PHOTO_RE.test(String(texte || '')); }

function smsNomAutre(){
  return (typeof state !== 'undefined' && state && state.players && typeof partnerId !== 'undefined' && state.players[partnerId]) || 'ton/ta partenaire';
}

// Bouton à insérer dans une carte
function smsBouton(attr){
  return '<button type="button" class="sms-btn" ' + attr + '>📱 Ouvrir Messages</button>';
}

// Ouvre Messages SANS destinataire : la personne choisit elle-même la
// conversation, joint sa photo et envoie (aucun numéro demandé ni stocké).
function smsOuvrir(texte){ smsLancer(texte); }

function smsLancer(texte){
  const corps = '📸 Nous Deux — ma photo pour : « ' + String(texte || '').replace(/\{autre\}/g, smsNomAutre()) + ' »';
  const ios = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  window.location.href = 'sms:' + (ios ? '&' : '?') + 'body=' + encodeURIComponent(corps);
}

// Ancienne version : un numéro avait pu être enregistré dans ce téléphone → on l'efface.
try{ Object.keys(localStorage).filter(k => k.indexOf('nousdeux_tel_partenaire_') === 0).forEach(k => localStorage.removeItem(k)); }catch(e){}

// Mention affichée chez celui / celle qui valide.
function smsNoteValidation(nom){
  return '<div class="sms-recu">📱 ' + escapeHtml(nom || '') + ' t’a envoyé la photo <b>par SMS</b> : regarde tes messages, puis valide.</div>';
}

// Consigne affichée sur une carte qui demande une photo.
function smsConsigne(avecAppli){
  if(avecAppli) return '<div class="sms-consigne choix">📸 Choisis comment envoyer ta photo à <b>' + escapeHtml(smsNomAutre()) + '</b> :</div>';
  return '<div class="sms-consigne">📱 Envoie ta photo à <b>' + escapeHtml(smsNomAutre()) + '</b> par SMS, puis touche « Le SMS est envoyé » pour confirmer que c’est fait.</div>';
}

// Choix « depuis l'appli » (bouton fourni par l'appelant) puis séparateur « ou par SMS ».
function smsChoixAppli(boutonAppli){
  return '<div class="photo-choix-appli">' + boutonAppli
    + '<small>Elle ne s’affichera que ' + Math.round((typeof PC_VUE_MS !== 'undefined' ? PC_VUE_MS : 5000) / 1000) + ' secondes chez ' + escapeHtml(smsNomAutre()) + ', puis disparaîtra.</small></div>'
    + '<div class="photo-choix-ou"><span>ou par SMS</span></div>';
}
