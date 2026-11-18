/**
 * Nous Deux — « Ma liste des envies »
 * ===================================
 * Case de l'accueil, à côté de « Je pense à toi ». Chacun remplit SA liste
 * d'envies (4 thèmes), protégée par un mot de passe créé au premier usage.
 *
 * Secret :
 *  - la liste est chiffrée dans le téléphone (AES-GCM, clé tirée du mot de
 *    passe par PBKDF2) et ne quitte jamais l'appareil ;
 *  - seules des EMPREINTES anonymes (SHA-256) partent dans la base :
 *    rooms/$room/envies/<p1|p2> = [empreinte, …]
 *    Deux envies identiques donnent la même empreinte : c'est ainsi qu'on
 *    repère une envie commune sans jamais montrer la liste de l'autre.
 *
 * Envie commune : alerte à l'accueil (une fois par envie), puis l'envie est
 * illuminée dans la liste une fois déverrouillée.
 * Mot de passe oublié = liste effacée (rien n'est récupérable, par principe).
 */

const ENV_TOURS = 150000;

const ENV_THEMES = [
  { id:'sorties', ic:'🥂', nom:'Sorties à 2'},
  { id:'voyage', ic:'✈️', nom:'Voyage'},
  { id:'couple', ic:'🏡', nom:'Vie de couple'},
  { id:'coquin', ic:'🔥', nom:'Fantasme coquin'}
];

let envListe = null;      // liste déchiffrée (en mémoire seulement tant que la page est ouverte)
let envCle = null;        // CryptoKey du mot de passe, oubliée à la fermeture
let envSel = null;        // sel du coffre local
let envEmpreintes = {};   // empreinte -> true, pour MES envies (calculée au déverrouillage)
let envSigCommunes = '';  // dernières envies communes connues (pour redessiner la liste ouverte)

// ---------- stockage local ----------
function envCleStock(){ return 'nousdeux_envies_' + roomCode + '_' + me.id; }
function envCleVus(){ return 'nousdeux_envies_vus_' + roomCode + '_' + me.id; }
function envLireStock(){ try{ return JSON.parse(localStorage.getItem(envCleStock()) || 'null'); }catch(e){ return null; } }
function envEcrireStock(o){ try{ localStorage.setItem(envCleStock(), JSON.stringify(o)); }catch(e){} }
function envLireVus(){ try{ return JSON.parse(localStorage.getItem(envCleVus()) || '[]'); }catch(e){ return []; } }
function envEcrireVus(a){ try{ localStorage.setItem(envCleVus(), JSON.stringify(a)); }catch(e){} }

// ---------- chiffrement ----------
const envB64 = b => btoa(String.fromCharCode(...new Uint8Array(b)));
const envDeB64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));

async function envDeriver(mdp, sel){
  const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(mdp), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey({ name:'PBKDF2', salt: sel, iterations: ENV_TOURS, hash:'SHA-256' },
    base, { name:'AES-GCM', length:256 }, false, ['encrypt','decrypt']);
}
async function envSauver(){
  if(!envCle || !envListe) return;
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const data = await crypto.subtle.encrypt({ name:'AES-GCM', iv }, envCle, new TextEncoder().encode(JSON.stringify(envListe)));
  envEcrireStock({ v:1, sel: envB64(envSel), iv: envB64(iv), data: envB64(data) });
  await envPublier();
}
async function envOuvrirCoffre(mdp){
  const o = envLireStock();
  if(!o) return false;
  try{
    const sel = envDeB64(o.sel);
    const cle = await envDeriver(mdp, sel);
    const clair = await crypto.subtle.decrypt({ name:'AES-GCM', iv: envDeB64(o.iv) }, cle, envDeB64(o.data));
    envListe = JSON.parse(new TextDecoder().decode(clair));
    envCle = cle; envSel = sel;
    return true;
  }catch(e){ return false; }
}

// ---------- empreintes (rapprochement des envies) ----------
const ENV_MOTS_VIDES = new Set('le la les l un une des de du d a au aux et en on se s nous notre nos avec pour faire juste rien qu ensemble'.split(' '));
function envNormaliser(t){
  const mots = String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ').trim().split(' ').filter(m => m && !ENV_MOTS_VIDES.has(m));
  return Array.from(new Set(mots)).sort().join(' ');
}
async function envEmpreinte(texte){
  const n = envNormaliser(texte);
  if(!n) return null;
  const h = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('nd-envie:' + roomCode + ':' + n));
  return Array.from(new Uint8Array(h)).slice(0, 12).map(b => b.toString(16).padStart(2, '0')).join('');
}
async function envPublier(){
  envEmpreintes = {};
  for(const it of (envListe.items || [])){
    const e = await envEmpreinte(it.txt);
    if(e){ it.e = e; envEmpreintes[e] = true; }
  }
  const liste = Object.keys(envEmpreintes);
  if(roomRef) await roomRef.child('envies/' + me.id).set(liste.length ? liste : null);
}

function envAutreId(){ return me && me.id === 'p1' ? 'p2' : 'p1'; }
function envNomAutre(){ return (state && state.players && state.players[envAutreId()]) || 'ton/ta partenaire'; }
function envCommunes(){
  const e = (state && state.envies) || {};
  const a = Array.isArray(e[me.id]) ? e[me.id] : Object.values(e[me.id] || {});
  const b = new Set(Array.isArray(e[envAutreId()]) ? e[envAutreId()] : Object.values(e[envAutreId()] || {}));
  return a.filter(x => b.has(x));
}

// ---------- case de l'accueil ----------
function renderEnvies(){
  const t = document.getElementById('env-tuile');
  if(!t || !state || !me || !me.id) return;
  const communes = envCommunes();
  const vus = envLireVus();
  const nouvelles = communes.filter(c => vus.indexOf(c) < 0);
  const sous = !envLireStock() ? 'Secrète, rien qu’à toi'
    : communes.length ? communes.length + (communes.length > 1 ? ' envies communes ✨' : ' envie commune ✨')
    : 'Secrète · 🔒';
  const html = '<span class="pt-tuile-ic">🌠</span><span class="pt-tuile-txt"><strong>Ma liste des envies</strong><small>' + sous + '</small></span>';
  if(t.innerHTML !== html) t.innerHTML = html;
  t.classList.toggle('env-brille', communes.length > 0);

  // Liste ouverte et l'autre vient d'ajouter/retirer une envie commune : on redessine.
  const sig = communes.slice().sort().join(',');
  if(envListe && document.getElementById('env-plein') && sig !== envSigCommunes) envDessiner();
  envSigCommunes = sig;

  // Alerte : une (ou plusieurs) nouvelle(s) envie(s) commune(s).
  if(nouvelles.length && accueilVisible() && !document.getElementById('env-alerte') && !document.getElementById('env-plein')){
    envEcrireVus(vus.concat(nouvelles));
    envAlerte(nouvelles.length);
  }
}

function envAlerte(n){
  const el = ptEcran('env-alerte');
  el.className = 'env-voile';
  el.innerHTML = '<div class="env-pop env-pop-fete">'
    + '<div class="env-pop-ic">✨</div>'
    + '<h2>' + (n > 1 ? n + ' envies communes !' : 'Une envie commune !') + '</h2>'
    + '<p>' + escapeHtml(envNomAutre()) + ' et toi avez noté la même envie. Ouvre ta liste pour la découvrir… à vous de la réaliser ensemble.</p>'
    + '<button type="button" class="btn-primary" data-env-voir>Voir ma liste</button>'
    + '<button type="button" class="btn-ghost" data-env-plus-tard>Plus tard</button>'
    + '</div>';
  el.querySelector('[data-env-voir]').onclick = () => { el.remove(); envToucherTuile(); };
  el.querySelector('[data-env-plus-tard]').onclick = () => el.remove();
}

function envToucherTuile(){
  if(!(window.crypto && crypto.subtle)){ alert('Ton navigateur ne permet pas de protéger la liste.'); return; }
  // Le pop-up d'explication s'affiche à chaque ouverture, tant que « Ne plus afficher » n'est pas coché.
  if(!envLireStock() || !envAideMasquee()) envExplication();
  else envDemanderMdp();
}

function envCleAide(){ return 'nousdeux_envies_aide_masquee_' + roomCode + '_' + me.id; }
function envAideMasquee(){ try{ return localStorage.getItem(envCleAide()) === '1'; }catch(e){ return false; } }

// ---------- 1. pop-up d'explication ----------
function envExplication(){
  const el = ptEcran('env-alerte');
  el.className = 'env-voile';
  el.innerHTML = '<div class="env-pop">'
    + '<div class="env-pop-ic">🌠</div>'
    + '<h2>Ma liste des envies</h2>'
    + '<p>Voici une liste très personnelle. Tu vas pouvoir la remplir, et la modifier quand tu le souhaites.</p>'
    + '<p><b>Le but ?</b> Si l’une de tes envies est similaire à une envie de la liste de ' + escapeHtml(envNomAutre())
    +   ', tu recevras une alerte et l’envie commune sera illuminée dans ta liste. À vous ensuite de la réaliser ensemble…</p>'
    + '<p>Si aucune de vos envies n’est en commun, l’application permettra sans doute de vous rapprocher et d’avoir des envies en commun rapidement.</p>'
    + '<p>Ta liste reste secrète et personnelle tant que tu le souhaites : tout est stocké dans ton propre téléphone.</p>'
    + '<label class="qdj-aide-case env-aide-case"><input type="checkbox" id="env-aide-masquer"' + (envAideMasquee() ? ' checked' : '') + '> Ne plus afficher</label>'
    + '<button type="button" class="btn-primary" data-env-ok>C’est parti</button>'
    + '<button type="button" class="btn-ghost" data-env-annule>Plus tard</button>'
    + '</div>';
  el.querySelector('[data-env-ok]').onclick = () => {
    try{ localStorage.setItem(envCleAide(), el.querySelector('#env-aide-masquer').checked ? '1' : '0'); }catch(e){}
    if(envLireStock()) envDemanderMdp(); else envCreerMdp();
  };
  el.querySelector('[data-env-annule]').onclick = () => el.remove();
}

// ---------- 2. création du mot de passe ----------
function envCreerMdp(){
  const el = ptEcran('env-alerte');
  el.className = 'env-voile';
  el.innerHTML = '<div class="env-pop">'
    + '<div class="env-pop-ic">🔐</div>'
    + '<h2>Ton mot de passe</h2>'
    + '<p>Il protège ta liste. Choisis-le bien : <b>s’il est oublié, la liste est effacée</b> (personne ne peut la récupérer, pas même nous).</p>'
    + '<input type="password" class="env-mdp" id="env-mdp1" placeholder="Mot de passe (4 caractères min.)" autocomplete="new-password">'
    + '<input type="password" class="env-mdp" id="env-mdp2" placeholder="Confirme-le" autocomplete="new-password">'
    + '<div class="env-err" id="env-err"></div>'
    + '<button type="button" class="btn-primary" data-env-creer>Créer ma liste</button>'
    + '<button type="button" class="btn-ghost" data-env-annule>Annuler</button>'
    + '</div>';
  const m1 = el.querySelector('#env-mdp1'), m2 = el.querySelector('#env-mdp2'), err = el.querySelector('#env-err');
  m1.focus();
  el.querySelector('[data-env-annule]').onclick = () => el.remove();
  el.querySelector('[data-env-creer]').onclick = async () => {
    if(m1.value.length < 4){ err.textContent = 'Au moins 4 caractères.'; return; }
    if(m1.value !== m2.value){ err.textContent = 'Les deux mots de passe ne sont pas identiques.'; return; }
    err.textContent = '…';
    envSel = crypto.getRandomValues(new Uint8Array(16));
    envCle = await envDeriver(m1.value, envSel);
    envListe = { items: [] };
    await envSauver();
    el.remove();
    envOuvrirListe();
  };
}

// ---------- 3. déverrouillage ----------
function envDemanderMdp(){
  const el = ptEcran('env-alerte');
  el.className = 'env-voile';
  el.innerHTML = '<div class="env-pop">'
    + '<div class="env-pop-ic">🔒</div>'
    + '<h2>Ma liste des envies</h2>'
    + '<input type="password" class="env-mdp" id="env-mdp" placeholder="Ton mot de passe" autocomplete="current-password">'
    + '<div class="env-err" id="env-err"></div>'
    + '<button type="button" class="btn-primary" data-env-ouvrir>Ouvrir</button>'
    + '<button type="button" class="btn-ghost" data-env-annule>Annuler</button>'
    + '<button type="button" class="env-oubli" data-env-oubli>Mot de passe oublié ?</button>'
    + '</div>';
  const m = el.querySelector('#env-mdp'), err = el.querySelector('#env-err');
  m.focus();
  const ouvrir = async () => {
    err.textContent = '…';
    if(await envOuvrirCoffre(m.value)){ el.remove(); await envPublier(); envOuvrirListe(); }
    else { err.textContent = 'Mot de passe incorrect.'; m.select(); }
  };
  m.addEventListener('keydown', e => { if(e.key === 'Enter') ouvrir(); });
  el.querySelector('[data-env-ouvrir]').onclick = ouvrir;
  el.querySelector('[data-env-annule]').onclick = () => el.remove();
  el.querySelector('[data-env-oubli]').onclick = () => {
    if(!confirm('Effacer ta liste des envies et recréer un mot de passe ? Tes envies seront perdues.')) return;
    try{ localStorage.removeItem(envCleStock()); localStorage.removeItem(envCleVus()); }catch(e){}
    if(roomRef) roomRef.child('envies/' + me.id).remove();
    envExplication();
  };
}

// ---------- 4. la liste ----------
function envOuvrirListe(){
  const el = ptEcran('env-plein');
  el.innerHTML = '<button type="button" class="qdj-fermer" aria-label="Fermer" data-env-fermer>✕</button>'
    + '<div class="env-corps" id="env-corps"></div>';
  el.querySelector('[data-env-fermer]').onclick = envFermer;
  envDessiner();
}

function envFermer(){
  // On referme le coffre : il faudra le mot de passe la prochaine fois.
  envListe = null; envCle = null; envSel = null; envEmpreintes = {};
  const el = document.getElementById('env-plein');
  if(el) el.remove();
  renderEnvies();
}

function envDessiner(){
  const corps = document.getElementById('env-corps');
  if(!corps || !envListe) return;
  const communes = new Set(envCommunes());
  const items = envListe.items || [];
  const nbCom = items.filter(it => it.e && communes.has(it.e)).length;
  let h = '<div class="env-entete"><div class="pt-ic">🌠</div><h2 class="pt-titre">Ma liste des envies</h2>'
    + '<p class="pt-sous">' + (nbCom ? '✨ <b>' + nbCom + (nbCom > 1 ? ' envies communes' : ' envie commune') + '</b> avec ' + escapeHtml(envNomAutre())
      : 'Écris tes envies, avec tes mots. Personne ne les voit.') + '</p></div>';

  ENV_THEMES.forEach(th => {
    const miens = items.filter(it => it.cat === th.id);
    h += '<section class="env-theme env-' + th.id + '"><h3>' + th.ic + ' ' + th.nom + '</h3>';
    // mes envies d'abord (communes illuminées)
    miens.forEach(it => {
      const com = it.e && communes.has(it.e);
      h += '<div class="env-item' + (com ? ' commune' : '') + '"><span>' + (com ? '✨ ' : '') + escapeHtml(it.txt) + '</span>'
        + (com ? '<em>Envie commune</em>' : '')
        + '<button type="button" class="env-suppr" data-suppr="' + it.id + '" aria-label="Retirer">✕</button></div>';
    });
    h += '<div class="env-ajout"><input type="text" maxlength="120" placeholder="Ma propre envie…" data-champ="' + th.id + '">'
      + '<button type="button" data-ajout="' + th.id + '">Ajouter</button></div></section>';
  });
  h += '<p class="pt-avert">🔒 Ta liste est chiffrée dans ce téléphone. ' + escapeHtml(envNomAutre())
    + ' ne voit que les envies que vous avez en commun.</p>';
  corps.innerHTML = h;

  corps.querySelectorAll('[data-suppr]').forEach(b => b.onclick = () => envRetirer(b.dataset.suppr));
  corps.querySelectorAll('[data-ajout]').forEach(b => b.onclick = () => {
    const c = corps.querySelector('[data-champ="' + b.dataset.ajout + '"]');
    envAjouter(b.dataset.ajout, c.value);
  });
  corps.querySelectorAll('[data-champ]').forEach(c => c.addEventListener('keydown', e => {
    if(e.key === 'Enter') envAjouter(c.dataset.champ, c.value);
  }));
}

async function envAjouter(cat, txt){
  txt = String(txt || '').trim();
  if(!txt || !envListe) return;
  const n = envNormaliser(txt);
  if(!n || envListe.items.some(it => envNormaliser(it.txt) === n)){ envDessiner(); return; }
  const avant = new Set(envCommunes());
  envListe.items.push({ id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), cat, txt });
  await envSauver();
  envDessiner();
  // Si elle est déjà dans la liste de l'autre : petite fête tout de suite.
  const e = envListe.items[envListe.items.length - 1].e;
  const b = (state.envies && state.envies[envAutreId()]) || [];
  if(e && !avant.has(e) && (Array.isArray(b) ? b : Object.values(b)).indexOf(e) >= 0){
    envEcrireVus(envLireVus().concat([e]));
    envAlerteImmediate();
  }
}

async function envRetirer(id){
  if(!envListe) return;
  envListe.items = envListe.items.filter(it => it.id !== id);
  await envSauver();
  envDessiner();
}

function envAlerteImmediate(){
  const el = ptEcran('env-alerte');
  el.className = 'env-voile';
  el.innerHTML = '<div class="env-pop env-pop-fete"><div class="env-pop-ic">✨</div><h2>Envie commune !</h2>'
    + '<p>' + escapeHtml(envNomAutre()) + ' en rêve aussi. Elle est maintenant illuminée dans ta liste.</p>'
    + '<button type="button" class="btn-primary" data-env-ok>Génial</button></div>';
  el.querySelector('[data-env-ok]').onclick = () => el.remove();
}

(function(){
  const t = document.getElementById('env-tuile');
  if(t) t.addEventListener('click', envToucherTuile);
})();
