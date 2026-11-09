/**
 * Nous Deux — la question du jour
 * ===============================
 * Une question par jour, la même pour les deux, poussée à 10 h par le Worker
 * Cloudflare (relance à 20 h pour celui ou celle qui n'a pas répondu).
 * Le « jour » court de 10 h à 10 h le lendemain : 24 h pour répondre.
 *
 * Réponses en aveugle : chacun voit seulement que l'autre a répondu ; les deux
 * réponses se dévoilent ensemble. Quand les deux ont répondu : +5 points
 * chacun, et +20 de bonus chacun tous les 7 jours d'affilée.
 *
 * Base : rooms/$room/qdj/jours/<AAAA-MM-JJ> = { q, rep:{p1:{t,ts}, p2:{t,ts}}, credite }
 *        rooms/$room/qdj/serie = { n, dernier }   (dernier = dernier jour complet)
 * Coffre ouvert → les réponses partent chiffrées, comme les photos.
 */

const QDJ_HEURE = 10;
const QDJ_POINTS = 5;
const QDJ_BONUS = 20;
const QDJ_BONUS_TOUS = 7;

let qdjSignature = '';     // on ne reconstruit pas le bloc (et le champ de saisie) pour rien
let qdjEdition = false;    // « Modifier ma réponse » : rouvre le champ
let qdjCreditEnCours = false;

// ---------- calendrier (heure de Paris) ----------
function qdjParis(date){
  const p = {};
  new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23'
  }).formatToParts(date).forEach(x => { p[x.type] = x.value; });
  return { jour: p.year + '-' + p.month + '-' + p.day, heure: parseInt(p.hour, 10) };
}

function qdjJour(date){
  return qdjParis(new Date((date || new Date()).getTime() - QDJ_HEURE * 3600 * 1000)).jour;
}

function qdjMs(jour){ return Date.UTC(+jour.slice(0, 4), +jour.slice(5, 7) - 1, +jour.slice(8, 10)); }

function qdjVeille(jour){ return new Date(qdjMs(jour) - 86400000).toISOString().slice(0, 10); }

// ⚠️ Même algorithme que rotation() dans worker/push-worker.js — garder les deux identiques.
function qdjRotation(){
  const lots = {};
  QDJ.ordre.forEach(c => { lots[c] = []; });
  QDJ.questions.forEach(q => { if(lots[q.cat]) lots[q.cat].push(q); });
  const out = [];
  const max = Math.max(...QDJ.ordre.map(c => lots[c].length));
  for(let i = 0; i < max; i++) QDJ.ordre.forEach(c => { if(lots[c][i]) out.push(lots[c][i]); });
  return out;
}

function qdjQuestion(jour){
  const rot = qdjRotation();
  const n = Math.round((qdjMs(jour) - qdjMs(QDJ.debut)) / 86400000);
  return rot[((n % rot.length) + rot.length) % rot.length];
}

// ---------- état ----------
function qdjEtatJour(jour){
  return (state && state.qdj && state.qdj.jours && state.qdj.jours[jour]) || {};
}

// Série en cours : vivante si le dernier jour complet est aujourd'hui ou hier.
function qdjSerie(jour){
  const s = state && state.qdj && state.qdj.serie;
  if(!s || !s.dernier) return 0;
  return (s.dernier === jour || s.dernier === qdjVeille(jour)) ? (s.n || 0) : 0;
}

// ---------- échanges avec le Worker (tous silencieux en cas d'échec) ----------
function qdjWorker(corps){
  if(typeof PUSH_WORKER_URL === 'undefined' || !roomCode || !me.id) return Promise.resolve(null);
  return fetch(PUSH_WORKER_URL, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(Object.assign({ room: roomCode, joueur: me.id }, corps))
  }).then(r => r.json()).catch(() => null);
}

// Appelée par push.js à chaque abonnement (et à chaque ouverture de l'app).
function qdjInscrire(sub){
  // « abonnement » et pas « sub » : un ancien Worker prendrait sinon la requête
  // pour un envoi et pousserait une notification vide.
  qdjWorker({ action: 'inscrire', abonnement: sub, nom: me.name });
}

// ---------- actions ----------
function qdjEnvoyer(){
  const champ = $('#qdj-champ');
  const texte = champ ? champ.value.trim() : '';
  if(!texte) return;
  const jour = qdjJour();
  const q = qdjQuestion(jour);
  const bouton = $('#qdj-envoyer');
  if(bouton){ bouton.disabled = true; bouton.textContent = 'Envoi…'; }
  // Lu AVANT l'écriture : Firebase met l'état local à jour avant la fin de update().
  const avant = qdjEtatJour(jour).rep || {};
  const dejaRepondu = !!avant[me.id];
  const autre = !!avant[partnerId];

  const chiffrer = coffrePret() ? coffreChiffrer(texte) : Promise.resolve(texte);
  chiffrer.then(valeur => {
    const updates = {};
    updates['qdj/jours/' + jour + '/q'] = q.id;
    updates['qdj/jours/' + jour + '/rep/' + me.id] = { t: valeur, ts: Date.now() };
    return roomRef.update(updates);
  }).then(() => {
    qdjEdition = false;
    qdjSignature = '';
    qdjWorker({ action: 'repondu', jour: jour });
    if(!dejaRepondu){
      notifyPartner('💬 Question du jour',
        autre ? me.name + ' a répondu aussi : vos réponses sont dévoilées !' : me.name + ' a répondu. À ton tour !', 'qdj');
    }
    render();
  }).catch(() => {
    if(bouton){ bouton.disabled = false; bouton.textContent = 'Envoyer en secret'; }
    alert("La réponse n'est pas partie. Vérifie la connexion et réessaie.");
  });
}

// Les deux ont répondu → on crédite une seule fois, quel que soit le téléphone.
function qdjCrediter(jour){
  if(qdjCreditEnCours) return;
  const e = qdjEtatJour(jour);
  if(e.credite || !e.rep || !e.rep.p1 || !e.rep.p2) return;
  qdjCreditEnCours = true;

  roomRef.child('qdj/jours/' + jour + '/credite').transaction(v => v ? undefined : Date.now())
    .then(res => {
      if(!res || !res.committed) return;   // l'autre téléphone l'a déjà fait
      return roomRef.child('qdj/serie').transaction(s => {
        s = s || {};
        if(s.dernier === jour) return;     // déjà comptée
        const n = (s.dernier === qdjVeille(jour)) ? (s.n || 0) + 1 : 1;
        return { n: n, dernier: jour };
      }).then(r2 => {
        if(!r2 || !r2.committed) return;
        const n = r2.snapshot.val().n;
        const gain = QDJ_POINTS + (n % QDJ_BONUS_TOUS === 0 ? QDJ_BONUS : 0);
        roomRef.child('scores/p1').transaction(v => (v || 0) + gain);
        roomRef.child('scores/p2').transaction(v => (v || 0) + gain);

        const q = QDJ.questions.find(x => x.id === e.q) || qdjQuestion(jour);
        const updates = {};
        ['p1', 'p2'].forEach(j => {
          const hk = db.ref('rooms/' + roomCode + '/history').push().key;
          updates['history/' + hk] = {
            who: (state.players && state.players[j]) || j, cat: 'qdj',
            text: 'Question du jour — ' + q.q + ' (série : ' + n + ' jour' + (n > 1 ? 's' : '') + ')',
            answer: '', comment: '', pts: gain, validated: true, ts: Date.now()
          };
        });
        roomRef.update(updates);
      });
    })
    .then(() => { qdjCreditEnCours = false; }, () => { qdjCreditEnCours = false; });
}

// ---------- rendu ----------
function qdjNomAutre(){ return (state.players && state.players[partnerId]) || 'Ton/ta partenaire'; }

function renderQDJ(){
  const bloc = $('#qdj-bloc');
  if(!bloc || typeof QDJ === 'undefined') return;

  // Masqué quand un panneau de jeu (soirée, battle…) occupe l'écran.
  const picker = $('#cat-picker');
  if(picker && picker.style.display === 'none'){ bloc.style.display = 'none'; qdjSignature = ''; return; }
  bloc.style.display = '';

  const jour = qdjJour();
  const q = qdjQuestion(jour);
  const e = qdjEtatJour(jour);
  const rep = e.rep || {};
  const moi = rep[me.id], lui = rep[partnerId];
  const serie = qdjSerie(jour);
  const admin = isAdminUnlocked();

  const signature = [jour, q.id, !!moi, !!lui, moi && moi.t, lui && lui.t, serie, qdjEdition, admin, !!e.credite].join('|');
  if(signature === qdjSignature) { if(moi && lui && !e.credite) qdjCrediter(jour); return; }
  qdjSignature = signature;

  const etiquettes = { nous: 'Nous deux', souvenir: 'Souvenir', coquin: 'Coquin', envie: 'Envies & projets' };
  const flamme = serie > 0
    ? '<span class="qdj-serie" title="Jours d\'affilée">🔥 ' + serie + '</span>'
    : '<span class="qdj-serie eteinte" title="Pas de série en cours">🔥 0</span>';

  let html = '<div class="qdj-entete"><span class="qdj-titre">💬 Question du jour</span>'
    + '<span class="qdj-cat qdj-cat-' + q.cat + '">' + etiquettes[q.cat] + '</span>' + flamme + '</div>'
    + '<p class="qdj-question">' + escapeHtml(q.q) + '</p>';

  if(moi && lui){
    // ---- dévoilement ----
    html += '<div class="qdj-reponses">'
      + '<div class="qdj-rep"><span class="qdj-qui">' + escapeHtml(me.name) + '</span><p data-qdj="' + me.id + '"></p></div>'
      + '<div class="qdj-rep"><span class="qdj-qui">' + escapeHtml(qdjNomAutre()) + '</span><p data-qdj="' + partnerId + '"></p></div>'
      + '</div>';
    const n = serie || 1;
    const bonus = (n % QDJ_BONUS_TOUS === 0);
    html += '<p class="qdj-pied">+' + QDJ_POINTS + ' points chacun'
      + (bonus ? ' <strong>· bonus de série +' + QDJ_BONUS + ' !</strong>' : '')
      + ' · prochaine question demain à ' + QDJ_HEURE + ' h'
      + (bonus ? '' : ' · bonus dans ' + (QDJ_BONUS_TOUS - (n % QDJ_BONUS_TOUS)) + ' j') + '</p>';
  }else if(moi && !qdjEdition){
    // ---- en attente de l'autre ----
    html += '<div class="qdj-attente">🔒 Ta réponse est scellée. En attente de ' + escapeHtml(qdjNomAutre()) + '…</div>'
      + '<button class="qdj-lien" id="qdj-modifier">Modifier ma réponse</button>';
  }else{
    // ---- à moi de répondre ----
    html += (lui ? '<div class="qdj-statut">✓ ' + escapeHtml(qdjNomAutre()) + ' a déjà répondu — à ton tour !</div>' : '')
      + '<textarea id="qdj-champ" class="qdj-champ" rows="3" maxlength="1000" placeholder="Ta réponse, en secret…"></textarea>'
      + '<button class="qdj-envoyer" id="qdj-envoyer" disabled>Envoyer en secret</button>'
      + '<p class="qdj-pied">Vos réponses se dévoilent quand vous avez répondu tous les deux. Jusqu\'à demain ' + QDJ_HEURE + ' h.</p>';
  }

  if(admin){
    html += '<div class="qdj-admin">Dev mod · tester la notification : '
      + '<button class="qdj-lien" data-qdj-test="matin">10 h</button> · '
      + '<button class="qdj-lien" data-qdj-test="soir">20 h</button></div>';
  }

  bloc.innerHTML = html;

  // Brancher
  const champ = $('#qdj-champ');
  if(champ){
    const b = $('#qdj-envoyer');
    // La saisie ne doit JAMAIS relancer render() : seul le bouton est rafraîchi.
    champ.addEventListener('input', () => { b.disabled = !champ.value.trim(); });
    b.addEventListener('click', qdjEnvoyer);
    if(qdjEdition && moi) qdjRemplir(champ, moi.t);
  }
  const modif = $('#qdj-modifier');
  if(modif) modif.addEventListener('click', () => { qdjEdition = true; qdjSignature = ''; renderQDJ(); });
  bloc.querySelectorAll('[data-qdj-test]').forEach(el => el.addEventListener('click', () => {
    el.textContent = '…';
    qdjWorker({ action: 'test', moment: el.dataset.qdjTest }).then(r => {
      el.textContent = el.dataset.qdjTest === 'matin' ? '10 h' : '20 h';
      alert(r && r.bilan && r.bilan.length
        ? 'Notification envoyée (' + r.bilan.map(x => x[1]).join(', ') + ').'
        : 'Rien envoyé : ' + (r && r.error ? r.error : 'ce téléphone n\'est pas inscrit auprès du Worker (active les notifications).'));
    });
  }));

  // Remplir les réponses (déchiffrées si besoin)
  bloc.querySelectorAll('[data-qdj]').forEach(p => qdjRemplir(p, (rep[p.dataset.qdj] || {}).t));

  if(moi && lui && !e.credite) qdjCrediter(jour);
}

function qdjRemplir(el, valeur){
  if(!valeur){ return; }
  const poser = t => { if('value' in el && el.tagName === 'TEXTAREA'){ el.value = t; el.dispatchEvent(new Event('input')); } else el.textContent = t; };
  if(!coffreEstChiffre(valeur)){ poser(valeur); return; }
  coffreDechiffrer(valeur).then(poser, () => poser('🔒 Réponse chiffrée — ouvre le coffre pour la lire.'));
}
