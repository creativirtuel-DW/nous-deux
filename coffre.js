// =========================================================
//  COFFRE — chiffrement de bout en bout
//  Les photos ne partent jamais en clair dans la base : elles sont
//  chiffrées dans le téléphone avec une phrase secrète que vous êtes
//  seuls à connaître, et déchiffrées dans l'autre téléphone.
//
//  La phrase n'est JAMAIS écrite dans Firebase — seulement dans le
//  stockage local de chaque appareil. Un accès complet à la base ne
//  donne donc qu'un bloc illisible, même pour l'administrateur du
//  projet. Corollaire à assumer : phrase perdue = photos perdues.
//
//  AES-GCM 256 bits, clé dérivée par PBKDF2 (210 000 tours, SHA-256),
//  le tout par l'API WebCrypto du navigateur — aucune bibliothèque.
// =========================================================
const COFFRE_TOURS = 210000;
const COFFRE_PREFIXE = 'nd1:';   // marque nos données chiffrées, et leur version

let coffreCle = null;       // CryptoKey en mémoire, redérivée à chaque ouverture
let coffrePhrase = '';      // la phrase en clair, gardée pour pouvoir la re-dériver

function coffreStorageKey(){ return 'nousdeux_coffre_' + roomCode; }

function coffreDisponible(){
  return !!(window.crypto && window.crypto.subtle);
}

// La phrase est-elle déjà connue de CET appareil ?
function coffrePret(){ return !!coffreCle; }

function coffreLirePhraseLocale(){
  try{ return localStorage.getItem(coffreStorageKey()) || ''; }catch(e){ return ''; }
}

function coffreOublier(){
  coffreCle = null; coffrePhrase = '';
  try{ localStorage.removeItem(coffreStorageKey()); }catch(e){}
}

// Le sel est dérivé du code du couple : deux couples avec la même phrase
// n'obtiennent pas la même clé, sans qu'on ait à stocker un sel en base.
function coffreSel(){
  return new TextEncoder().encode('nous-deux/' + (roomCode || ''));
}

function coffreDeriver(phrase){
  const enc = new TextEncoder();
  return crypto.subtle.importKey('raw', enc.encode(phrase), 'PBKDF2', false, ['deriveKey'])
    .then(base => crypto.subtle.deriveKey(
      { name:'PBKDF2', salt: coffreSel(), iterations: COFFRE_TOURS, hash:'SHA-256' },
      base,
      { name:'AES-GCM', length:256 },
      false,
      ['encrypt', 'decrypt']
    ));
}

// Ouvre le coffre avec une phrase. `memoriser` l'enregistre sur cet appareil.
function coffreOuvrir(phrase, memoriser){
  if(!coffreDisponible()) return Promise.reject(new Error('WebCrypto indisponible'));
  const p = (phrase || '').trim();
  if(p.length < 4) return Promise.reject(new Error('Phrase trop courte'));
  return coffreDeriver(p).then(cle => {
    coffreCle = cle;
    coffrePhrase = p;
    if(memoriser !== false){
      try{ localStorage.setItem(coffreStorageKey(), p); }catch(e){}
    }
    return true;
  });
}

// À l'ouverture d'une room : si la phrase est déjà sur cet appareil, on rouvre
// le coffre sans rien demander.
function coffreReprendre(){
  const p = coffreLirePhraseLocale();
  if(!p) return Promise.resolve(false);
  return coffreOuvrir(p, false).then(() => true, () => false);
}

function coffreOctetsVersB64(octets){
  let s = '';
  const b = new Uint8Array(octets);
  const PAS = 8192;   // par tranches : une photo dépasse la taille d'appel maxi
  for(let i = 0; i < b.length; i += PAS){
    s += String.fromCharCode.apply(null, b.subarray(i, i + PAS));
  }
  return btoa(s);
}

function coffreB64VersOctets(b64){
  const brut = atob(b64);
  const out = new Uint8Array(brut.length);
  for(let i = 0; i < brut.length; i++) out[i] = brut.charCodeAt(i);
  return out;
}

// Chiffre une chaîne (une photo en data URL, par exemple).
// Rend une promesse sur "nd1:<iv en base64>:<contenu en base64>".
function coffreChiffrer(texte){
  if(!coffreCle) return Promise.reject(new Error('Coffre fermé'));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  return crypto.subtle.encrypt({ name:'AES-GCM', iv }, coffreCle, new TextEncoder().encode(texte))
    .then(chiffre => COFFRE_PREFIXE + coffreOctetsVersB64(iv) + ':' + coffreOctetsVersB64(chiffre));
}

function coffreEstChiffre(valeur){
  return typeof valeur === 'string' && valeur.indexOf(COFFRE_PREFIXE) === 0;
}

// Déchiffre ce que coffreChiffrer a produit. Une valeur en clair (photo
// envoyée avant la mise en service du coffre) est rendue telle quelle.
function coffreDechiffrer(valeur){
  if(!coffreEstChiffre(valeur)) return Promise.resolve(valeur);
  if(!coffreCle) return Promise.reject(new Error('Coffre fermé'));
  const parts = valeur.slice(COFFRE_PREFIXE.length).split(':');
  if(parts.length !== 2) return Promise.reject(new Error('Donnée illisible'));
  const iv = coffreB64VersOctets(parts[0]);
  const corps = coffreB64VersOctets(parts[1]);
  return crypto.subtle.decrypt({ name:'AES-GCM', iv }, coffreCle, corps)
    .then(clair => new TextDecoder().decode(clair));
}
