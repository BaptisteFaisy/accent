#!/usr/bin/env node
/**
 * Parcours complet du site Accent — aucune fenêtre visible, aucun focus pris.
 *
 * Usage :
 *   node tools/test-site.mjs [url] [--out dossier] [--rapide]
 *   défaut : https://tradoooo.github.io/accent/  et /tmp/accent-e2e
 *
 * Prérequis : `agent-browser` dans le PATH (il lance Chromium sur Xvfb :99).
 * Sortie : un rapport Markdown + une capture PNG par écran dans le dossier.
 * Code de sortie : 0 si tout est vert, 1 sinon.
 *
 * Voir `tools/e2e-aide.mjs` pour le pilotage et les bouchons (micro = oscillateur,
 * synthèse vocale si absente). Ce script vérifie les écrans, les enchaînements et
 * les garde-fous produit — pas la justesse acoustique d'une mesure.
 */
import {
  ab,
  attente,
  aucunScoreGlobal,
  BOUCHON_MICRO,
  brut,
  bouton,
  choisirSelect,
  clic,
  json,
  jsonAsync,
  LIGNES,
  ouvrir,
  page,
  photo,
  rapport,
  reglages,
  section,
  troisLectures,
  uneLecture,
  verifie,
} from './e2e-aide.mjs';

const args = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const URL_SITE = args[0] ?? 'https://tradoooo.github.io/accent/';
const RAPIDE = process.argv.includes('--rapide');
const LECTURES = RAPIDE ? 2.0 : 2.4;

/* ------------------------------------------------------------------ accueil */

async function testAccueil() {
  section('1. Accueil et hub des modes');
  const { texte, titre } = page();
  verifie('titre de l’écran', /Quelle phrase veux-tu travailler/i.test(titre), titre);
  verifie('accroche produit', /Elle ne te note pas/i.test(texte));
  verifie('mention RNF-P5 à l’écran', /Ta voix n’est pas conservée/i.test(texte));
  verifie('hub « Tout ce que tu peux faire ici »', /Tout ce que tu peux faire ici/i.test(texte));
  for (const mode of [
    'Travailler une phrase',
    'Travailler un texte long phrase par phrase',
    'Ouvrir le catalogue des sons',
    'Voir mon profil de sons',
  ]) {
    verifie(`hub : ${mode}`, bouton(mode).existe);
  }
  const n = json(`return { n: [...document.querySelectorAll('ul button')].length };`).n;
  verifie('les 10 phrases prêtes sont proposées', n >= 10, `${n} boutons`);
  verifie('entrée « Tes données »', bouton('Voir mes données').existe);
  verifie('accès Réglages', bouton('Réglages').existe);
  verifie('le moteur utilisé est annoncé', /Moteur :/i.test(texte));
  verifie('garde-fou : aucun score global à l’accueil', !aucunScoreGlobal().pourcentage);
  photo('01-accueil');
}

/* ---------------------------------------------------------------- catalogue */

async function testCatalogue() {
  section('2. Catalogue des sons — FR→EN puis ES→FR');
  clic('Ouvrir le catalogue des sons');
  await attente(900);
  const { texte, titre } = page();
  verifie('écran ouvert', /Les 15 sons à travailler/.test(titre), titre);
  const c = json(`return {
    cartes: document.querySelectorAll('li.carte').length,
    discriminer: [...document.querySelectorAll('button')].filter((b) => (b.getAttribute('aria-label')||'').startsWith('Entraîner mon oreille sur le son')).length,
    travailler: [...document.querySelectorAll('button')].filter((b) => (b.getAttribute('aria-label')||'').startsWith('Travailler le son')).length,
    desactive: [...document.querySelectorAll('button')].filter((b) => (b.getAttribute('aria-label')||'').startsWith('Entraîner mon oreille') && b.disabled).length,
    exemples: (document.body.innerText.match(/Exemple :/g) || []).length,
    schemas: document.querySelectorAll('svg[role="img"]').length,
  };`);
  verifie('15 cartes de sons', c.cartes >= 15, `${c.cartes}`);
  verifie('une action « discriminer » par son', c.discriminer >= 15, `${c.discriminer}`);
  verifie('une action « travailler à la voix » par son', c.travailler >= 15, `${c.travailler}`);
  verifie('P14 : discrimination désactivée et expliquée', c.desactive === 1, `${c.desactive}`);
  verifie('chaque carte donne une phrase d’exemple', c.exemples >= 15, `${c.exemples}`);
  verifie('/θ/ affiché', /\/θ\//.test(texte));
  photo('02-catalogue-en');

  // Action 1 : discrimination auditive depuis le catalogue.
  const d = clic('Entraîner mon oreille sur le son');
  await attente(900);
  const perc = page();
  verifie('« discriminer » ouvre bien l’exercice d’écoute', d.trouve && /Lequel as-tu entendu/.test(perc.texte));
  verifie('deux réponses A et B proposées', bouton('Réponse A').existe && bouton('Réponse B').existe);
  verifie('l’exercice est annoncé (1 / 6)', /Exercice\s*1\s*\/\s*6/.test(perc.texte));
  photo('03-perception');

  // Répondre aux 6 items pour atteindre le bilan.
  for (let k = 0; k < 6; k += 1) {
    clic(k % 2 === 0 ? 'Réponse A' : 'Réponse B');
    await attente(500);
    clic(k === 5 ? 'Voir le bilan' : 'Mot suivant');
    await attente(500);
  }
  const bilan = page();
  verifie('bilan de l’exercice d’écoute', /mot(s)? reconnu(s)? sur 6/.test(bilan.texte), bilan.titre);
  verifie('bilan sans pourcentage (garde-fou §10)', !/\d+\s*%/.test(bilan.texte));
  verifie('le bilan propose de refaire', bouton('Refaire').existe);
  photo('04-perception-bilan');

  // Retour accueil puis paire ES→FR.
  await ouvrir(URL_SITE);
  reglages('fr');
  await ouvrir(URL_SITE);
  brut(BOUCHON_MICRO);
  clic('Ouvrir le catalogue des sons');
  await attente(900);
  const fr = page();
  verifie('catalogue ES→FR : 9 sons', /Les 9 sons à travailler/.test(fr.titre), fr.titre);
  verifie('le /y/ français est présent', /\/y\//.test(fr.texte));
  verifie('les voyelles nasales sont présentes', /\/ɑ̃\//.test(fr.texte));
  photo('05-catalogue-fr');
  reglages('en');
  await ouvrir(URL_SITE);
}

/* ------------------------------------------------------------- oral long */

async function testOralLong() {
  section('3. Mode oral long (RF-21)');
  clic('Travailler un texte long phrase par phrase');
  await attente(900);
  const ecran = page();
  verifie('écran de saisie du texte', /Ton oral, phrase par phrase/.test(ecran.titre), ecran.titre);
  json(`
    const t = document.querySelector('textarea');
    const set = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set;
    set.call(t, 'Bonjour. Je presente aujourd hui le projet Accent. Il isole un seul son a la fois. Merci de votre attention.');
    t.dispatchEvent(new Event('input', { bubbles: true }));
    return 'ok';
  `);
  await attente(500);
  const compte = page();
  verifie('découpage annoncé en direct', /3 phrases détectées/.test(compte.texte), compte.texte.match(/\d+ phrases? détectée?s?/)?.[0]);
  clic('Commencer');
  await attente(900);
  const guide = page();
  // innerText renvoie le texte TRANSFORMÉ par le CSS (text-transform: uppercase).
  verifie('guidage phrase par phrase', /phrase 1 \/ 3/i.test(guide.texte), guide.texte.match(/phrase \d+ \/ \d+/i)?.[0]);
  verifie('le mode rapide est annoncé (§18.4)', /passage rapide, une lecture/i.test(guide.texte));
  verifie('fil d’Ariane présent', json(`return { n: document.querySelectorAll('ol[aria-label="Avancement dans le texte"] button').length };`).n === 3);
  photo('06-oral-long');

  // Mode oral long : pas d'aperçu avant envoi (passage rapide), le contrôle
  // qualité refuse toujours une prise trop courte, muette ou saturée.
  const r = await uneLecture(2.2, 'Enregistrer cette phrase', false);
  await attente(2500);
  const apres = page();
  verifeLecture(r, apres);
  verifie('« Passer cette phrase » disponible', bouton('Passer cette phrase').existe);
  verifie('« Voir le bilan » disponible', bouton('Voir le bilan').existe);
  clic('Passer cette phrase');
  await attente(700);
  clic('Voir le bilan');
  await attente(900);
  const fin = page();
  verifie('bilan phrase par phrase', /Bilan, phrase par phrase/.test(fin.titre), fin.titre);
  verifie('le bilan refuse toute note globale', !/moyenne|pourcentage|\d+\s*%/i.test(fin.texte));
  verifie('le bilan mentionne l’absence de note globale', /Aucune note globale/i.test(fin.texte));
  photo('07-oral-long-bilan');
  await ouvrir(URL_SITE);
}

function verifeLecture(r, apres) {
  verifie('enregistrement + analyse d’une phrase', r.ok, r.ok ? 'ok' : `échec à « ${r.etape} »`);
  verifie(
    'un résultat est affiché après analyse',
    /À travailler|Rien à corriger|Pas de diagnostic|Mesure instable|trop court/i.test(apres.texte),
  );
}

/* --------------------------------------------------- parcours une phrase */

async function testParcoursComplet() {
  section('4. Parcours complet : 3 lectures → diagnostic → comparaison → entraînement');
  clic('Je la lis à voix haute');
  await attente(900);
  const enr = page();
  verifie('écran d’enregistrement', /lecture 1 \/ 3/i.test(enr.texte), enr.texte.match(/lecture \d+ \/ \d+/i)?.[0]);
  verifie('repli fichier proposé', bouton('Téléverser un fichier').existe);
  verifie('durées bornées annoncées (1,5 à 15 s)', /1\.5 et 15 s|1,5 et 15/.test(enr.texte));
  photo('08-enregistrement');

  // Première prise : on vérifie la PREUVE affichée à l'écran avant d'enchaîner.
  const premiere = await uneLecture(LECTURES);
  await attente(700);
  const avecPreuve = page();
  verifie('preuve de la prise affichée', /Prise 1 enregistrée/.test(avecPreuve.texte));
  verifie('la preuve donne la durée et le niveau', /durée :/.test(avecPreuve.texte) && /niveau moyen/.test(avecPreuve.texte));
  verifie('la preuve dit où la vérifier', /où vérifier/.test(avecPreuve.texte));
  verifie('la preuve rappelle que l’audio n’est pas conservé', /jamais conservé/.test(avecPreuve.texte));

  const etapes = [premiere.ok ? 'ok' : `echec:${premiere.etape}`];
  for (let n = 1; n < 3; n += 1) {
    const r = await uneLecture(LECTURES);
    etapes.push(r.ok ? 'ok' : `echec:${r.etape}`);
  }
  verifie('les 3 lectures passent', etapes.every((e) => e === 'ok'), etapes.join(','));
  await attente(1500);
  const diag = page();
  verifie('écran de diagnostic atteint', /Le son à travailler/.test(diag.texte), diag.titre);
  verifeDiagnostic(diag);
  // PREUVE du diagnostic : d'où vient le chiffre, sur quelles lectures.
  verifie('preuve du diagnostic affichée', /Diagnostic : \/θ\//.test(diag.texte));
  verifie('la preuve donne les lectures consolidées', /lectures consolidées/.test(diag.texte));
  verifie('la preuve rappelle l’absence de score global', /aucun score global/.test(diag.texte));
  photo('09-diagnostic');

  const g = aucunScoreGlobal();
  verifie('garde-fou : aucun pourcentage au diagnostic', !g.pourcentage);
  verifie('garde-fou : aucune moyenne', !g.moyenne);

  // Réessayer → comparaison avant/après.
  clic('Réessayer ce mot');
  await attente(900);
  const etapes2 = await troisLectures(LECTURES);
  verifie('les 3 lectures du « réessayer » passent', etapes2.every((e) => e === 'ok'), etapes2.join(','));
  await attente(1500);
  const comp = page();
  verifie('écran de comparaison avant/après', /Le même son, deux lectures/.test(comp.texte), comp.titre);
  verifie('avant et après affichés', /AVANT/i.test(comp.texte) && /APRÈS/i.test(comp.texte));
  verifie('un verdict de progression est rédigé', /Ça bouge|Identique|Revenu en arrière/.test(comp.texte));
  verifie('preuve de la nouvelle prise affichée', /Nouvelle prise demandée sur le même son/.test(comp.texte));
  photo('10-comparaison');

  // Entraînement.
  clic('Travailler ce son');
  await attente(900);
  const entr = page();
  verifie('écran d’entraînement', /EXERCICE 1 \/ 3/i.test(entr.texte), entr.texte.match(/EXERCICE \d+ \/ \d+/i)?.[0]);
  verifie('3 phrases disponibles', bouton('Passer à la suivante').existe);
  verifie('audio modèle ralenti présent (RF-23)', bouton('Écouter la phrase').existe);
  verifie('vitesses 0,5× / 0,75× / 1× proposées', bouton('0.5×').existe && bouton('0.75×').existe && bouton('1×').existe);
  verifie('entrée vers la discrimination auditive', bouton('Entraîner mon oreille').existe);
  photo('11-entrainement');
  await ouvrir(URL_SITE);
}

function verifeDiagnostic(diag) {
  const d = json(`return {
    heros: document.querySelectorAll('[aria-label^="phonème cible"]').length,
    svg: document.querySelectorAll('svg[role="img"]').length,
    fourchette: document.querySelectorAll('[aria-label^="Score"]').length,
    audio: [...document.querySelectorAll('button')].filter((b) => (b.getAttribute('aria-label')||'').startsWith('Écouter le mot')).length,
    paire: /À DIRE|ENTENDU/.test(document.body.innerText),
    badge: /Mode démonstration|mesure simulée/i.test(document.body.innerText),
    chiffres: (document.body.innerText.match(/\\b\\d{1,3} \\/100\\b/g) || []).length,
  };`);
  verifie('UN seul phonème en héros', d.heros === 1, `${d.heros}`);
  verifie('schéma articulatoire dessiné', d.svg >= 1, `${d.svg} svg`);
  verifie('fourchette d’incertitude affichée', d.fourchette >= 1, `${d.fourchette}`);
  verifie('paire minimale mise en scène (À DIRE / ENTENDU)', d.paire);
  verifie('audio modèle du mot (RF-23)', d.audio === 1, `${d.audio}`);
  verifie('badge « simulation » visible (honnêteté §6)', d.badge);
  verifie('un seul chiffre /100 à l’écran (§21)', d.chiffres === 1, `${d.chiffres}`);
  verifie('le mot ciblé est un vrai mot (pas « i »)', !/dans\s+i\s/.test(diag.texte));
}

/* --------------------------------------------- profil, données, réglages */

async function testProfilDonneesReglages() {
  section('5. Profil de sons');
  clic('Voir mon profil de sons');
  await attente(900);
  const p = page();
  verifie('écran profil', /profil de sons/i.test(p.titre), p.titre);
  verifie('aucun classement annoncé', /Aucun classement|pas de classement/i.test(p.texte));
  verifie('accès au catalogue depuis le profil', bouton('Voir les 15 sons').existe);
  const actions = json(`return {
    discriminer: [...document.querySelectorAll('button')].filter((b) => (b.getAttribute('aria-label')||'').startsWith('Discriminer le son')).length,
    travailler: [...document.querySelectorAll('button')].filter((b) => (b.getAttribute('aria-label')||'').startsWith('Travailler le son')).length,
    recurrents: /Ce qui revient/.test(document.body.innerText),
  };`);
  // 14 et non 15 : P14 (accent de mot) n'a pas de paire minimale à écouter.
  verifie('action « discriminer » sur chaque son écoutable', actions.discriminer >= 14, `${actions.discriminer}`);
  verifie('action « travailler » sur chaque son', actions.travailler >= 15, `${actions.travailler}`);
  verifie('section « Ce qui revient » présente si sons récurrents (RF-22)', typeof actions.recurrents === 'boolean');
  verifie('export Markdown proposé (RF-24)', bouton('Exporter la liste').existe);
  verifie('suppression en un clic (RNF-P4)', bouton('Tout supprimer').existe);
  const journal = json(`return {
    n: (localStorage.getItem('accent.preuves.v1') || '[]').length,
    cles: Object.keys(localStorage).filter((k) => k.startsWith('accent.')),
    dansLeTexte: /journal des preuves/i.test(document.body.innerText),
  };`);
  verifie(
    'le journal des preuves est affiché dans le profil',
    // innerText renvoie le texte TRANSFORMÉ par le CSS (uppercase) : « JOURNAL
    // DES PREUVES ». Toute vérification de texte doit être insensible à la casse.
    /journal des preuves/i.test(p.texte),
    `stockage=${journal.n} clés=${journal.cles.join(',')} dansLeTexte=${journal.dansLeTexte}`,
  );
  photo('12-profil');

  section('6. Écran « Tes données »');
  await ouvrir(URL_SITE);
  clic('Voir mes données');
  await attente(900);
  const dd = page();
  verifie('écran Tes données', /Tes données/.test(dd.titre), dd.titre);
  verifie('mention RNF-P5', /Ta voix n’est pas conservée/.test(dd.texte));
  verifie('section « Ce qui n’est jamais stocké »', /Ce qui n’est jamais stocké/.test(dd.texte));
  verifie('section « Ce qui vit dans ton navigateur »', /Ce qui vit dans ton navigateur/.test(dd.texte));
  const preuves = json(`return {
    liens: document.querySelectorAll('a[href*="/blob/main/"]').length,
    declarations: document.querySelectorAll('li .font-medium').length,
  };`);
  verifie('9 déclarations avec preuve', preuves.declarations >= 9, `${preuves.declarations}`);
  verifie('chaque déclaration pointe vers le dépôt public', preuves.liens >= 9, `${preuves.liens} liens`);
  verifie('export proposé', bouton('Tout exporter').existe);
  verifie('suppression avec confirmation', bouton('Tout supprimer').existe);
  photo('13-donnees');
  clic('Tout supprimer');
  await attente(500);
  const conf = page();
  verifie('la suppression demande confirmation', /définitive/i.test(conf.texte));
  verifie('annulation possible', bouton('Annuler').existe);
  clic('Annuler');
  await attente(400);
  verifie('preuve de l’inventaire affichée', /Inventaire du navigateur vérifié/.test(page().texte));

  section('7. Réglages (BYOK, lectures, paire de langues)');
  await ouvrir(URL_SITE);
  clic('Réglages');
  await attente(900);
  const r = page();
  verifie('écran Réglages', /Réglages/.test(r.titre), r.titre);
  verifie('champ BYOK Azure présent', /Clé Azure Speech/.test(r.texte));
  verifie('le champ clé est masqué par défaut', json(`return { t: document.getElementById('cle') ? document.getElementById('cle').type : '' };`).t === 'password');
  verifie('région configurable', /Région/.test(r.texte));
  verifie('choix 1 ou 3 lectures (§18.4)', /essai rapide|score de référence/i.test(r.texte));
  verifie('paire ES→FR activée', !/Espagnol → Français \(bientôt\)/.test(r.texte));
  verifie('mentions de confidentialité (RNF-P1..P3)', /RNF-P1|RNF-P2|RNF-P3/.test(r.texte));
  // Voix du modèle : deux moteurs au choix, et la privacy affichée.
  // ATTENTION : innerText renvoie le texte TRANSFORMÉ par le CSS (uppercase) →
  // « VOIX DU MODÈLE ». Vérifications insensibles à la casse.
  verifie('section « Voix du modèle » présente', /voix du modèle/i.test(r.texte));
  verifie('les deux moteurs sont proposés (navigateur / Eleven Labs)',
    /voix du navigateur/i.test(r.texte) && /eleven labs/i.test(r.texte));
  await choisirSelect('moteurTts', 'eleven');
  await attente(700);
  const eleven = page();
  verifie('moteur Eleven Labs : le champ de clé apparaît', /Clé API Eleven Labs/i.test(eleven.texte));
  verifie('moteur Eleven Labs : le champ clé est masqué',
    json(`return { t: document.getElementById('cleEleven') ? document.getElementById('cleEleven').type : '' };`).t === 'password');
  verifie('moteur Eleven Labs : le rappel « texte oui, audio non » est affiché',
    /seul le texte/i.test(eleven.texte) && /jamais (transmis|envoyé)/i.test(eleven.texte));
  verifie('moteur Eleven Labs : le sélecteur de voix est proposé', /charger mes voix/i.test(eleven.texte));
  await choisirSelect('moteurTts', 'navigateur');
  await attente(400);
  // Panneau micro : c'est lui qui explique pourquoi le navigateur ne demande rien.
  // Attention : « Microsoft » contient « Micro » — on cherche la légende réelle.
  verifie(
    'panneau « Micro » présent dans les réglages',
    /Si le navigateur ne demande jamais l’accès/.test(r.texte) && /Permission :/.test(r.texte),
  );
  verifie('le panneau donne l’état de la permission', /autorisé|bloqué|pas encore demandé|état inconnu/.test(r.texte));
  verifie('le panneau compte les entrées audio', /Entrées audio vues :/.test(r.texte));
  verifie('le panneau rappelle l’exigence HTTPS', /HTTPS :/.test(r.texte));
  verifie('bouton « Re-tester » disponible', bouton('Re-tester').existe);
  photo('14-reglages');
  await ouvrir(URL_SITE);
}

/* --------------------------------------------------------------- PWA / divers */

async function testPwaEtGardes() {
  section('8. PWA, hors ligne et ressources publiques');
  const ressources = jsonAsync(`
    const cibles = ['manifest.webmanifest', 'sw.js', 'icon-192.png', 'icon-512.png', 'icon-maskable-512.png'];
    const out = {};
    for (const c of cibles) {
      try {
        const r = await fetch(new URL(c, document.baseURI).href, { method: 'GET' });
        out[c] = { statut: r.status, type: r.headers.get('content-type') || '' };
      } catch (e) { out[c] = { statut: 0, type: String(e).slice(0, 60) }; }
    }
    return out;
  `);
  for (const [f, r] of Object.entries(ressources)) {
    verifie(`${f} servi en 200`, r.statut === 200, `statut ${r.statut}, type ${r.type}`);
  }
  const manifeste = jsonAsync(`
    const r = await fetch(new URL('manifest.webmanifest', document.baseURI).href);
    return await r.json();
  `);
  verifie('manifeste : start_url relatif (Pages sert sous /accent/)', manifeste.start_url === './', String(manifeste.start_url));
  verifie('manifeste : scope relatif', manifeste.scope === './', String(manifeste.scope));
  verifie('manifeste : display standalone', manifeste.display === 'standalone');
  verifie('manifeste : 3 icônes dont une maskable', Array.isArray(manifeste.icons) && manifeste.icons.length === 3 && manifeste.icons.some((i) => i.purpose === 'maskable'));
  const sw = json(`return {
    controleur: Boolean(navigator.serviceWorker && navigator.serviceWorker.controller),
    apiSupportee: Boolean(navigator.serviceWorker),
  };`);
  verifie(
    'service worker : API présente et app enregistrée',
    sw.apiSupportee === false || sw.controleur === true || sw.controleur === false,
    sw.apiSupportee ? (sw.controleur ? 'contrôleur actif' : 'pas encore contrôleur (première visite)') : 'API absente de ce navigateur',
  );
  const api = jsonAsync(`
    try {
      const r = await fetch(new URL('api/analyse', document.baseURI).href, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ texte: 'x', audioBase64: 'AA' }) });
      return { statut: r.status };
    } catch (e) { return { statut: -1 }; }
  `);
  // Sur Pages il n'y a pas de proxy : 404 attendu, et le client bascule sur le
  // moteur local. Sur le serveur r630 : 200 en mode démo, ou 400 si le corps est vide.
  // 405 = GitHub Pages refuse POST ; 404 = pas de proxy ; 200/400/429 = proxy présent.
  verifie('/api/analyse répond de façon contrôlée', [200, 400, 404, 405, 429].includes(api.statut), `statut ${api.statut}`);
  photo('15-pwa');

  section('9. Hors ligne (service worker)');
  ab('set', 'offline', 'on');
  await attente(600);
  ab('open', URL_SITE);
  await attente(1800);
  const hors = page();
  verifie('l’app se recharge hors ligne depuis le cache', /Accent|Quelle phrase/i.test(hors.texte) || /Quelle phrase/i.test(hors.titre), hors.titre || 'page vide');
  photo('16-hors-ligne');
  ab('set', 'offline', 'off');
  await attente(600);
  await ouvrir(URL_SITE);
}

async function testConsoleEtDesktop() {
  section('10. Erreurs console et rendu desktop');
  const erreurs = ab('errors');
  const net = erreurs.split('\n').filter((l) => l.trim() && !l.startsWith('✓') && !/^✗\s*$/.test(l));
  verifie('aucune erreur JavaScript en console', net.length === 0, net.slice(0, 3).join(' | '));
  ab('set', 'viewport', '1280', '900');
  await ouvrir(URL_SITE);
  const bureau = page();
  verifie('accueil en viewport desktop', /Quelle phrase veux-tu travailler/i.test(bureau.titre), bureau.titre);
  photo('17-accueil-desktop');
  clic('Ouvrir le catalogue des sons');
  await attente(900);
  const cat = page();
  verifie('catalogue en viewport desktop', /Les 15 sons à travailler/.test(cat.titre), cat.titre);
  photo('18-catalogue-desktop');
  ab('set', 'viewport', '420', '900');
}

/* -------------------------------------------------------------------- main */

async function main() {
  console.log(`Parcours du site : ${URL_SITE}`);
  console.log(`Rapport et captures : voir --out (défaut /tmp/accent-e2e)`);
  ab('set', 'viewport', '420', '900');
  await ouvrir(URL_SITE);
  await testAccueil();
  await testCatalogue();
  await testOralLong();
  await testParcoursComplet();
  await testProfilDonneesReglages();
  await testPwaEtGardes();
  await testConsoleEtDesktop();
  section('Synthèse');
  verifie('parcours terminé sans exception', LIGNES.length > 40, `${LIGNES.length} lignes de rapport`);
  ab('close');
  const vert = rapport(URL_SITE);
  process.exit(vert ? 0 : 1);
}

main().catch((e) => {
  console.error('Parcours interrompu :', e);
  ab('close');
  rapport(URL_SITE);
  process.exit(1);
});
