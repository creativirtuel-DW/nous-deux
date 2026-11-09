/**
 * Nous Deux — relais de notifications push (Cloudflare Worker)
 * =========================================================
 * Reçoit {sub, payload} de l'app, chiffre le message pour le destinataire
 * (RFC 8291, aes128gcm), signe la requête avec la clé VAPID (RFC 8292)
 * et la transmet au service de push d'Apple/Google.
 *
 * Il envoie aussi la QUESTION DU JOUR à 10 h et la relance de 20 h (heure de
 * Paris) grâce à un déclencheur Cron. Pour ça il retient, dans une mémoire
 * Cloudflare KV, les abonnements des deux joueurs et qui a répondu — mais il
 * ne lit jamais Firebase. La clé privée VAPID ne quitte jamais Cloudflare.
 *
 * Liaison KV à créer dans Cloudflare : nom de variable « QDJ ».
 * Déclencheur Cron : « 0 8,9,18,19 * * * ».
 *
 * Variables à définir dans Cloudflare :
 *   VAPID_PRIVATE_KEY  (secret)  la clé privée, format base64url
 *   VAPID_PUBLIC_KEY   (secret)  la clé publique, format base64url
 *   VAPID_SUBJECT      (var)     mailto:ton@email
 *   ALLOWED_ORIGIN     (var)     https://creativirtuel-dw.github.io
 */

const MAX_PAYLOAD = 3000;   // octets ; les services de push refusent ~4 Ko
const TTL         = 86400;  // le push reste en file 24 h si le tél est éteint

// ---------- utilitaires d'encodage ----------
const enc = new TextEncoder();

function b64urlToBytes(s){
  s = s.replace(/-/g, '+').replace(/_/g, '/');
  while(s.length % 4) s += '=';
  const raw = atob(s);
  const out = new Uint8Array(raw.length);
  for(let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

function bytesToB64url(bytes){
  let s = '';
  const b = new Uint8Array(bytes);
  for(let i = 0; i < b.length; i++) s += String.fromCharCode(b[i]);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function concat(...arrays){
  const total = arrays.reduce((n, a) => n + a.length, 0);
  const out = new Uint8Array(total);
  let off = 0;
  for(const a of arrays){ out.set(a, off); off += a.length; }
  return out;
}

// ---------- VAPID : le JWT signé qui prouve notre identité ----------
async function vapidHeader(endpoint, env){
  const aud = new URL(endpoint).origin;
  const header  = { typ: 'JWT', alg: 'ES256' };
  const claims  = {
    aud: aud,
    exp: Math.floor(Date.now() / 1000) + 12 * 3600,
    sub: env.VAPID_SUBJECT || 'mailto:contact@example.com'
  };
  const signingInput = bytesToB64url(enc.encode(JSON.stringify(header)))
    + '.' + bytesToB64url(enc.encode(JSON.stringify(claims)));

  const d = b64urlToBytes(env.VAPID_PRIVATE_KEY);
  const pub = b64urlToBytes(env.VAPID_PUBLIC_KEY);   // 65 octets : 0x04 || X || Y
  const jwk = {
    kty: 'EC', crv: 'P-256', ext: true,
    x: bytesToB64url(pub.slice(1, 33)),
    y: bytesToB64url(pub.slice(33, 65)),
    d: bytesToB64url(d)
  };
  const key = await crypto.subtle.importKey('jwk', jwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, enc.encode(signingInput));

  return 'vapid t=' + signingInput + '.' + bytesToB64url(sig) + ', k=' + env.VAPID_PUBLIC_KEY;
}

// ---------- chiffrement du message pour le destinataire ----------
async function hkdf(salt, ikm, info, length){
  const base = await crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'HKDF', hash: 'SHA-256', salt: salt, info: info }, base, length * 8);
  return new Uint8Array(bits);
}

async function encryptPayload(plaintext, uaPublicB64, authSecretB64){
  const uaPublic = b64urlToBytes(uaPublicB64);      // 65 octets
  const authSecret = b64urlToBytes(authSecretB64);  // 16 octets
  const salt = crypto.getRandomValues(new Uint8Array(16));

  // Paire éphémère : un secret partagé neuf pour chaque notification.
  const eph = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
  const asPublic = new Uint8Array(await crypto.subtle.exportKey('raw', eph.publicKey));
  const uaKey = await crypto.subtle.importKey('raw', uaPublic, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const shared = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: uaKey }, eph.privateKey, 256));

  // RFC 8291 §3.4
  const ikm = await hkdf(authSecret, shared,
    concat(enc.encode('WebPush: info\0'), uaPublic, asPublic), 32);
  const cek   = await hkdf(salt, ikm, enc.encode('Content-Encoding: aes128gcm\0'), 16);
  const nonce = await hkdf(salt, ikm, enc.encode('Content-Encoding: nonce\0'), 12);

  // 0x02 = marqueur de dernier enregistrement
  const padded = concat(plaintext, new Uint8Array([2]));
  const aesKey = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['encrypt']);
  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce, tagLength: 128 }, aesKey, padded));

  // En-tête RFC 8188 : salt | recordSize | idLen | clé publique | chiffré
  const rs = new Uint8Array([0, 0, 16, 0]);   // 4096
  return concat(salt, rs, new Uint8Array([asPublic.length]), asPublic, ciphertext);
}

// ---------- envoi d'un push (chiffrement + signature + POST) ----------
const ENDPOINT_OK = /^https:\/\/[a-z0-9.-]+\.(apple|google|googleapis|mozilla|microsoft|windows)\.com\//i;
const ENDPOINT_OK_2 = /^https:\/\/[a-z0-9.-]+\.push\.services\.mozilla\.com\//i;

function abonnementValide(sub){
  return !!(sub && sub.endpoint && sub.keys && sub.keys.p256dh && sub.keys.auth
    && (ENDPOINT_OK.test(sub.endpoint) || ENDPOINT_OK_2.test(sub.endpoint)));
}

// Renvoie le statut HTTP du service de push (201 = livré, 404/410 = abonnement mort).
async function envoyerPush(sub, payloadObj, env){
  const payload = enc.encode(JSON.stringify(payloadObj || {}));
  if(payload.length > MAX_PAYLOAD) throw new Error('message trop long');
  const encrypted = await encryptPayload(payload, sub.keys.p256dh, sub.keys.auth);
  const auth = await vapidHeader(sub.endpoint, env);
  const res = await fetch(sub.endpoint, {
    method: 'POST',
    headers: {
      'Authorization': auth,
      'Content-Encoding': 'aes128gcm',
      'Content-Type': 'application/octet-stream',
      'TTL': String(TTL),
      'Urgency': 'high'
    },
    body: encrypted
  });
  return res.status;
}

// =====================================================================
//  QUESTION DU JOUR
// =====================================================================
// Le Worker garde en mémoire (Cloudflare KV, liaison « QDJ ») :
//   sub:<room>:<p1|p2>        → { sub, nom }    abonnement push de chaque joueur
//   rep:<room>:<jour>:<p1|p2> → '1'             « a répondu », effacé au bout de 3 jours
// Il ne lit jamais Firebase : c'est l'appli qui le tient au courant.
// La banque de questions est le fichier public qdj-data.js de l'appli,
// le même que celui que lit le téléphone : les deux tombent sur la même question.

const DATA_URL = 'https://creativirtuel-dw.github.io/nous-deux/qdj-data.js';
const HEURE_MATIN = 10;   // heure de Paris de la question
const HEURE_SOIR  = 20;   // heure de Paris de la relance

// Date + heure à Paris (gère tout seul l'heure d'été).
function paris(date){
  const p = {};
  new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23'
  }).formatToParts(date).forEach(x => { p[x.type] = x.value; });
  return { jour: p.year + '-' + p.month + '-' + p.day, heure: parseInt(p.hour, 10) };
}

// Le « jour » de la question court de 10 h à 10 h le lendemain.
function jourQDJ(date){
  return paris(new Date(date.getTime() - HEURE_MATIN * 3600 * 1000)).jour;
}

function numeroJour(jour, debut){
  const ms = s => Date.UTC(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10));
  return Math.round((ms(jour) - ms(debut)) / 86400000);
}

// Ordre de passage : les catégories alternent, chacune avance dans l'ordre du fichier.
// ⚠️ Même algorithme que qdjRotation() dans qdj.js (appli) — garder les deux identiques.
function rotation(data){
  const lots = {};
  data.ordre.forEach(c => { lots[c] = []; });
  data.questions.forEach(q => { if(lots[q.cat]) lots[q.cat].push(q); });
  const out = [];
  const max = Math.max(...data.ordre.map(c => lots[c].length));
  for(let i = 0; i < max; i++) data.ordre.forEach(c => { if(lots[c][i]) out.push(lots[c][i]); });
  return out;
}

function questionDuJour(data, jour){
  const rot = rotation(data);
  const n = numeroJour(jour, data.debut);
  return rot[((n % rot.length) + rot.length) % rot.length];
}

async function chargerBanque(){
  const r = await fetch(DATA_URL + '?t=' + Date.now(), { cf: { cacheTtl: 0 } });
  if(!r.ok) throw new Error('banque introuvable (' + r.status + ')');
  const texte = await r.text();
  return JSON.parse(texte.split('/*JSON*/')[1].split('/*FIN*/')[0]);
}

// Tous les joueurs inscrits, regroupés par room : { room: { p1:{sub,nom}, p2:{…} } }
async function listerInscrits(env){
  const rooms = {};
  let cursor;
  do{
    const page = await env.QDJ.list({ prefix: 'sub:', cursor });
    for(const k of page.keys){
      const [, room, joueur] = k.name.split(':');
      const val = await env.QDJ.get(k.name, 'json');
      if(!val) continue;
      (rooms[room] = rooms[room] || {})[joueur] = val;
    }
    cursor = page.list_complete ? null : page.cursor;
  }while(cursor);
  return rooms;
}

function messageMatin(q){
  return {
    title: '💬 Question du jour',
    body: q.cat === 'coquin' ? 'Une question coquine t\'attend… 😏 Réponds en secret.' : q.q,
    tag: 'qdj', url: './index.html'
  };
}

function messageSoir(nomPartenaire, partenaireARepondu){
  return {
    title: '⏳ Question du jour',
    body: partenaireARepondu
      ? nomPartenaire + ' a déjà répondu : il ne manque que toi pour garder la série !'
      : 'Vous n\'avez pas encore répondu. Il vous reste jusqu\'à demain 10 h pour garder la série.',
    tag: 'qdj', url: './index.html'
  };
}

async function envoyerOuPurger(env, room, joueur, inscrit, payload){
  try{
    const status = await envoyerPush(inscrit.sub, payload, env);
    if(status === 404 || status === 410) await env.QDJ.delete('sub:' + room + ':' + joueur);
    return status;
  }catch(e){ return String(e && e.message || e); }
}

// moment = 'matin' | 'soir' ; cible = { room, joueur } pour un test, sinon tout le monde.
async function tournee(env, moment, cible){
  const maintenant = new Date();
  const jour = jourQDJ(maintenant);
  const data = await chargerBanque();
  const q = questionDuJour(data, jour);
  const rooms = await listerInscrits(env);
  const bilan = [];

  for(const room of Object.keys(rooms)){
    if(cible && cible.room !== room) continue;
    for(const joueur of ['p1', 'p2']){
      if(cible && cible.joueur && cible.joueur !== joueur) continue;
      const inscrit = rooms[room][joueur];
      if(!inscrit) continue;

      if(moment === 'matin'){
        bilan.push([joueur, await envoyerOuPurger(env, room, joueur, inscrit, messageMatin(q))]);
      }else{
        const autre = joueur === 'p1' ? 'p2' : 'p1';
        const moi  = await env.QDJ.get('rep:' + room + ':' + jour + ':' + joueur);
        if(moi && !cible) continue;   // a déjà répondu : on ne dérange pas
        const lui  = await env.QDJ.get('rep:' + room + ':' + jour + ':' + autre);
        const nomAutre = (rooms[room][autre] && rooms[room][autre].nom) || 'Ton/ta partenaire';
        bilan.push([joueur, await envoyerOuPurger(env, room, joueur, inscrit, messageSoir(nomAutre, !!lui))]);
      }
    }
  }
  return { jour, question: q && q.id, bilan };
}

// ---------- point d'entrée ----------
function cors(env){
  return {
    'Access-Control-Allow-Origin': env.ALLOWED_ORIGIN || '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  };
}

function json(obj, status, headers){
  return new Response(JSON.stringify(obj), { status: status || 200, headers: { ...headers, 'Content-Type': 'application/json' } });
}

const ROOM_OK = /^[A-Za-z0-9_-]{1,64}$/;

export default {
  async fetch(request, env){
    const headers = cors(env);

    if(request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
    if(request.method !== 'POST')    return new Response('Nous Deux — relais de push. POST uniquement.', { status: 405, headers });

    // On n'accepte que l'origine de l'app (une page tierce ne peut pas appeler ce Worker).
    const origin = request.headers.get('Origin');
    if(env.ALLOWED_ORIGIN && origin && origin !== env.ALLOWED_ORIGIN){
      return json({ error: 'origine refusée' }, 403, headers);
    }

    let body;
    try{ body = await request.json(); }
    catch(e){ return json({ error: 'JSON invalide' }, 400, headers); }

    // ----- Question du jour : inscription, « j'ai répondu », test -----
    if(body.action){
      if(!env.QDJ) return json({ error: 'mémoire KV « QDJ » non reliée au Worker' }, 501, headers);
      const room = String(body.room || '');
      const joueur = body.joueur;
      if(!ROOM_OK.test(room) || (joueur !== 'p1' && joueur !== 'p2')){
        return json({ error: 'room ou joueur invalide' }, 400, headers);
      }

      if(body.action === 'inscrire'){
        if(!abonnementValide(body.abonnement)) return json({ error: 'abonnement incomplet' }, 400, headers);
        await env.QDJ.put('sub:' + room + ':' + joueur,
          JSON.stringify({ sub: body.abonnement, nom: String(body.nom || '').slice(0, 40) }));
        return json({ ok: true }, 200, headers);
      }

      if(body.action === 'repondu'){
        const jour = String(body.jour || '');
        if(!/^\d{4}-\d{2}-\d{2}$/.test(jour)) return json({ error: 'jour invalide' }, 400, headers);
        await env.QDJ.put('rep:' + room + ':' + jour + ':' + joueur, '1', { expirationTtl: 3 * 86400 });
        return json({ ok: true }, 200, headers);
      }

      if(body.action === 'test'){
        const moment = body.moment === 'soir' ? 'soir' : 'matin';
        try{ return json(await tournee(env, moment, { room, joueur }), 200, headers); }
        catch(e){ return json({ error: String(e && e.message || e) }, 500, headers); }
      }

      return json({ error: 'action inconnue' }, 400, headers);
    }

    // ----- Relais classique : {sub, payload} → notification au/à la partenaire -----
    const sub = body.sub;
    if(!sub || !sub.endpoint || !sub.keys || !sub.keys.p256dh || !sub.keys.auth){
      return json({ error: 'abonnement incomplet' }, 400, headers);
    }
    if(!abonnementValide(sub)) return json({ error: 'endpoint non reconnu' }, 400, headers);

    try{
      const status = await envoyerPush(sub, body.payload, env);
      // 404 / 410 : l'abonnement est mort, l'app le supprimera de la base.
      return json({ status, gone: status === 404 || status === 410 }, 200, headers);
    }catch(err){
      const msg = String(err && err.message || err);
      return json({ error: msg }, msg === 'message trop long' ? 413 : 500, headers);
    }
  },

  // Déclencheur Cron Cloudflare : « 0 8,9,18,19 * * * » (heures UTC).
  // On ne sait pas d'avance si Paris est en heure d'été ou d'hiver :
  // le Worker est réveillé aux deux heures possibles et n'agit qu'à la bonne.
  async scheduled(event, env, ctx){
    if(!env.QDJ) return;
    const h = paris(new Date(event.scheduledTime || Date.now())).heure;
    if(h === HEURE_MATIN) ctx.waitUntil(tournee(env, 'matin'));
    else if(h === HEURE_SOIR) ctx.waitUntil(tournee(env, 'soir'));
  }
};
