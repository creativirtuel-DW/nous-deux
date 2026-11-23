// Nous Deux — chiffre le contenu sensible avant publication (23/11/2026).
//
//   Sources EN CLAIR (jamais publiées, exclues par .gitignore) :
//     plaisirs-data.js          (généré par outils/import-plaisirs.py depuis Plaisirs-Intimes.xlsx)
//     hot-sources/*.webp        (images de la cinématique)
//   Sorties CHIFFRÉES (publiées) :
//     hot/contenu.nd            texte « nd1:<iv b64>:<chiffré b64> » d'un JSON { verif, plaisirs }
//     hot/<nom>.nd              binaire « ND1 » + iv (12 octets) + chiffré
//
//   Clé = PBKDF2(code, « nous-deux/contenu », 210 000 tours, SHA-256) → AES-GCM 256,
//   exactement comme secret.js dans l'appli. Le code est demandé au clavier, masqué,
//   deux fois ; il n'est écrit nulle part.
//   (Pour un essai automatisé seulement : variable d'environnement NOUSDEUX_CODE.)
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { webcrypto as crypto } from 'node:crypto';


const RACINE = join(dirname(fileURLToPath(import.meta.url)), '..');
const SEL = 'nous-deux/contenu', TOURS = 210000;

// Saisie masquée caractère par caractère (une étoile par touche), fiable dans la console Windows.
function demanderMasque(question){
  return new Promise(ok => {
    process.stdout.write(question);
    const stdin = process.stdin;
    let saisie = '';
    stdin.setRawMode(true); stdin.resume(); stdin.setEncoding('utf8');
    const touche = ch => {
      for(const c of ch){
        if(c === '\r' || c === '\n'){
          stdin.setRawMode(false); stdin.pause(); stdin.removeListener('data', touche);
          process.stdout.write('\n'); ok(saisie.trim()); return;
        }
        if(c === '\u0003'){ process.stdout.write('\nAnnulé.\n'); process.exit(1); }
        if(c === '\u0008' || c === '\u007f'){ if(saisie){ saisie = saisie.slice(0, -1); process.stdout.write('\b \b'); } continue; }
        if(c >= ' '){ saisie += c; process.stdout.write('*'); }
      }
    };
    stdin.on('data', touche);
  });
}

async function cle(code){
  const enc = new TextEncoder();
  const base = await crypto.subtle.importKey('raw', enc.encode(code), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey({ name: 'PBKDF2', salt: enc.encode(SEL), iterations: TOURS, hash: 'SHA-256' },
    base, { name: 'AES-GCM', length: 256 }, false, ['encrypt']);
}

async function main(){
  let code = process.env.NOUSDEUX_CODE || '';
  if(!code){
    console.log('Nous Deux — chiffrement du contenu sensible\n');
    code = await demanderMasque('Code secret : ');
    const bis = await demanderMasque('Retape le code : ');
    if(!code || code !== bis){
      console.log('\n✗ Les deux saisies ne correspondent pas (ou code vide). RIEN n\'a été modifié : relance le fichier.');
      return;
    }
    if(code.length < 6) console.log('(Conseil : un code d\'au moins 6 caractères est plus sûr.)');
  }
  const k = await cle(code);

  // 1. Textes de Plaisirs Intimes
  const src = readFileSync(join(RACINE, 'plaisirs-data.js'), 'utf8');
  const json = src.slice(src.indexOf('/*JSON*/') + 8, src.indexOf('/*FIN*/'));
  const plaisirs = JSON.parse(json);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const chiffre = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, k,
    new TextEncoder().encode(JSON.stringify({ verif: 'nous-deux-ok', plaisirs })));
  writeFileSync(join(RACINE, 'hot', 'contenu.nd'),
    'nd1:' + Buffer.from(iv).toString('base64') + ':' + Buffer.from(chiffre).toString('base64'));
  console.log(`✓ Plaisirs Intimes : ${plaisirs.questions.length} questions, ${plaisirs.defis.length} défis`);

  // 2. Images
  const dossier = join(RACINE, 'hot-sources');
  const images = existsSync(dossier) ? readdirSync(dossier).filter(f => f.endsWith('.webp')) : [];
  for(const f of images){
    const iv2 = crypto.getRandomValues(new Uint8Array(12));
    const c = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: iv2 }, k, readFileSync(join(dossier, f)));
    writeFileSync(join(RACINE, 'hot', basename(f, '.webp') + '.nd'),
      Buffer.concat([Buffer.from('ND1'), Buffer.from(iv2), Buffer.from(c)]));
  }
  console.log(`✓ ${images.length} images chiffrées dans hot/`);
  console.log('\nTerminé. Le code n\'est enregistré nulle part : ne le perdez pas.');
}
main().catch(e => console.error('Erreur :', e.message));
