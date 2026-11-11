/**
 * Paire minimale mise en scène — ACCENT.md §5 : « think → sink ».
 *
 * Le mot cible et le mot confondu sont montrés côte à côte, avec la lettre qui
 * trahit l'erreur mise en évidence. Aucun appel modèle : tout vient de la table
 * des 15 phonèmes (étape 4 du pipeline, §18.2).
 */

export interface Props {
  /** [mot attendu, mot entendu]. */
  paire: [string, string];
  /** Lettres/groupe à surligner, ex. « th » pour think/sink. */
  indice?: string;
  cible?: string;
}

/** Découpe un mot en segments : ceux qui matchent `indice` sont surlignés. */
function segments(mot: string, indice?: string): Array<{ t: string; fort: boolean }> {
  if (!indice) return [{ t: mot, fort: false }];
  const bas = mot.toLowerCase();
  const i = bas.indexOf(indice.toLowerCase());
  if (i < 0) return [{ t: mot, fort: false }];
  return [
    { t: mot.slice(0, i), fort: false },
    { t: mot.slice(i, i + indice.length), fort: true },
    { t: mot.slice(i + indice.length), fort: false },
  ].filter((s) => s.t.length > 0);
}

function Mot({ mot, indice, tone }: { mot: string; indice?: string; tone: 'cible' | 'entendu' }) {
  return (
    <span className="flex flex-col items-center gap-1">
      <span
        lang="en"
        className={`text-2xl font-semibold sm:text-3xl ${
          tone === 'cible' ? 'text-acquis' : 'text-aTravailler'
        }`}
      >
        {segments(mot, indice).map((s, i) =>
          s.fort ? (
            <mark key={i} className="rounded bg-transparent underline decoration-2 underline-offset-4">
              {s.t}
            </mark>
          ) : (
            <span key={i}>{s.t}</span>
          ),
        )}
      </span>
      <span className="text-xs uppercase tracking-wide text-neutre">
        {tone === 'cible' ? 'à dire' : 'entendu'}
      </span>
    </span>
  );
}

export default function PaireMinimale({ paire, indice, cible }: Props) {
  const attendu = cible && cible.toLowerCase() === paire[1].toLowerCase() ? paire[1] : paire[0];
  const entendu = attendu === paire[0] ? paire[1] : paire[0];
  return (
    <div
      className="flex items-center justify-center gap-4 rounded-2xl border border-nuit-bord bg-nuit px-5 py-4 sm:gap-8"
      role="group"
      aria-label={`Paire minimale : ${attendu} ne doit pas devenir ${entendu}`}
    >
      <Mot mot={attendu} indice={indice} tone="cible" />
      <span className="text-2xl text-neutre" aria-hidden="true">≠</span>
      <Mot mot={entendu} tone="entendu" />
    </div>
  );
}
