/**
 * Logique PURE du proxy Accent — partagée par le serveur Node de démo
 * (server/serve.mjs) et par le Worker Cloudflare (worker/index.ts).
 *
 * Un seul exemplaire de chaque règle : quota, cache, journal, traduction de la
 * réponse Azure. Rien ici ne dépend de Node ni de Workers (Web Crypto seulement),
 * et aucune fonction ne reçoit ni ne renvoie l'audio brut au journal.
 *
 * RNF-P2 : le journal ne contient QUE horodatage, méthode, chemin, statut et
 * durée. Jamais l'audio, jamais le texte de l'élève.
 */

/** Construit l'en-tête `Pronunciation-Assessment` d'Azure (JSON base64). */
export function encoderConfigAssessment(referenceText) {
  const cfg = {
    ReferenceText: referenceText,
    GradingSystem: 'HundredMark',
    Granularity: 'Phoneme',
    Dimension: 'Comprehensive',
    EnableMiscue: true,
    // L'intonation et l'écoulement sont hors périmètre (ACCENT.md §15.3).
    EnableProsodyAssessment: false,
  };
  return btoa(JSON.stringify(cfg));
}

/** URL REST « short audio » de Speech-to-text. */
export function urlAzure(region, langue = 'en-US') {
  const chemin =
    '/speech/recognition/conversation/cognitiveservices/v1?language=' + encodeURIComponent(langue);
  return 'https://' + region + '.stt.speech.microsoft.com' + chemin;
}

/**
 * Traduit la réponse Azure en scores par phonème.
 *
 * Le champ `code` reste null : la taxonomie des 15 phonèmes vit côté client
 * (src/data/phonemes.ts) — une seule source de vérité, et le proxy n'a pas à
 * connaître la pédagogie.
 *
 * On ne lit VOLONTAIREMENT PAS `NBest[0].PronunciationAssessment.*` : ce sont
 * les scores globaux, et le produit n'en affiche aucun (garde-fou §10).
 */
export function extrairePhonemes(reponse, mots) {
  const liste = mots ?? [];
  const words = reponse?.NBest?.[0]?.Words ?? [];
  const out = [];
  words.forEach((w, indexMot) => {
    const mot = String(w?.Word ?? liste[indexMot] ?? '').toLowerCase();
    for (const p of w?.Phonemes ?? []) {
      out.push({
        code: null,
        ipa: String(p?.Phoneme ?? ''),
        mot,
        indexMot,
        score: Math.round(Number(p?.AccuracyScore ?? 0)),
        // ErrorType renseigne la nature du raté ; on ne la renvoie au client que
        // sous forme de signal binaire, jamais le texte lu par l'élève.
        erreur: p?.ErrorType && p.ErrorType !== 'None' ? p.ErrorType : undefined,
      });
    }
  });
  return out;
}

/** Empreinte SHA-256 (Web Crypto : Node 22 et Workers). */
export async function empreinte(...parties) {
  const texte = parties.join('|');
  const donnees = new TextEncoder().encode(texte);
  const digest = await crypto.subtle.digest('SHA-256', donnees);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/** Clé de cache : même texte + même audio = même réponse, sans rappel d'API. */
export function cleCache(texte, audioBase64) {
  return empreinte('v1', texte ?? '', audioBase64 ?? '');
}

/**
 * Quota par IP et par jour, en mémoire (Worker : à adosser à KV en production).
 * `limite` = nombre d'analyses par IP et par jour.
 */
export function creerQuota(limite = 200) {
  const compteurs = new Map();
  return {
    limite,
    /** @returns {{ok: boolean, reste: number, limite: number}} */
    consommer(ip, maintenant = new Date()) {
      const jour = maintenant.toISOString().slice(0, 10);
      const cle = jour + '|' + (ip || 'inconnue');
      const n = (compteurs.get(cle) ?? 0) + 1;
      compteurs.set(cle, n);
      if (compteurs.size > 5000) compteurs.clear(); // garde-mémoire
      const reste = Math.max(0, limite - n);
      return { ok: n <= limite, reste, limite };
    },
    reinitialiser() {
      compteurs.clear();
    },
  };
}

/** RNF-P2 : aucune donnée élève dans le journal. */
export function ligneJournal({ methode, chemin, statut, ms, ip }) {
  return JSON.stringify({
    t: new Date().toISOString(),
    m: methode,
    p: chemin,
    s: statut,
    ms: Math.round(ms),
    ip: anonymiserIp(ip),
  });
}

/** Dernier groupe supprimé (IPv4) ou préfixe /48 (IPv6). */
export function anonymiserIp(ip) {
  if (!ip) return '-';
  if (ip.includes(':')) return ip.split(':').slice(0, 3).join(':') + '::';
  const parts = ip.split('.');
  return parts.length === 4 ? parts.slice(0, 3).join('.') + '.0' : '-';
}

/** CORS strict : seules les origines de démo déclarées sont autorisées. */
export function entetesCors(origine, autorisees = []) {
  const ok = autorisees.includes(origine) || autorisees.includes('*');
  return {
    'access-control-allow-origin': ok ? origine : '',
    'access-control-allow-methods': 'POST, GET, OPTIONS',
    'access-control-allow-headers': 'content-type, x-accent-jeton',
    'access-control-max-age': '600',
    vary: 'Origin',
  };
}

/** Corps normalisé des erreurs, lisible par l'UI (RNF-09 : message clair). */
export function erreurJson(code, message, extra = {}) {
  return JSON.stringify({ erreur: code, message, ...extra });
}

/** Le proxy n'a pas de clé : le client basculera sur son moteur local. */
export function reponseSansProvider() {
  return {
    scores: [],
    provider: 'proxy-sans-cle',
    simule: true,
    dureeMs: 0,
    message: 'Aucune clé d’évaluation configurée sur ce proxy.',
  };
}
