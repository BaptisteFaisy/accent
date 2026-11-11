import type { EntreePhoneme } from '../types';

/**
 * Cas à part de la taxonomie (§17) : P14 « accent de mot » n'est pas un son
 * mais une PLACE. Quand c'est la cible, l'écran montre des barres de syllabes
 * au lieu d'une paire minimale.
 */

export type Accentuation = NonNullable<EntreePhoneme['accentuation']>;

export interface Props {
  mots: Accentuation;
}

export default function BarresSyllabes({ mots }: Props) {
  return (
    <div className="flex flex-col gap-4" role="group" aria-label="Place de l’accent dans le mot">
      {mots.map((m) => {
        const label = `« ${m.mot} » : accent sur la syllabe ${m.syllabes[m.accent]}`;
        return (
          <div key={m.mot} className="flex flex-col items-center gap-2">
            <div className="flex items-end gap-2" aria-hidden="true">
              {m.syllabes.map((syl, i) => {
                const fort = i === m.accent;
                return (
                  <span
                    key={syl + i}
                    className={`flex w-16 items-end justify-center rounded-t-lg pb-1 text-sm font-semibold transition-all ${
                      fort
                        ? 'h-16 bg-aTravailler text-nuit'
                        : 'h-9 bg-neutre-doux text-neutre'
                    }`}
                  >
                    {syl}
                  </span>
                );
              })}
            </div>
            <p className="text-sm text-neutre" lang="en">{label}</p>
          </div>
        );
      })}
      <p className="text-center text-sm text-neutre">
        La syllabe accentuée est plus longue, plus haute, plus forte. Les autres
        se réduisent — souvent à un schwa.
      </p>
    </div>
  );
}
