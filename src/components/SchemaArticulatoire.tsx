import type { Articulation, Lieu } from '../data/articulation';
import { articulationPour } from '../data/articulation';
import type { CodePhoneme } from '../types';

/**
 * Coupe sagittale de la tête, dessinée à partir des paramètres articulatoires.
 *
 * Un seul dessin pour 24 phonèmes : la géométrie est calculée depuis
 * `src/data/articulation.ts`. Ajouter une paire de langues n'ajoute donc que des
 * lignes de données, jamais de SVG (zéro duplication).
 *
 * Accessible : `role="img"` + `aria-label` rédigé, `<title>` dans le SVG, et une
 * légende textuelle sous le dessin — le schéma n'est jamais la seule information.
 */

const BLEU = '#8ecae6';

export interface Props {
  code: CodePhoneme;
  /** Hauteur rendue en px (largeur 100 %). */
  hauteur?: number;
  className?: string;
}

/** Position de la pointe de la langue : 0 = basse/arrière, 1 = haute/avant. */
function pointe(a: Articulation): { x: number; y: number } {
  return { x: 74 - a.pointeLangue * 42, y: 76 - a.pointeLangue * 27 };
}

function cheminLangue(a: Articulation): string {
  const p = pointe(a);
  const creux = 78 - a.dosLangue * 26;
  return `M 78 74 Q ${(p.x + 78) / 2} ${creux} ${p.x} ${p.y} L ${p.x + 6} ${p.y + 7} Q 66 82 78 80 Z`;
}

function ecartLevres(a: Articulation): number {
  switch (a.levres) {
    case 'serrees': return 0;
    case 'dents-levre': return 1;
    case 'arrondies':
    case 'projetees': return 4;
    case 'etirees': return 6;
    default: return 9;
  }
}

function Levres({ a }: { a: Articulation }) {
  const e = ecartLevres(a);
  const avance = a.levres === 'arrondies' || a.levres === 'projetees' ? -6 : 0;
  const x = 24 + avance;
  return (
    <g stroke="currentColor" strokeWidth={2} strokeLinecap="round" fill="none">
      <path d={`M ${x} ${46 - e / 2} q -7 ${e / 2} 0 ${e / 2 + 1}`} />
      <path d={`M ${x} ${54 + e / 2} q -7 ${-e / 2} 0 ${-e / 2 - 1}`} />
      {a.levres === 'dents-levre' && (
        <path d={`M ${x + 1} 50 l 5 4`} stroke={BLEU} strokeWidth={2.5} />
      )}
    </g>
  );
}

function Voile({ a }: { a: Articulation }) {
  // Voile abaissé (nasal) : un jour apparaît entre le voile et la paroi.
  const y = a.nasal ? 56 : 44;
  return (
    <g>
      <path
        d={`M 62 42 Q 72 ${y} 84 ${a.nasal ? 52 : 44}`}
        stroke="currentColor"
        strokeWidth={2}
        fill="none"
        strokeLinecap="round"
      />
      {a.nasal && (
        <>
          <path d="M 84 48 q 4 -14 -6 -20" stroke={BLEU} strokeWidth={1.5} fill="none" strokeDasharray="3 2" />
          <text x="88" y="26" fontSize="6" fill={BLEU}>nez</text>
        </>
      )}
    </g>
  );
}

/** Repère du lieu de constriction : c'est là que l'élève doit sentir l'effort. */
function zoneActive(a: Articulation): { x: number; y: number; label: Lieu } {
  const p = pointe(a);
  switch (a.lieu) {
    case 'levres': return { x: 26, y: 50, label: a.lieu };
    case 'dents': return { x: 34, y: 48, label: a.lieu };
    case 'alveoles': return { x: 44, y: 42, label: a.lieu };
    case 'palais': return { x: p.x, y: p.y, label: a.lieu };
    case 'voile': return { x: 74, y: a.dosLangue > 0.8 ? 46 : 54, label: a.lieu };
    default: return { x: 70, y: 86, label: a.lieu };
  }
}

function Marqueurs({ a }: { a: Articulation }) {
  return (
    <g>
      {a.voise && (
        <g stroke={BLEU} strokeWidth={1.4} fill="none">
          <path d="M 66 90 q 3 -3 6 0" />
          <path d="M 63 94 q 6 -6 12 0" />
        </g>
      )}
      {a.souffle && (
        <g stroke={BLEU} strokeWidth={1.2} strokeDasharray="2 2" fill="none">
          <path d="M 40 50 l -14 0" />
          <path d="M 40 55 l -18 0" />
        </g>
      )}
    </g>
  );
}

export default function SchemaArticulatoire({ code, hauteur = 150, className = '' }: Props) {
  const a = articulationPour(code);
  if (!a) return null;
  const zone = zoneActive(a);
  const label = `Coupe sagittale pour le son /${code}/ : ${a.legende}`;

  return (
    <figure className={`flex flex-col items-center gap-2 ${className}`}>
      <svg
        viewBox="0 0 120 100"
        width="100%"
        height={hauteur}
        role="img"
        aria-label={label}
        className="max-w-[280px] text-neutre"
        focusable="false"
      >
        <title>{label}</title>
        {/* Profil : front, nez, menton, nuque */}
        <path
          d="M 96 8 Q 40 4 26 30 L 20 40 L 26 44 L 22 58 Q 26 72 40 76 L 46 92 L 96 92 Z"
          fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinejoin="round"
        />
        {/* Palais dur + dents */}
        <path d="M 32 46 Q 46 36 62 42" fill="none" stroke="currentColor" strokeWidth={2} />
        <path d="M 32 46 l 2 8" stroke="currentColor" strokeWidth={2} />
        <path d="M 34 66 l 2 -8" stroke="currentColor" strokeWidth={2} />
        <Voile a={a} />
        {/* Langue */}
        <path d={cheminLangue(a)} fill="currentColor" opacity={0.55} />
        <Levres a={a} />
        <Marqueurs a={a} />
        {/* Zone active */}
        <circle cx={zone.x} cy={zone.y} r={5.5} fill="none" stroke={BLEU} strokeWidth={2} />
        <circle cx={zone.x} cy={zone.y} r={1.8} fill={BLEU} />
      </svg>
      <figcaption className="text-center text-sm text-neutre">
        {a.legende}
        {a.voise && <span className="ml-1 text-[#8ecae6]">· cordes vocales en vibration</span>}
        {a.nasal && <span className="ml-1 text-[#8ecae6]">· air par le nez</span>}
      </figcaption>
    </figure>
  );
}
