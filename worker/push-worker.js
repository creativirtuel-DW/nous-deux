/**
 * Nous Deux — relais de notifications push (Cloudflare Worker)
 * =========================================================
 * Reçoit {sub, payload} de l'app, chiffre le message pour le destinataire
 * (RFC 8291, aes128gcm), signe la requête avec la clé VAPID (RFC 8292)
 * et la transmet au service de push d'Apple/Google.
 *
 * Le Worker ne stocke rien et ne connaît pas la base Firebase : il ne fait
 * que chiffrer et poster. La clé privée VAPID ne quitte jamais Cloudflare.
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

// ---------- point d'entrée ----------
function cors(env){
  return {
    'Access-Control-Allow-Origin': env.ALLOWED_ORIGIN || '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  };
}

export default {
  async fetch(request, env){
    const headers = cors(env);

    if(request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
    if(request.method !== 'POST')    return new Response('Nous Deux — relais de push. POST uniquement.', { status: 405, headers });

    // On n'accepte que l'origine de l'app (une page tierce ne peut pas appeler ce Worker).
    const origin = request.headers.get('Origin');
    if(env.ALLOWED_ORIGIN && origin && origin !== env.ALLOWED_ORIGIN){
      return new Response(JSON.stringify({ error: 'origine refusée' }), { status: 403, headers });
    }

    let body;
    try{ body = await request.json(); }
    catch(e){ return new Response(JSON.stringify({ error: 'JSON invalide' }), { status: 400, headers }); }

    const sub = body.sub;
    if(!sub || !sub.endpoint || !sub.keys || !sub.keys.p256dh || !sub.keys.auth){
      return new Response(JSON.stringify({ error: 'abonnement incomplet' }), { status: 400, headers });
    }
    if(!/^https:\/\/[a-z0-9.-]+\.(apple|google|googleapis|mozilla|microsoft|windows)\.com\//i.test(sub.endpoint)
       && !/^https:\/\/[a-z0-9.-]+\.push\.services\.mozilla\.com\//i.test(sub.endpoint)){
      return new Response(JSON.stringify({ error: 'endpoint non reconnu' }), { status: 400, headers });
    }

    const payload = enc.encode(JSON.stringify(body.payload || {}));
    if(payload.length > MAX_PAYLOAD){
      return new Response(JSON.stringify({ error: 'message trop long' }), { status: 413, headers });
    }

    try{
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

      // 404 / 410 : l'abonnement est mort, l'app le supprimera de la base.
      return new Response(JSON.stringify({ status: res.status, gone: res.status === 404 || res.status === 410 }),
        { status: 200, headers: { ...headers, 'Content-Type': 'application/json' } });

    }catch(err){
      return new Response(JSON.stringify({ error: String(err && err.message || err) }),
        { status: 500, headers: { ...headers, 'Content-Type': 'application/json' } });
    }
  }
};
