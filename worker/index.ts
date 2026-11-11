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
} from '../server/lib.mjs';

/**
 * Proxy edge Cloudflare Worker — ACCENT.md §18.1 et §18.2.
 *
 * Rôle : garder la clé d'évaluation hors du bundle navigateur, borner le quota
 * gratuit, mettre en cache les réponses identiques, et ne JAMAIS journaliser
 * l'audio ni le texte de l'élève (RNF-P2 : horodatage, méthode, chemin, statut,
 * durée, IP tronquée).
 *
 * Sans clé configurée, il répond `proxy-sans-cle` : le navigateur bascule alors
 * sur son moteur local de démonstration, clairement signalé « simulation ».
 */

export interface Env {
  AZURE_SPEECH_KEY?: string;
  AZURE_SPEECH_REGION?: string;
  AZURE_LANGUE?: string;
  QUOTA_PAR_IP_JOUR?: string;
  ORIGINES_AUTORISEES?: string;
}

interface CorpsAnalyse {
  texte?: string;
  langueCible?: string;
  audioBase64?: string;
}

/** Cache edge de Workers (`caches.default`, absent des types DOM). */
function cacheEdge(): Cache {
  return (caches as unknown as { default: Cache }).default;
}

// Le quota vit en mémoire d'isolate : suffisant pour une démo de hackathon.
// En production, adosser à un KV (voir worker/README.md).
const quota = creerQuota(200);

function journal(req: Request, statut: number, debut: number, ip: string): void {
  const url = new URL(req.url);
  console.log(ligneJournal({ methode: req.method, chemin: url.pathname, statut, ms: performance.now() - debut, ip }));
}

function json(statut: number, corps: unknown, cors: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(corps), {
    status: statut,
    headers: { 'content-type': 'application/json; charset=utf-8', ...cors },
  });
}

function origineDouteuse(req: Request, env: Env): Record<string, string> {
  const autorisees = (env.ORIGINES_AUTORISEES ?? '*').split(',').map((s) => s.trim());
  const brut = entetesCors(req.headers.get('origin') ?? '', autorisees);
  return Object.fromEntries(Object.entries(brut).filter(([, v]) => v !== ''));
}

function ipDe(req: Request): string {
  return req.headers.get('cf-connecting-ip') ?? '';
}

async function appelerAzure(env: Env, texte: string, audioBase64: string): Promise<unknown> {
  const region = env.AZURE_SPEECH_REGION ?? 'westeurope';
  const langue = env.AZURE_LANGUE ?? 'en-US';
  const res = await fetch(urlAzure(region, langue), {
    method: 'POST',
    headers: {
      'Ocp-Apim-Subscription-Key': env.AZURE_SPEECH_KEY ?? '',
      'Content-Type': 'audio/wav; codecs=audio/pcm; samplerate=16000',
      Accept: 'application/json',
      'Pronunciation-Assessment': encoderConfigAssessment(texte),
      'User-Agent': 'accent-worker/1.0',
    },
    body: Uint8Array.from(atob(audioBase64), (c) => c.charCodeAt(0)),
  });
  if (!res.ok) throw new Error('Azure HTTP ' + res.status);
  return res.json();
}

async function analyser(req: Request, env: Env, cors: Record<string, string>): Promise<Response> {
  const corps = (await req.json().catch(() => ({}))) as CorpsAnalyse;
  const texte = corps.texte ?? '';
  const audioBase64 = corps.audioBase64 ?? '';
  if (!texte || !audioBase64) {
    return json(400, JSON.parse(erreurJson('requete-invalide', 'texte et audioBase64 requis')), cors);
  }

  const etat = quota.consommer(ipDe(req));
  if (!etat.ok) {
    return json(
      429,
      JSON.parse(erreurJson('quota', 'Quota quotidien atteint.', { byok: true, quota: etat })),
      cors,
    );
  }

  const cle = await cleCache(texte, audioBase64);
  const dejaVu = await cacheEdge().match(new Request('https://cache.accent/' + cle));
  if (dejaVu) {
    const corpsCache = (await dejaVu.json()) as Record<string, unknown>;
    return json(200, { ...corpsCache, quota: etat, cache: true }, cors);
  }

  if (!env.AZURE_SPEECH_KEY) {
    return json(200, { ...reponseSansProvider(), quota: etat }, cors);
  }

  const azure = await appelerAzure(env, texte, audioBase64);
  const mots = texte.toLowerCase().split(/[^a-z'’-]+/).filter(Boolean);
  const corpsReponse = {
    scores: extrairePhonemes(azure, mots),
    provider: 'azure',
    simule: false,
    dureeMs: 0,
    quota: etat,
  };
  mettreEnCache(cle, corpsReponse);
  return json(200, corpsReponse, cors);
}

/** Écrit la réponse dans le cache edge (best effort). */
function mettreEnCache(cle: string, corps: unknown): void {
  const reponse = new Response(JSON.stringify(corps), {
    headers: { 'content-type': 'application/json' },
  });
  void cacheEdge().put(new Request('https://cache.accent/' + cle), reponse);
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const debut = performance.now();
    const ip = ipDe(req);
    const url = new URL(req.url);
    const cors = origineDouteuse(req, env);

    if (req.method === 'OPTIONS') {
      journal(req, 204, debut, ip);
      return new Response(null, { status: 204, headers: cors });
    }

    try {
      if (url.pathname === '/healthz') {
        const statut = 200;
        journal(req, statut, debut, ip);
        return json(
          statut,
          { ok: true, provider: env.AZURE_SPEECH_KEY ? 'azure' : 'demo' },
          cors,
        );
      }
      if (url.pathname === '/api/analyse' && req.method === 'POST') {
        const res = await analyser(req, env, cors);
        journal(req, res.status, debut, ip);
        return res;
      }
      if (url.pathname.startsWith('/api/')) {
        journal(req, 404, debut, ip);
        return json(404, JSON.parse(erreurJson('introuvable', 'Route API inconnue.')), cors);
      }
      journal(req, 404, debut, ip);
      return json(
        404,
        JSON.parse(
          erreurJson(
            'statique-ailleurs',
            'Ce worker ne sert que /api et /healthz. Le front est sur Cloudflare Pages (voir worker/README.md).',
          ),
        ),
        cors,
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : 'erreur interne';
      journal(req, 500, debut, ip);
      return json(500, JSON.parse(erreurJson('erreur-serveur', message)), cors);
    }
  },
};
