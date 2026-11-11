/**
 * Déclarations de server/lib.mjs pour le Worker (TypeScript).
 * La logique vit une seule fois, dans server/lib.mjs : ce fichier ne fait que
 * la typer pour le monde TS.
 */

export interface ScoreProxy {
  code: string | null;
  ipa: string;
  mot: string;
  indexMot: number;
  score: number;
  erreur?: string;
}

export interface EtatQuota {
  ok: boolean;
  reste: number;
  limite: number;
}

export interface Quota {
  limite: number;
  consommer(ip: string, maintenant?: Date): EtatQuota;
  reinitialiser(): void;
}

export function encoderConfigAssessment(referenceText: string): string;
export function urlAzure(region: string, langue?: string): string;
export function extrairePhonemes(reponse: unknown, mots?: string[]): ScoreProxy[];
export function empreinte(...parties: string[]): Promise<string>;
export function cleCache(texte: string, audioBase64: string): Promise<string>;
export function creerQuota(limite?: number): Quota;
export function ligneJournal(e: {
  methode: string;
  chemin: string;
  statut: number;
  ms: number;
  ip?: string;
}): string;
export function anonymiserIp(ip?: string): string;
export function entetesCors(origine: string, autorisees?: string[]): Record<string, string>;
export function erreurJson(code: string, message: string, extra?: Record<string, unknown>): string;
export function reponseSansProvider(): {
  scores: ScoreProxy[];
  provider: string;
  simule: boolean;
  dureeMs: number;
  message: string;
};
