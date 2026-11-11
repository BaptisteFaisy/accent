// @vitest-environment node
// Le projet n'embarque pas @types/node (tsconfig « types » : vite/client seul).
// Ce fichier est le SEUL à utiliser les API Node : on neutralise donc l'erreur
// de résolution de module, sans toucher au tsconfig ni au package.json.
// @ts-ignore — module Node non typé dans ce projet
import { readdirSync, readFileSync, statSync } from 'node:fs';
// @ts-ignore — module Node non typé dans ce projet
import { join, relative } from 'node:path';
// @ts-ignore — module Node non typé dans ce projet
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * §25-8 — « Aucun score global nulle part dans l'UI (vérification par grep dans
 * le code) ». Garde statique : on relit réellement les fichiers de src/ avec
 * node:fs (d'où l'environnement Node pur) et on interdit les identifiants qui
 * trahiraient une note globale, principe fondateur du produit (§10, garde-fou 1).
 */

const RACINE_SRC = fileURLToPath(new URL('../src/', import.meta.url));

const INTERDITS = ['scoreGlobal', 'globalScore', 'noteGlobale', 'overallScore', 'moyenneGlobale'] as const;

function fichiersSous(dossier: string): string[] {
  const out: string[] = [];
  for (const nom of readdirSync(dossier).sort()) {
    const chemin = join(dossier, nom);
    if (statSync(chemin).isDirectory()) out.push(...fichiersSous(chemin));
    else out.push(chemin);
  }
  return out;
}

describe('§25-8 — aucun score global dans le code', () => {
  const fichiers = fichiersSous(RACINE_SRC);
  const relatifs = fichiers.map((f) => relative(RACINE_SRC, f));
  const liste = `Fichiers parcourus (${relatifs.length}) :\n- ${relatifs.join('\n- ')}`;

  it('§25-8 : la garde parcours bien tout src/', () => {
    // Une garde qui ne parcourt rien passerait en silence : on vérifie le périmètre.
    expect(fichiers.length, liste).toBeGreaterThan(20);
    expect(relatifs, liste).toContain(join('types.ts'));
    expect(relatifs, liste).toContain(join('engine', 'pipeline.ts'));
    expect(relatifs, liste).toContain(join('screens', 'Diagnostic.tsx'));
  });

  it('§25-8 : aucun identifiant de score global dans src/', () => {
    const coupables: string[] = [];
    for (const f of fichiers) {
      const contenu = readFileSync(f, 'utf8');
      for (const interdit of INTERDITS) {
        if (new RegExp(`\\b${interdit}\\b`, 'i').test(contenu)) {
          coupables.push(`${relative(RACINE_SRC, f)} → ${interdit}`);
        }
      }
    }
    // En cas d'échec, le message affiche la liste des fichiers parcourus.
    expect(coupables, `${liste}\n\nIdentifiants interdits trouvés :\n- ${coupables.join('\n- ')}`).toEqual([]);
  });

  it('§25-8 : la garde détecte vraiment un score global (auto-test de la garde)', () => {
    const piege = 'const scoreGlobal = 78; export default scoreGlobal;';
    const detecte = INTERDITS.some((interdit) => new RegExp(`\\b${interdit}\\b`, 'i').test(piege));
    expect(detecte).toBe(true);
  });
});
