/**
 * Bibliothèque de pilotage pour le parcours complet du site (`test-site.mjs`).
 *
 * Le navigateur est conduit par `agent-browser`, qui fait tourner Chromium sur
 * **Xvfb :99** : aucune fenêtre sur l'écran de l'utilisateur, aucun vol de focus.
 * Aucune dépendance npm (node:child_process uniquement).
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

export const LIGNES = [];
let ok = 0;
let ko = 0;

/**
 * Session navigateur DÉDIÉE. La session par défaut d'`agent-browser` est partagée
 * par tous les agents de la machine : un autre processus peut naviguer ailleurs
 * en plein milieu du parcours (constaté : le test s'est retrouvé sur un site
 * tiers, 22 faux échecs). On impose donc notre propre session.
 */
if (!process.env.AGENT_BROWSER_SESSION) {
  process.env.AGENT_BROWSER_SESSION = 'accent-e2e';
}

export function dossier() {
  const k = process.argv.indexOf('--out');
  const d = k >= 0 && process.argv[k + 1] ? process.argv[k + 1] : '/tmp/accent-e2e';
  mkdirSync(d, { recursive: true });
  return d;
}

export const SORTIE = dossier();

/* ----------------------------------------------------------------- pilotage */

export function ab(...commande) {
  try {
    return execFileSync('agent-browser', commande, { encoding: 'utf8', timeout: 180_000 }).trim();
  } catch (e) {
    return `__ERREUR__ ${String(e.message).slice(0, 200)}`;
  }
}

/** Évalue une expression JS dans la page et renvoie la valeur JSON décodée. */
export function json(corps) {
  const brut = ab('eval', `JSON.stringify((() => { ${corps} })())`);
  if (brut.startsWith('__ERREUR__')) return { erreur: brut };
  try {
    return JSON.parse(JSON.parse(brut));
  } catch {
    return { brut };
  }
}

/** Comme `json`, pour un corps qui utilise `await` (fetch, service worker…). */
export function jsonAsync(corps) {
  const expr = `(async () => JSON.stringify(await (async () => { ${corps} })()))()`;
  const brut = ab('eval', expr);
  if (brut.startsWith('__ERREUR__')) return { erreur: brut };
  try {
    return JSON.parse(JSON.parse(brut));
  } catch {
    return { brut };
  }
}

/** Évalue une expression brute (pour les bouchons async). */
export function brut(expr) {
  return ab('eval', expr);
}

export const attente = (ms) => new Promise((r) => setTimeout(r, ms));

/* ------------------------------------------------------------------ rapport */

export function verifie(nom, condition, detail = '') {
  const passe = Boolean(condition);
  if (passe) ok += 1;
  else ko += 1;
  const ligne = `${passe ? 'OK  ' : 'ECHEC'} ${nom}${detail ? ` — ${detail}` : ''}`;
  LIGNES.push(ligne);
  console.log(ligne);
  return passe;
}

export function section(titre) {
  LIGNES.push('', `## ${titre}`);
  console.log(`\n── ${titre}`);
}

export function photo(nom) {
  ab('screenshot', join(SORTIE, `${nom}.png`));
}

export function rapport(url) {
  const entete = `# Parcours du site Accent — ${ok} vérifications OK, ${ko} en échec

- URL : ${url}
- Date : ${new Date().toISOString()}
- Navigateur : Chromium piloté par agent-browser sur Xvfb :99 (aucune fenêtre visible, aucun focus pris)
- Micro et synthèse vocale bouchonnés : ce parcours vérifie les écrans, les
  enchaînements et les garde-fous, pas la justesse d'une mesure réelle.
`;
  writeFileSync(join(SORTIE, 'RAPPORT.md'), `${entete}\n${LIGNES.join('\n')}\n`);
  console.log(`\n=== ${ok} OK, ${ko} ÉCHEC — rapport : ${join(SORTIE, 'RAPPORT.md')}`);
  return ko === 0;
}

/* ------------------------------------------------------------- interactions */

/**
 * Clique le premier bouton/lien dont le texte OU l'aria-label contient `motif`.
 *
 * Deux temps volontaires : on MARQUE l'élément en JS (sélection fiable par texte
 * ou aria-label), puis on clique avec `agent-browser click` — un clic **réel**,
 * donc avec activation utilisateur. Un `el.click()` dans un `eval` n'apporte
 * aucune activation : `AudioContext.resume()` reste alors suspendu, le micro
 * bouchonné ne produit rien et l'enregistrement ne démarre jamais (22 faux
 * échecs mesurés avant ce correctif). Le clic est précédé d'un
 * `scrollintoview` : en viewport mobile, un élément hors écran reçoit un clic
 * qui tombe à côté, et le pilote répond « Done » sans que React ne voie rien.
 */
export function clic(motif) {
  const rep = json(`
    const m = ${JSON.stringify(motif)};
    document.querySelectorAll('[data-e2e-clic]').forEach((x) => x.removeAttribute('data-e2e-clic'));
    const el = [...document.querySelectorAll('button, a, label, [role="button"]')]
      .find((x) => (x.textContent || '').includes(m) || (x.getAttribute('aria-label') || '').includes(m));
    if (!el) return { trouve: false };
    if (el.disabled) return { trouve: true, disabled: true };
    el.setAttribute('data-e2e-clic', '1');
    return { trouve: true, disabled: false };
  `);
  if (rep.trouve && !rep.disabled) {
    // Amener l'élément dans le viewport AVANT le clic : sur un téléphone simulé
    // (420×900), un clic sur un élément hors écran tombe à côté et React ne
    // reçoit rien, alors que le pilote répond « Done » (piège mesuré).
    ab('scrollintoview', '[data-e2e-clic]');
    ab('click', '[data-e2e-clic]');
  }
  return rep;
}

export function bouton(motif) {
  return json(`
    const m = ${JSON.stringify(motif)};
    const el = [...document.querySelectorAll('button, a, label, [role="button"]')]
      .find((x) => (x.textContent || '').includes(m) || (x.getAttribute('aria-label') || '').includes(m));
    return { existe: Boolean(el), disabled: el ? Boolean(el.disabled) : null };
  `);
}

/** Choisit une valeur dans un <select> et déclenche l'événement React. */
export function choisirSelect(id, valeur) {
  return json(`
    const el = document.getElementById(${JSON.stringify(id)});
    if (!el) return { ok: false };
    const set = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, 'value').set;
    set.call(el, ${JSON.stringify(valeur)});
    el.dispatchEvent(new Event('change', { bubbles: true }));
    return { ok: true };
  `);
}

export function page() {
  return json(`return { texte: document.body.innerText, titre: document.querySelector('h1') ? document.querySelector('h1').textContent : '' };`);
}

/** Garde-fou produit : aucun pourcentage, aucune moyenne, aucun score global. */
export function aucunScoreGlobal() {
  return json(`
    const t = document.body.innerText;
    return {
      pourcentage: /\\d+\\s*%/.test(t),
      moyenne: /moyenne/i.test(t),
      global: /score global|note globale/i.test(t) && !/jamais|aucun|pas de/i.test(t),
    };
  `);
}

/* -------------------------------------------------------------- bouchons UI */

export const BOUCHON_MICRO = `(async () => {
  // En contexte non sécurisé ou avant chargement, mediaDevices peut être absent.
  if (!navigator.mediaDevices) {
    Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: {} });
  }
  navigator.mediaDevices.getUserMedia = async () => {
    const ctx = new AudioContext();
    await ctx.resume();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    gain.gain.value = 0.4;
    const dest = ctx.createMediaStreamDestination();
    osc.connect(gain); gain.connect(dest); osc.start();
    return dest.stream;
  };
  return 'micro-bouchonne';
})()`;

/** jsdom/Chromium headless peut n'exposer aucune voix : on garantit l'API. */
export const BOUCHON_TTS = `(() => {
  if (!('speechSynthesis' in navigator) || !navigator.serviceWorker) { /* rien */ }
  if (!('speechSynthesis' in window)) {
    Object.defineProperty(window, 'speechSynthesis', {
      configurable: true,
      value: { speak: () => {}, cancel: () => {}, getVoices: () => [{ lang: 'en-US', name: 'test' }, { lang: 'fr-FR', name: 'test' }] },
    });
    window.SpeechSynthesisUtterance = function (t) { this.text = t; this.lang = ''; this.rate = 1; this.pitch = 1; this.volume = 1; };
  }
  return 'tts-disponible';
})()`;

export function reglages(langue, lectures = 3) {
  return json(`
    localStorage.setItem('accent.reglages.v1', JSON.stringify({
      urlProxy: '', cleAzure: '', regionAzure: 'westeurope',
      langueCible: ${JSON.stringify(langue)}, lectures: ${lectures}, consentementAffiche: true,
    }));
    return 'ok';
  `);
}

/** Attend que la page soit réellement rendue (jusqu'à ~12 s). */
export async function attendrePret() {
  for (let essai = 0; essai < 24; essai += 1) {
    const etat = json(`return {
      pret: document.readyState === 'complete' && Boolean(document.querySelector('#root') && document.querySelector('#root').children.length),
    };`);
    if (etat.pret) return true;
    await attente(500);
  }
  return false;
}

export async function ouvrir(url) {
  ab('open', url);
  await attendrePret();
  await attente(400);
  brut(BOUCHON_MICRO);
  brut(BOUCHON_TTS);
}

/**
 * Une lecture complète : enregistrer → terminer → valider.
 * `boutonDemarrer` diffère selon l'écran : « Enregistrer ma lecture » sur le
 * parcours classique, « Enregistrer cette phrase » en mode oral long.
 */
/**
 * @param avecApercu true sur le parcours classique (RF-02 : « écouter avant
 *   envoi »), false en mode oral long où le passage rapide analyse directement
 *   la prise — le contrôle qualité (durée, silence, saturation) garde la main.
 */
export async function uneLecture(secondes = 2.5, boutonDemarrer = 'Enregistrer ma lecture', avecApercu = true) {
  const a = clic(boutonDemarrer);
  if (!a.trouve) return { ok: false, etape: 'enregistrer' };
  await attente(secondes * 1000);
  const b = clic('Terminer');
  if (!b.trouve) return { ok: false, etape: 'terminer' };
  await attente(2000);
  if (avecApercu) {
    const c = clic('bon, analyser');
    if (!c.trouve) return { ok: false, etape: 'valider' };
    await attente(2000);
  }
  return { ok: true };
}

/** Trois lectures, puis le diagnostic. */
export async function troisLectures(secondes = 2.2, boutonDemarrer = 'Enregistrer ma lecture') {
  const etapes = [];
  for (let n = 0; n < 3; n += 1) {
    const r = await uneLecture(secondes, boutonDemarrer);
    etapes.push(r.ok ? 'ok' : `echec:${r.etape}`);
  }
  return etapes;
}
