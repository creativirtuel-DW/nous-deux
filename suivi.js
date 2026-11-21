/**
 * Nous Deux — suivi des usages (analyse de ce qui plaît), visible en dev mod
 * ===========================================================================
 * Enregistre QUELLES FONCTIONS chacun ouvre (jamais ce qui est écrit) :
 *   rooms/$room/suivi/<pid>/<clé> = { f: 'clé de fonction', ts }
 * Les clics sont repérés par un écouteur global (aucun module à modifier) :
 * SUIVI_CIBLES associe un sélecteur CSS à une fonction. Les événements sont
 * mis en tampon (localStorage) et envoyés par paquets (toutes les 60 s, et
 * quand l'appli passe en arrière-plan) pour ne pas redessiner l'appli à
 * chaque clic. Nettoyage automatique au-delà de SUIVI_JOURS jours.
 *
 * Notifications (21/11/2026) : chaque notification reçue est notée chez celui
 * ou celle qui la reçoit — { f:'notif', ts, t: titre, tag, push } —, par
 * l'expéditeur (notifyPartner) ou, pour les rappels du serveur, par le
 * téléphone qui les reçoit (sw.js → cache → suiviRangerNotifsServeur).
 * Elles n'entrent PAS dans le calcul des durées. L'analyse « Effet des
 * notifications » regarde si l'appli est ouverte dans les SUIVI_EFFET_MIN
 * minutes et combien de temps on y joue ensuite.
 *
 * Analyse (onglet Historique du dev mod, #suivi-analyse) : par période,
 * nombre d'utilisations par joueur, temps passé (jusqu'à l'action suivante,
 * plafonné à 15 min), fonctions jamais utilisées, fil des derniers usages.
 */
const SUIVI_JOURS = 60;
const SUIVI_PLAFOND = 15 * 60 * 1000;
const SUIVI_EFFET_MIN = 30;   // ouverture comptée « grâce à » la notification si elle suit dans ces minutes

// clé -> libellé affiché
const SUIVI_NOMS = {
  appli:        '📱 Ouverture de l’appli',
  quitte:       '💤 Appli quittée',
  jouer:        '▶️ Bouton Jouer',
  qdj:          '💭 Pensée du jour',
  coffre:       '🧰 Coffre Surprise',
  pensetoi:     '💌 Je pense à toi',
  envies:       '🌠 Ma liste des envies',
  evenement:    '🎄 Bannière événement',
  question:     '💬 Question',
  defi:         '🔥 Défi',
  gage:         '😈 Cap ou pas',
  battle:       '⚔️ Battle',
  synchro:      '💞 On est synchro !',
  photo:        '📸 Défi Photo',
  jds:          '🎲 Jeu de société',
  soiree:       '🌙 Soirée guidée',
  verrou:       '🔒 Jeu HOT bloqué',
  hot:          '🌶️ Plaisirs Intimes',
  hot_q:        '🌶️ HOT · Question tirée',
  hot_d:        '🌶️ HOT · Défi tiré',
  hot_fait:     '🌶️ HOT · carte faite',
  hot_passe:    '🌶️ HOT · carte passée',
  hot_valide:   '🌶️ HOT · réponse validée',
  attente:      '✅ Cartes à valider',
  tab_parcours: '🗺️ Onglet Parcours',
  tab_paliers:  '🏆 Onglet Paliers',
  tab_cartes:   '✏️ Onglet Cartes',
  tab_accueil:  '🏠 Onglet Accueil',
  notif:        '🔔 Notification reçue'
};
// Ce qui n'est pas une « fonction » à classer (bornes de session, navigation)
const SUIVI_HORS_CLASSEMENT = ['appli', 'quitte', 'tab_accueil', 'notif'];

// sélecteur -> clé (le premier qui correspond gagne ; ordre = du plus précis au plus large)
const SUIVI_CIBLES = [
  ['[data-pi-mode="questions"]', 'hot_q'], ['[data-pi-mode="defis"]', 'hot_d'],
  ['[data-pi-fait]', 'hot_fait'], ['[data-pi-passer]', 'hot_passe'], ['[data-pi-valider]', 'hot_valide'],
  ['#pi-tuile', 'hot'], ['[data-mc-tester]', 'hot'],
  ['.cat-btn.locked', 'verrou'],
  ['.cat-btn[data-cat="question"]', 'question'], ['.cat-btn[data-cat="defi"]', 'defi'], ['.cat-btn[data-cat="gage"]', 'gage'],
  ['.cat-btn[data-cat="battle"]', 'battle'], ['.cat-btn[data-cat="synchro"]', 'synchro'], ['.cat-btn[data-cat="photo"]', 'photo'], ['.cat-btn[data-cat="jds"]', 'jds'],
  ['.cat-btn[data-cat="soiree"]', 'soiree'],
  ['#jouer-btn', 'jouer'], ['#qdj-bloc', 'qdj'], ['#cj-tuile', 'coffre'], ['#pt-tuile', 'pensetoi'], ['#env-tuile', 'envies'],
  ['#evt-banniere', 'evenement'],
  ['#pending-to-validate-list button, #pending-mine-list button, #pending-autre-list button', 'attente'],
  ['.tab[data-view="view-parcours"]', 'tab_parcours'], ['.tab[data-view="view-rewards"]', 'tab_paliers'],
  ['.tab[data-view="view-content"]', 'tab_cartes'], ['.tab[data-view="view-play"]', 'tab_accueil']
];

let suiviPeriode = 7;          // jours affichés dans l'analyse
let suiviJoueur = null;        // 'p1' | 'p2' : détail affiché pour cette personne (clic sur son prénom)
let suiviMinuteur = null;

function suiviPret(){ return typeof roomRef !== 'undefined' && roomRef && me && me.id && roomCode; }
function suiviCleTampon(){ return 'nousdeux_suivi_tampon_' + roomCode + '_' + me.id; }
function suiviLireTampon(){ try{ return JSON.parse(localStorage.getItem(suiviCleTampon()) || '[]'); }catch(e){ return []; } }
function suiviEcrireTampon(a){ try{ localStorage.setItem(suiviCleTampon(), JSON.stringify(a)); }catch(e){} }

// Note un usage (mis en tampon).
function suivi(f){
  if(!suiviPret() || !SUIVI_NOMS[f]) return;
  const t = suiviLireTampon();
  const der = t[t.length - 1];
  if(der && der.f === f && Date.now() - der.ts < 1500) return;   // double-clic
  t.push({ f, ts: Date.now() });
  suiviEcrireTampon(t);
}

// Envoie le tampon en une seule écriture.
function suiviEnvoyer(){
  if(!suiviPret()) return;
  const t = suiviLireTampon();
  if(!t.length) return;
  const maj = {};
  t.forEach(e => { maj[roomRef.child('suivi/' + me.id).push().key] = e; });
  suiviEcrireTampon([]);
  roomRef.child('suivi/' + me.id).update(maj).catch(() => {
    suiviEcrireTampon(t.concat(suiviLireTampon()));   // échec : on garde pour plus tard
  });
}

// Appelé par startApp (app.js)
function suiviDemarrer(){
  suivi('appli');
  suiviEnvoyer();
  suiviRangerNotifsServeur();
  if(!suiviMinuteur) suiviMinuteur = setInterval(suiviEnvoyer, 60000);
}

document.addEventListener('click', e => {
  if(!suiviPret()) return;
  const el = e.target.closest ? e.target : null;
  if(!el) return;
  for(const [sel, f] of SUIVI_CIBLES){
    if(el.closest(sel)){ suivi(f); return; }
  }
}, true);

document.addEventListener('visibilitychange', () => {
  if(!suiviPret()) return;
  if(document.visibilityState === 'hidden'){ suivi('quitte'); suiviEnvoyer(); }
  else { suivi('appli'); suiviRangerNotifsServeur(); }
});

// Une notification reçue par `pid` (écrite tout de suite, une ligne par notification).
function suiviNotifRecue(pid, titre, tag, push){
  if(!suiviPret() || !pid) return;
  roomRef.child('suivi/' + pid).push({ f: 'notif', ts: Date.now(), t: String(titre || '').slice(0, 70), tag: tag || '', push: !!push })
    .catch(() => {});
}

// Rappels envoyés par le serveur (pensée du jour) : sw.js les a gardés dans
// un cache du téléphone ; on les range dans l'historique puis on les efface.
function suiviRangerNotifsServeur(){
  if(!suiviPret() || !('caches' in window)) return;
  caches.open('nd-notifs-recues').then(c => c.keys().then(cles => Promise.all(cles.map(req =>
    c.match(req).then(r => r && r.json()).then(n => {
      if(n && n.ts) roomRef.child('suivi/' + me.id).push({ f: 'notif', ts: n.ts, t: String(n.t || '').slice(0, 70), tag: n.tag || '', push: true, serveur: true });
      return c.delete(req);
    }).catch(() => c.delete(req))
  )))).catch(() => {});
}

// ---------- analyse (dev mod) ----------
function suiviEvenements(){
  const s = (state && state.suivi) || {};
  const tous = [];
  ['p1', 'p2'].forEach(pid => {
    const tout = Object.values(s[pid] || {}).filter(e => e && e.f && e.ts);
    tout.filter(e => e.f === 'notif').forEach(e => tous.push({ pid, f: 'notif', ts: e.ts, dur: 0, t: e.t || '', tag: e.tag || '', push: !!e.push }));
    const l = tout.filter(e => e.f !== 'notif').sort((a, b) => a.ts - b.ts);
    l.forEach((e, i) => {
      const suiv = l[i + 1];
      let dur = 0;
      if(e.f !== 'quitte' && suiv) dur = Math.min(suiv.ts - e.ts, SUIVI_PLAFOND);
      tous.push({ pid, f: e.f, ts: e.ts, dur });
    });
  });
  return tous;
}
function suiviDuree(ms){
  if(ms < 60000) return Math.round(ms / 1000) + ' s';
  const m = Math.round(ms / 60000);
  return m < 60 ? m + ' min' : Math.floor(m / 60) + ' h ' + String(m % 60).padStart(2, '0');
}
function suiviNom(pid){ return (state && state.players && state.players[pid]) || pid; }

function suiviPurger(){
  const lim = Date.now() - SUIVI_JOURS * 86400000;
  const s = (state && state.suivi) || {};
  const maj = {};
  Object.entries(s).forEach(([pid, l]) => Object.entries(l || {}).forEach(([k, e]) => {
    if(!e || !e.ts || e.ts < lim) maj['suivi/' + pid + '/' + k] = null;
  }));
  if(Object.keys(maj).length) roomRef.update(maj);
}

function renderSuivi(){
  const box = document.getElementById('suivi-analyse');
  if(!box) return;
  const vue = document.getElementById('view-history');
  if(!vue || !vue.classList.contains('active') || !(typeof isAdminUnlocked === 'function' && isAdminUnlocked())){
    box.innerHTML = ''; return;
  }
  const depuis = Date.now() - suiviPeriode * 86400000;
  const ev = suiviEvenements().filter(e => e.ts >= depuis);

  const sel = suiviJoueur;   // joueur dont on déroule le détail (null = aucun)

  // Temps passé et ouvertures de l'appli, pour chacun
  const sess = pid => {
    const l = ev.filter(e => e.pid === pid);
    return { n: l.filter(e => e.f === 'appli').length, dur: l.reduce((t, e) => t + e.dur, 0) };
  };
  const carte = pid => {
    const s = sess(pid), nom = escapeHtml(suiviNom(pid));
    return '<button type="button" class="sv-pers sv-' + pid + (sel === pid ? ' actif' : '') + '" data-sv-p="' + pid + '">'
      + '<b>' + nom + '</b><strong class="sv-temps">' + suiviDuree(s.dur) + '</strong>'
      + '<span>sur l’appli · ' + s.n + ' ouverture' + (s.n > 1 ? 's' : '') + '</span>'
      + '<small>' + (sel === pid ? 'Masquer le détail ▴' : 'Voir le détail ▾') + '</small></button>';
  };

  let h = '<section class="sv-bloc"><h3>📊 Analyse des usages</h3>'
    + '<p class="sv-note">Seules les fonctions ouvertes sont notées, jamais ce qui est écrit. Conservé ' + SUIVI_JOURS + ' jours.</p>'
    + '<div class="sv-periodes">' + [1, 7, 30, 60].map(j => '<button type="button" class="sv-chip' + (j === suiviPeriode ? ' actif' : '') + '" data-sv-j="' + j + '">' + (j === 1 ? '24 h' : j + ' j') + '</button>').join('') + '</div>'
    + '<div class="sv-sessions">' + carte('p1') + carte('p2') + '</div>';

  if(!sel){
    h += '<p class="sv-astuce">👆 Touche un prénom pour dérouler le détail de ses usages.</p>';
  } else {
    // Détail de la personne choisie uniquement
    const mes = ev.filter(e => e.pid === sel);
    const stats = {};
    mes.forEach(e => {
      const st = stats[e.f] || (stats[e.f] = { n: 0, dur: 0, h: [] });
      st.n++; st.dur += e.dur;
      st.h.push(e.ts);
    });
    // Une ligne par jour (le plus récent en haut) : « date : heures », heures du matin au soir.
    const heures = l => {
      const jours = {}, MAXI = 12;
      l.forEach(ts => {
        const d = new Date(ts);
        const cle = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
        (jours[cle] || (jours[cle] = [])).push(d);
      });
      return Object.keys(jours).sort().reverse().map(cle => {
        const t = jours[cle].sort((a, b) => a - b);
        const date = t[0].toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });
        const txt = t.slice(0, MAXI).map(d => String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'));
        return '<div class="sv-heures">🕒 <b>' + date + '</b> : ' + txt.join(' · ') + (t.length > MAXI ? ' · +' + (t.length - MAXI) : '') + '</div>';
      }).join('');
    };
    const fonctions = Object.keys(stats).filter(f => SUIVI_HORS_CLASSEMENT.indexOf(f) < 0).sort((a, b) => stats[b].n - stats[a].n);
    const jamais = Object.keys(SUIVI_NOMS).filter(f => SUIVI_HORS_CLASSEMENT.indexOf(f) < 0 && !stats[f]);
    const max = Math.max(1, ...fonctions.map(f => stats[f].n));
    const ns = escapeHtml(suiviNom(sel));
    h += '<div class="sv-detail sv-' + sel + '"><div class="sv-detail-tete"><b>Détail de ' + ns + '</b><button type="button" class="qdj-lien" data-sv-p="' + sel + '">Fermer ✕</button></div>';
    if(fonctions.length){
      h += '<div class="sv-table"><div class="sv-ligne sv-tete"><span>Fonction</span><span>Fois</span><span>Temps</span></div>'
        + fonctions.map(f => '<div class="sv-ligne"><span>' + SUIVI_NOMS[f] + '<i style="width:' + Math.round(stats[f].n / max * 100) + '%"></i></span>'
          + '<span>' + stats[f].n + '</span><span>' + (stats[f].dur ? suiviDuree(stats[f].dur) : '–') + '</span>'
          + heures(stats[f].h) + '</div>').join('') + '</div>';
    } else {
      h += '<p class="sv-note">Aucun usage sur cette période.</p>';
    }
    if(jamais.length){
      h += '<h4>😴 Jamais ouvert</h4><div class="sv-jamais">' + jamais.map(f => '<span>' + SUIVI_NOMS[f] + '</span>').join('') + '</div>';
    }
    h += suiviEffetNotifs(mes, ns);
    const fil = mes.slice().sort((a, b) => b.ts - a.ts).slice(0, 80);
    if(fil.length){
      h += '<h4>🕒 Derniers usages</h4><div class="sv-fil">';
      let jour = '';
      fil.forEach(e => {
        const d = new Date(e.ts);
        const jr = d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
        if(jr !== jour){ jour = jr; h += '<div class="sv-jour">' + jr + '</div>'; }
        h += '<div class="sv-ev sv-' + e.pid + '"><span>' + d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) + '</span>'
          + '<em>' + (e.f === 'notif' ? '🔔 ' + escapeHtml(e.t || 'Notification') + (e.push ? '' : ' <i class="sv-sans-push">(cloche seule)</i>') : (SUIVI_NOMS[e.f] || e.f)) + '</em>'
          + (e.dur >= 5000 && e.f !== 'quitte' ? '<small>' + suiviDuree(e.dur) + '</small>' : '<small></small>') + '</div>';
      });
      h += '</div>';
    }
    h += '</div>';
  }
  h += '</section>';
  if(box.innerHTML !== h){
    box.innerHTML = h;
    box.querySelectorAll('[data-sv-j]').forEach(b => b.onclick = () => { suiviPeriode = +b.dataset.svJ; renderSuivi(); });
    box.querySelectorAll('[data-sv-p]').forEach(b => b.onclick = () => {
      suiviJoueur = suiviJoueur === b.dataset.svP ? null : b.dataset.svP; renderSuivi();
    });
  }
}

// Nettoyage des vieux usages, une fois par ouverture de l'onglet Historique.
document.addEventListener('click', e => {
  if(e.target.closest && e.target.closest('#tab-history') && suiviPret()){
    setTimeout(() => { suiviPurger(); renderSuivi(); }, 50);
  }
});

// ---------- effet des notifications ----------
// Pour chaque notification reçue : l'appli a-t-elle été ouverte (ou déjà
// ouverte) dans les SUIVI_EFFET_MIN minutes ? Combien de temps de jeu ensuite
// (jusqu'à « appli quittée ») ? Comparé au temps moyen des autres visites.
function suiviEffetNotifs(mes, ns){
  const notifs = mes.filter(e => e.f === 'notif').sort((a, b) => b.ts - a.ts);
  if(!notifs.length) return '<h4>🔔 Effet des notifications</h4><p class="sv-note">Aucune notification reçue sur cette période.</p>';
  const usages = mes.filter(e => e.f !== 'notif').sort((a, b) => a.ts - b.ts);
  const fen = SUIVI_EFFET_MIN * 60000;
  // Temps de jeu d'une visite commencée à l'indice i (jusqu'à « quitte »).
  const visite = i => { let t = 0; for(let j = i; j < usages.length && usages[j].f !== 'quitte'; j++) t += usages[j].dur; return t; };
  const lignes = notifs.map(n => {
    const i = usages.findIndex(u => u.ts >= n.ts && u.ts - n.ts <= fen && u.f !== 'quitte');
    if(i < 0) return { n, ouvert: false };
    return { n, ouvert: true, delai: usages[i].ts - n.ts, jeu: visite(i), debut: usages[i].ts };
  });
  const suivies = lignes.filter(l => l.ouvert);
  // Visites « spontanées » : ouvertures de l'appli sans notification dans la fenêtre précédente.
  const spont = [];
  usages.forEach((u, i) => {
    if(u.f !== 'appli') return;
    if(notifs.some(n => u.ts >= n.ts && u.ts - n.ts <= fen)) return;
    spont.push(visite(i));
  });
  const moy = a => a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0;
  const med = a => { if(!a.length) return 0; const b = a.slice().sort((x, y) => x - y); return b[Math.floor(b.length / 2)]; };
  const pct = Math.round(suivies.length / notifs.length * 100);
  let h = '<h4>🔔 Effet des notifications</h4><div class="sv-effet">'
    + '<div><b>' + notifs.length + '</b><span>notification' + (notifs.length > 1 ? 's' : '') + ' reçue' + (notifs.length > 1 ? 's' : '') + '</span></div>'
    + '<div><b>' + pct + ' %</b><span>suivies d’une visite en moins de ' + SUIVI_EFFET_MIN + ' min</span></div>'
    + '<div><b>' + (suivies.length ? suiviDuree(med(suivies.map(l => l.delai))) : '–') + '</b><span>délai médian avant d’ouvrir</span></div>'
    + '<div><b>' + (suivies.length ? suiviDuree(moy(suivies.map(l => l.jeu))) : '–') + '</b><span>de jeu en moyenne après une notification</span></div>'
    + '<div><b>' + (spont.length ? suiviDuree(moy(spont)) : '–') + '</b><span>par visite sans notification (pour comparer)</span></div>'
    + '</div><div class="sv-fil sv-notifs">';
  lignes.slice(0, 40).forEach(l => {
    const d = new Date(l.n.ts);
    const quand = d.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' }) + ' ' + d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    h += '<div class="sv-notif' + (l.ouvert ? ' ok' : '') + '"><span>' + quand + '</span>'
      + '<em>' + escapeHtml(l.n.t || 'Notification') + (l.n.push ? '' : ' <i class="sv-sans-push">(cloche seule, pas de push)</i>') + '</em>'
      + '<small>' + (l.ouvert
          ? (l.delai < 60000 ? 'appli ouverte tout de suite' : 'ouverte après ' + suiviDuree(l.delai)) + ' · ' + suiviDuree(l.jeu) + ' de jeu'
          : 'pas d’ouverture dans les ' + SUIVI_EFFET_MIN + ' min') + '</small></div>';
  });
  return h + '</div>';
}
