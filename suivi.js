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
 * Analyse (onglet Historique du dev mod, #suivi-analyse) : par période,
 * nombre d'utilisations par joueur, temps passé (jusqu'à l'action suivante,
 * plafonné à 15 min), fonctions jamais utilisées, fil des derniers usages.
 */
const SUIVI_JOURS = 60;
const SUIVI_PLAFOND = 15 * 60 * 1000;

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
  tab_accueil:  '🏠 Onglet Accueil'
};
// Ce qui n'est pas une « fonction » à classer (bornes de session, navigation)
const SUIVI_HORS_CLASSEMENT = ['appli', 'quitte', 'tab_accueil'];

// sélecteur -> clé (le premier qui correspond gagne ; ordre = du plus précis au plus large)
const SUIVI_CIBLES = [
  ['[data-pi-mode="questions"]', 'hot_q'], ['[data-pi-mode="defis"]', 'hot_d'],
  ['[data-pi-fait]', 'hot_fait'], ['[data-pi-passer]', 'hot_passe'], ['[data-pi-valider]', 'hot_valide'],
  ['#pi-tuile', 'hot'], ['[data-mc-tester]', 'hot'],
  ['.cat-btn.locked', 'verrou'],
  ['.cat-btn[data-cat="question"]', 'question'], ['.cat-btn[data-cat="defi"]', 'defi'], ['.cat-btn[data-cat="gage"]', 'gage'],
  ['.cat-btn[data-cat="battle"]', 'battle'], ['.cat-btn[data-cat="photo"]', 'photo'], ['.cat-btn[data-cat="jds"]', 'jds'],
  ['.cat-btn[data-cat="soiree"]', 'soiree'],
  ['#jouer-btn', 'jouer'], ['#qdj-bloc', 'qdj'], ['#cj-tuile', 'coffre'], ['#pt-tuile', 'pensetoi'], ['#env-tuile', 'envies'],
  ['#evt-banniere', 'evenement'],
  ['#pending-to-validate-list button, #pending-mine-list button, #pending-autre-list button', 'attente'],
  ['.tab[data-view="view-parcours"]', 'tab_parcours'], ['.tab[data-view="view-rewards"]', 'tab_paliers'],
  ['.tab[data-view="view-content"]', 'tab_cartes'], ['.tab[data-view="view-play"]', 'tab_accueil']
];

let suiviPeriode = 7;          // jours affichés dans l'analyse
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
  else { suivi('appli'); }
});

// ---------- analyse (dev mod) ----------
function suiviEvenements(){
  const s = (state && state.suivi) || {};
  const tous = [];
  ['p1', 'p2'].forEach(pid => {
    const l = Object.values(s[pid] || {}).filter(e => e && e.f && e.ts).sort((a, b) => a.ts - b.ts);
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

  // Comptes par fonction et par joueur
  const stats = {};
  ev.forEach(e => {
    const st = stats[e.f] || (stats[e.f] = { p1: 0, p2: 0, dur: 0 });
    st[e.pid]++; st.dur += e.dur;
  });
  const fonctions = Object.keys(stats).filter(f => SUIVI_HORS_CLASSEMENT.indexOf(f) < 0)
    .sort((a, b) => (stats[b].p1 + stats[b].p2) - (stats[a].p1 + stats[a].p2));
  const jamais = Object.keys(SUIVI_NOMS).filter(f => SUIVI_HORS_CLASSEMENT.indexOf(f) < 0 && !stats[f]);

  // Sessions : ouvertures de l'appli et temps total passé
  const sess = pid => {
    const l = ev.filter(e => e.pid === pid);
    return { n: l.filter(e => e.f === 'appli').length, dur: l.reduce((t, e) => t + e.dur, 0) };
  };
  const s1 = sess('p1'), s2 = sess('p2');
  const n1 = escapeHtml(suiviNom('p1')), n2 = escapeHtml(suiviNom('p2'));
  const max = Math.max(1, ...fonctions.map(f => stats[f].p1 + stats[f].p2));

  let h = '<section class="sv-bloc"><h3>📊 Analyse des usages</h3>'
    + '<p class="sv-note">Seules les fonctions ouvertes sont notées, jamais ce qui est écrit. Conservé ' + SUIVI_JOURS + ' jours.</p>'
    + '<div class="sv-periodes">' + [1, 7, 30, 60].map(j => '<button type="button" class="sv-chip' + (j === suiviPeriode ? ' actif' : '') + '" data-sv-j="' + j + '">' + (j === 1 ? '24 h' : j + ' j') + '</button>').join('') + '</div>'
    + '<div class="sv-sessions"><div><b>' + n1 + '</b><span>' + s1.n + ' ouverture' + (s1.n > 1 ? 's' : '') + ' · ' + suiviDuree(s1.dur) + '</span></div>'
    + '<div><b>' + n2 + '</b><span>' + s2.n + ' ouverture' + (s2.n > 1 ? 's' : '') + ' · ' + suiviDuree(s2.dur) + '</span></div></div>';

  if(fonctions.length){
    h += '<div class="sv-table"><div class="sv-ligne sv-tete"><span>Fonction</span><span>' + n1 + '</span><span>' + n2 + '</span><span>Temps</span></div>'
      + fonctions.map(f => {
          const st = stats[f], tot = st.p1 + st.p2;
          return '<div class="sv-ligne"><span>' + SUIVI_NOMS[f] + '<i style="width:' + Math.round(tot / max * 100) + '%"></i></span>'
            + '<span>' + (st.p1 || '–') + '</span><span>' + (st.p2 || '–') + '</span><span>' + (st.dur ? suiviDuree(st.dur) : '–') + '</span></div>';
        }).join('') + '</div>';
  } else {
    h += '<p class="sv-note">Aucun usage enregistré sur cette période.</p>';
  }
  if(jamais.length){
    h += '<h4>😴 Jamais ouvert sur la période</h4><div class="sv-jamais">' + jamais.map(f => '<span>' + SUIVI_NOMS[f] + '</span>').join('') + '</div>';
  }

  // Fil des derniers usages
  const fil = ev.slice().sort((a, b) => b.ts - a.ts).slice(0, 80);
  if(fil.length){
    h += '<h4>🕒 Derniers usages</h4><div class="sv-fil">';
    let jour = '';
    fil.forEach(e => {
      const d = new Date(e.ts);
      const j = d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
      if(j !== jour){ jour = j; h += '<div class="sv-jour">' + j + '</div>'; }
      h += '<div class="sv-ev sv-' + e.pid + '"><span>' + d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) + '</span>'
        + '<b>' + escapeHtml(suiviNom(e.pid)) + '</b><em>' + (SUIVI_NOMS[e.f] || e.f) + '</em>'
        + (e.dur >= 5000 && e.f !== 'quitte' ? '<small>' + suiviDuree(e.dur) + '</small>' : '') + '</div>';
    });
    h += '</div>';
  }
  h += '</section>';
  if(box.innerHTML !== h){
    box.innerHTML = h;
    box.querySelectorAll('[data-sv-j]').forEach(b => b.onclick = () => { suiviPeriode = +b.dataset.svJ; renderSuivi(); });
  }
}

// Nettoyage des vieux usages, une fois par ouverture de l'onglet Historique.
document.addEventListener('click', e => {
  if(e.target.closest && e.target.closest('#tab-history') && suiviPret()){
    setTimeout(() => { suiviPurger(); renderSuivi(); }, 50);
  }
});
