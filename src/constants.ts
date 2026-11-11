/**
 * Seuils produit — ACCENT.md §17 et §18.4. Toute la logique de décision lit ces
 * constantes : aucun chiffre magique ailleurs dans le code.
 */

/** En dessous : le phonème est « à travailler ». */
export const SEUIL_A_TRAVAILLER = 60;

/** Au-dessus : acquis, exclu du profil pendant ACQUIS_COOLDOWN_JOURS. */
export const SEUIL_ACQUIS = 80;

/** Un phonème acquis reste hors du profil pendant 7 jours. */
export const ACQUIS_COOLDOWN_JOURS = 7;

/** Écart entre deux lectures au-delà duquel on refuse d'afficher un chiffre. */
export const ECART_MAX = 20;

/** Nombre de lectures pour conclure un score de référence (médiane). */
export const LECTURES_REFERENCE = 3;

/** Audio plus court : « trop court, réessaie » plutôt qu'un score faux. */
export const DUREE_MIN_MS = 1500;

/** Enregistrement borné à 15 s (RF-02). */
export const DUREE_MAX_MS = 15000;

/** Longueur maximale de la phrase saisie (RF-01). */
export const PHRASE_MAX_CAR = 200;

/** Budget de bout en bout : fin de lecture → diagnostic (RNF-01). */
export const BUDGET_PIPELINE_MS = 10000;

/** Échantillonnage attendu par les API d'évaluation. */
export const TAUX_ECHANTILLONNAGE = 16000;

/** Niveau RMS sous lequel l'audio est considéré comme du silence. */
export const RMS_SILENCE = 0.004;

/** Nombre de phrases d'entraînement générées pour la cible (RF-08). */
export const PHRASES_ENTRAINEMENT = 3;
