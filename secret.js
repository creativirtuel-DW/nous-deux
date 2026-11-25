/**
 * Nous Deux — le code secret du couple (23/11/2026)
 * =================================================
 * UN seul code, choisi par le couple, saisi une fois par téléphone puis
 * mémorisé sur l'appareil (jamais dans Firebase, jamais dans le dépôt) :
 *   · il DÉCHIFFRE le contenu sensible publié chiffré sur le site :
 *       hot/contenu.nd  → textes de Plaisirs Intimes (PLAISIRS) + valeur de contrôle
 *       hot/<nom>.nd    → images de la cinématique (binaire « ND1 » + iv + chiffré)
 *     clé = PBKDF2(code, « nous-deux/contenu », 210 000 tours, SHA-256) → AES-GCM 256 ;
 *     le chiffrement se fait sur le PC avec outils/chiffrer-contenu.mjs ;
 *   · il OUVRE LE COFFRE (coffre.js) : toutes les photos échangées sont
 *     chiffrées avec ce même code (sel = code de la room), dev mod compris.
 */
const SECRET_LS = 'nousdeux_code_secret';
const SECRET_SEL = 'nous-deux/contenu';
const SECRET_TOURS = 210000;
const SECRET_VERSION = '3';            // à incrémenter si le contenu chiffré change (cache)

let secretCle = null;                  // CryptoKey du contenu
let secretContenu = null;              // { verif, plaisirs }
const secretImages = {};               // nom -> URL blob déchiffrée
let secretEnCours = null;              // demande de code déjà ouverte

function secretLireCode(){ try{ return localStorage.getItem(SECRET_LS) || ''; }catch(e){ return ''; } }
function secretEcrireCode(c){ try{ localStorage.setItem(SECRET_LS, c); }catch(e){} }

function secretDeriver(code){
  const enc = new TextEncoder();
  return crypto.subtle.importKey('raw', enc.encode(code), 'PBKDF2', false, ['deriveKey'])
    .then(base => crypto.subtle.deriveKey(
      { name: 'PBKDF2', salt: enc.encode(SECRET_SEL), iterations: SECRET_TOURS, hash: 'SHA-256' },
      base, { name: 'AES-GCM', length: 256 }, false, ['decrypt']));
}

// Essaie un code : déchiffre hot/contenu.nd. Rend true si le code est le bon.
async function secretEssayer(code){
  const cle = await secretDeriver(code);
  const texte = await (await fetch('hot/contenu.nd?v=' + SECRET_VERSION)).text();
  const parts = texte.trim().replace(/^nd1:/, '').split(':');
  try{
    const clair = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: coffreB64VersOctets(parts[0]) }, cle, coffreB64VersOctets(parts[1]));
    const json = JSON.parse(new TextDecoder().decode(clair));
    if(json.verif !== 'nous-deux-ok') return false;
    secretCle = cle;
    secretContenu = json;
    window.PLAISIRS = json.plaisirs;     // banque de Plaisirs Intimes (plaisirs.js)
    return true;
  }catch(e){ return false; }
}

// Ouvre aussi le coffre des photos avec le même code.
function secretOuvrirCoffre(code){
  if(typeof coffreOuvrir !== 'function') return Promise.resolve();
  if(typeof coffrePret === 'function' && coffrePret() && coffrePhrase === code) return Promise.resolve();
  return coffreOuvrir(code, true).catch(() => {});
}

// Le code est-il prêt sur cet appareil ? Depuis le 23/11/2026 (choix de l'utilisateur),
// PERSONNE n'a à le taper : il est déposé UNE fois dans la room (rooms/$room/codeSecret,
// depuis le dev mod) et chaque téléphone le récupère tout seul. La protection repose
// donc sur le code du couple. Seul le dev mod peut encore le saisir (dépôt initial).
// Rend une promesse résolue quand tout est prêt, rejetée sinon.
function secretAssurer(raison){
  if(secretContenu && (typeof coffrePret !== 'function' || coffrePret())) return Promise.resolve();
  const candidats = [secretLireCode(), (typeof state !== 'undefined' && state && state.codeSecret) || ''].filter(Boolean);
  const essayer = i => i >= candidats.length ? Promise.resolve(false)
    : secretEssayer(candidats[i]).then(ok => ok
        ? (secretEcrireCode(candidats[i]), secretOuvrirCoffre(candidats[i]).then(() => true))
        : essayer(i + 1));
  return essayer(0).then(ok => {
    if(ok) return undefined;
    if(typeof isAdminUnlocked === 'function' && isAdminUnlocked()) return secretDemander(raison);
    alert('Le contenu protégé n’est pas encore activé sur votre espace : il faut d’abord déposer le code secret depuis le dev mod (onglet Cartes › Code secret).');
    return Promise.reject(new Error('code absent'));
  });
}

// Fenêtre de saisie du code.
function secretDemander(raison){
  if(secretEnCours) return secretEnCours;
  secretEnCours = new Promise((ok, ko) => {
    const el = document.createElement('div');
    el.id = 'secret-pop';
    el.className = 'env-voile secret-voile';
    el.innerHTML = '<div class="env-pop secret-pop">'
      + '<div class="env-pop-ic">🔐</div><h2>Code secret (dev mod)</h2>'
      + '<p>Entre une seule fois le code de chiffrement choisi au PC : il sera déposé dans votre espace et vos deux téléphones l’utiliseront ensuite tout seuls, sans jamais le redemander.</p>'
      + '<input type="password" class="coffre-input secret-champ" autocomplete="off" placeholder="Code secret">'
      + '<p class="coffre-erreur secret-erreur"></p>'
      + '<button type="button" class="btn-primary" data-secret-ok>Valider</button>'
      + '<button type="button" class="btn-ghost" data-secret-annuler>Annuler</button></div>';
    document.body.appendChild(el);
    const champ = el.querySelector('.secret-champ');
    const erreur = el.querySelector('.secret-erreur');
    const bouton = el.querySelector('[data-secret-ok]');
    setTimeout(() => champ.focus(), 50);
    const fermer = () => { el.remove(); secretEnCours = null; };
    const valider = async () => {
      const code = champ.value.trim();
      if(!code){ erreur.textContent = 'Entre le code.'; return; }
      bouton.disabled = true; bouton.textContent = 'Vérification…';
      const bon = await secretEssayer(code).catch(() => false);
      if(!bon){ bouton.disabled = false; bouton.textContent = 'Valider'; erreur.textContent = 'Code incorrect.'; champ.select(); return; }
      secretEcrireCode(code);
      // Dépôt dans la room : les autres téléphones le récupéreront sans rien taper.
      try{ if(typeof roomRef !== 'undefined' && roomRef) await roomRef.child('codeSecret').set(code); }catch(e){}
      await secretOuvrirCoffre(code);
      fermer();
      if(typeof render === 'function') render();
      ok();
    };
    bouton.onclick = valider;
    champ.addEventListener('keydown', e => { if(e.key === 'Enter') valider(); });
    el.querySelector('[data-secret-annuler]').onclick = () => { fermer(); ko(new Error('annulé')); };
  });
  return secretEnCours;
}

// Une image chiffrée de hot/ (cinématique) → URL utilisable dans <img>.
async function secretImage(nom){
  if(secretImages[nom]) return secretImages[nom];
  if(!secretCle) throw new Error('code manquant');
  const brut = new Uint8Array(await (await fetch('hot/' + nom + '.nd?v=' + SECRET_VERSION)).arrayBuffer());
  // « ND1 » (3 octets) + iv (12 octets) + contenu chiffré
  const clair = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: brut.subarray(3, 15) }, secretCle, brut.subarray(15));
  secretImages[nom] = URL.createObjectURL(new Blob([clair], { type: 'image/webp' }));
  return secretImages[nom];
}

// Oublier le code sur ce téléphone (réglages).
function secretOublier(){
  try{ localStorage.removeItem(SECRET_LS); }catch(e){}
  secretCle = null; secretContenu = null;
  if(typeof coffreOublier === 'function') coffreOublier();
}
