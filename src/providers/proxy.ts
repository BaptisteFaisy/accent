import type {
  AnalyseEntree,
  AnalyseSortie,
  CodePhoneme,
  FournisseurPrononciation,
  PhraseEntrainement,
  ScorePhoneme,
} from '../types';
import { phrasesPour } from '../data/training';

/**
 * Fournisseur « proxy » : le seul chemin par défaut du produit.
 *
 * La clé API ne vit JAMAIS dans le bundle (ACCENT.md §18.1) : le navigateur
 * parle à notre worker edge, qui ajoute la clé, borne le quota et met en cache.
 * Le contrat HTTP est volontairement minuscule (voir worker/README.md).
 */

export interface OptionsProxy {
  /** Base du worker, ex. https://accent-proxy.<compte>.workers.dev */
  url: string;
  /** Jeton court éventuel (limité par origine, pas une clé de fournisseur). */
  jeton?: string;
  delaiMs?: number;
}

interface ReponseAnalyse {
  scores: ScorePhoneme[];
  provider?: string;
  simule?: boolean;
  dureeMs?: number;
  quota?: { reste: number; limite: number };
}

function base64Depuis(buf: ArrayBuffer): string {
  const octets = new Uint8Array(buf);
  let binaire = '';
  for (let i = 0; i < octets.length; i += 1) binaire += String.fromCharCode(octets[i]);
  return btoa(binaire);
}

async function audioEnBase64(entree: AnalyseEntree): Promise<string> {
  if (entree.audio instanceof ArrayBuffer) return base64Depuis(entree.audio);
  return base64Depuis(await entree.audio.arrayBuffer());
}

export function fournisseurProxy(opts: OptionsProxy): FournisseurPrononciation {
  const url = opts.url.replace(/\/$/, '');
  const enTetes = (signal?: AbortSignal): HeadersInit => {
    void signal;
    const h: Record<string, string> = { 'content-type': 'application/json' };
    if (opts.jeton) h['x-accent-jeton'] = opts.jeton;
    return h;
  };

  return {
    id: 'proxy',
    label: 'Proxy Accent (clé cachée, quota borné)',

    async analyse(entree: AnalyseEntree, signal?: AbortSignal): Promise<AnalyseSortie> {
      const corps = JSON.stringify({
        texte: entree.texte,
        langueCible: entree.langueCible,
        audioBase64: await audioEnBase64(entree),
      });
      const res = await fetch(`${url}/api/analyse`, {
        method: 'POST',
        headers: enTetes(signal),
        body: corps,
        signal,
      });
      if (res.status === 429) {
        throw new Error(
          'Quota du proxy épuisé pour aujourd’hui. Colle ta clé personnelle dans Réglages (mode BYOK).',
        );
      }
      if (!res.ok) throw new Error(`Proxy : HTTP ${res.status}`);
      const data = (await res.json()) as ReponseAnalyse;
      return {
        scores: data.scores ?? [],
        dureeMs: data.dureeMs ?? 0,
        provider: data.provider ?? 'proxy',
        simule: data.simule === true,
        brut: data.quota,
      };
    },

    async phrases(code: CodePhoneme, langueCible): Promise<PhraseEntrainement[]> {
      // Hors ligne d'abord : le cache commité suffit (ACCENT.md §18.2, étape 5).
      const local = phrasesPour(code, langueCible);
      if (local.length >= 3) return local;
      try {
        const res = await fetch(`${url}/api/phrases?code=${code}&langue=${langueCible}`);
        if (!res.ok) return local;
        const data = (await res.json()) as { phrases?: PhraseEntrainement[] };
        return data.phrases?.length ? data.phrases : local;
      } catch {
        return local;
      }
    },
  };
}
