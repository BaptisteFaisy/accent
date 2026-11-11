#!/usr/bin/env node
/**
 * Serveur de démo Accent — r630, derrière un tunnel public HTTPS.
 *
 * Deux rôles, un seul processus (zéro dépendance, stdlib Node uniquement) :
 *  1. servir le build statique `dist/` (SPA, chemins relatifs) ;
 *  2. exposer `/api/*` : le proxy qui garde la clé d'évaluation hors du bundle.
 *
 * Sans `AZURE_SPEECH_KEY` dans l'environnement, `/api/analyse` répond
 * `proxy-sans-cle` et le navigateur bascule sur son moteur local de
 * démonstration (signalé « simulation » à l'écran) : la démo publique reste
 * utilisable sans aucune clé (RNF-09).
 *
 * Journal : horodatage, méthode, chemin, statut, durée, IP tronquée (RNF-P2).
 * Aucun audio, aucun texte d'élève n'est écrit ni conservé (RNF-P1).
 */
import { createServer } from 'node:http';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize, resolve } from 'node:path';
import {
  cleCache,
  creerQuota,
  encoderConfigAssessment,
  entetesCors,
  erreurJson,
  extrairePhonemes,
  ligneJournal,
  reponseSansProvider,
  urlAzure,
} from './lib.mjs';

const PORT = Number(process.env.PORT ?? 8820);
const RACINE = resolve(process.cwd());
const DIST = join(RACINE, 'dist');
const CLE_AZURE = process.env.AZURE_SPEECH_KEY ?? '';
const REGION = process.env.AZURE_SPEECH_REGION ?? 'westeurope';
const LANGUE = process.env.AZURE_LANGUE ?? 'en-US';
const ORIGINES = (process.env.ORIGINES_AUTORISEES ?? '*').split(',').map((s) => s.trim());
const QUOTA_JOUR = Number(process.env.QUOTA_PAR_IP_JOUR ?? 200);
const quota = creerQuota(QUOTA_JOUR);
const cache = new Map();

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.map': 'application/json',
};

function journaliser(req, statut, debut, ip) {
  console.log(ligneJournal({ methode: req.method, chemin: req.url.split('?')[0], statut, ms: performance.now() - debut, ip }));
}

function envoyer(res, req, statut, corps, entetes = {}, debut = performance.now(), ip = '') {
  res.writeHead(statut, { 'content-type': 'application/json; charset=utf-8', ...entetes });
  res.end(typeof corps === 'string' ? corps : JSON.stringify(corps));
  journaliser(req, statut, debut, ip);
}

function lireCorps(req, maxOctets = 4 * 1024 * 1024) {
  return new Promise((resolveBody, reject) => {
    const morceaux = [];
    let taille = 0;
    req.on('data', (c) => {
      taille += c.length;
      if (taille > maxOctets) {
        reject(new Error('corps trop volumineux'));
        req.destroy();
        return;
      }
      morceaux.push(c);
    });
    req.on('end', () => resolveBody(Buffer.concat(morceaux).toString('utf8')));
    req.on('error', reject);
  });
}

/** Appel réel à Azure Speech (pronunciation assessment, granularité phonème). */
async function appelerAzure(texte, audioBase64) {
  const res = await fetch(urlAzure(REGION, LANGUE), {
    method: 'POST',
    headers: {
      'Ocp-Apim-Subscription-Key': CLE_AZURE,
      'Content-Type': 'audio/wav; codecs=audio/pcm; samplerate=16000',
      Accept: 'application/json',
      'Pronunciation-Assessment': encoderConfigAssessment(texte),
      'User-Agent': 'accent-proxy/1.0',
    },
    body: Buffer.from(audioBase64, 'base64'),
  });
  if (!res.ok) throw new Error('Azure HTTP ' + res.status);
  return res.json();
}

async function apiAnalyse(req, res, cors, debut, ip) {
  const brut = await lireCorps(req);
  const { texte, audioBase64 } = JSON.parse(brut || '{}');
  if (!texte || !audioBase64) {
    envoyer(res, req, 400, erreurJson('requete-invalide', 'texte et audioBase64 requis'), cors, debut, ip);
    return;
  }
  const q = quota.consommer(ip);
  if (!q.ok) {
    envoyer(res, req, 429, erreurJson('quota', 'Quota quotidien atteint.', { byok: true, quota: q }), cors, debut, ip);
    return;
  }
  const cle = await cleCache(texte, audioBase64);
  if (cache.has(cle)) {
    envoyer(res, req, 200, { ...cache.get(cle), quota: q, cache: true }, cors, debut, ip);
    return;
  }
  if (!CLE_AZURE) {
    envoyer(res, req, 200, { ...reponseSansProvider(), quota: q }, cors, debut, ip);
    return;
  }
  const azure = await appelerAzure(texte, audioBase64);
  const corps = {
    scores: extrairePhonemes(azure, String(texte).toLowerCase().split(/[^a-z'’-]+/).filter(Boolean)),
    provider: 'azure',
    simule: false,
    dureeMs: 0,
    quota: q,
  };
  cache.set(cle, corps);
  if (cache.size > 500) cache.delete(cache.keys().next().value);
  envoyer(res, req, 200, corps, cors, debut, ip);
}

async function apiPhrases(req, res, url, cors, debut, ip) {
  const code = url.searchParams.get('code') ?? '';
  const chemin = join(RACINE, 'src', 'data', 'training.json');
  if (!existsSync(chemin)) {
    envoyer(res, req, 404, erreurJson('cache-absent', 'Cache de phrases absent du serveur.'), cors, debut, ip);
    return;
  }
  const data = JSON.parse(await readFile(chemin, 'utf8'));
  const brutes = data?.parCode?.[code] ?? [];
  const phrases = brutes.map((p) => ({ code, texte: p.texte, motCle: p.motCle }));
  envoyer(res, req, 200, { phrases }, cors, debut, ip);
}

function statique(req, res, url, debut, ip) {
  if (!existsSync(DIST)) {
    res.writeHead(503, { 'content-type': 'text/plain; charset=utf-8' });
    res.end('dist/ absent : lance `npm run build` (voir tools/deploy/deploy-r630.sh).');
    journaliser(req, 503, debut, ip);
    return;
  }
  const relatif = normalize(decodeURIComponent(url.pathname)).replace(/^(\.\.[/\\])+/, '');
  let fichier = join(DIST, relatif);
  if (!fichier.startsWith(DIST)) fichier = join(DIST, 'index.html');
  if (!existsSync(fichier) || statSync(fichier).isDirectory()) fichier = join(DIST, 'index.html');
  res.writeHead(200, { 'content-type': MIME[extname(fichier)] ?? 'application/octet-stream' });
  createReadStream(fichier).pipe(res);
  journaliser(req, 200, debut, ip);
}

const serveur = createServer((req, res) => {
  const debut = performance.now();
  const ip = (req.headers['cf-connecting-ip'] ?? req.socket.remoteAddress ?? '').toString();
  const url = new URL(req.url, 'http://localhost');
  const cors = entetesCors(req.headers.origin ?? '', ORIGINES);
  const corsUtiles = Object.fromEntries(Object.entries(cors).filter(([, v]) => v !== ''));

  if (req.method === 'OPTIONS') {
    res.writeHead(204, corsUtiles);
    res.end();
    journaliser(req, 204, debut, ip);
    return;
  }

  void (async () => {
    try {
      if (url.pathname === '/healthz') {
        envoyer(res, req, 200, { ok: true, provider: CLE_AZURE ? 'azure' : 'demo', quota: QUOTA_JOUR }, corsUtiles, debut, ip);
        return;
      }
      if (url.pathname === '/api/analyse' && req.method === 'POST') {
        await apiAnalyse(req, res, corsUtiles, debut, ip);
        return;
      }
      if (url.pathname === '/api/phrases' && req.method === 'GET') {
        await apiPhrases(req, res, url, corsUtiles, debut, ip);
        return;
      }
      if (url.pathname.startsWith('/api/')) {
        envoyer(res, req, 404, erreurJson('introuvable', 'Route API inconnue.'), corsUtiles, debut, ip);
        return;
      }
      statique(req, res, url, debut, ip);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'erreur interne';
      envoyer(res, req, message === 'corps trop volumineux' ? 413 : 500, erreurJson('erreur-serveur', message), corsUtiles, debut, ip);
    }
  })();
});

serveur.listen(PORT, () => {
  console.log(`Accent sur http://127.0.0.1:${PORT} — provider : ${CLE_AZURE ? 'azure' : 'demo (clé absente)'}`);
});
