// @vitest-environment node
import { describe, expect, it } from 'vitest';
// Le projet n'embarque pas @types/node : même convention que
// tests/acceptation-statique.test.ts, on neutralise la résolution de module.
// @ts-ignore — module Node non typé dans ce projet
import { existsSync, readFileSync } from 'node:fs';
// @ts-ignore — module Node non typé dans ce projet
import { join } from 'node:path';

/**
 * PWA (RNF-08) : installable et utilisable hors ligne, sans Workbox ni plugin.
 * Ces tests vérifient le manifeste, la présence et la validité des icônes, et
 * surtout les TROIS règles du service worker : jamais d'audio en cache, jamais
 * d'interception de /api/, et aucun chemin qui puisse casser le réseau.
 */

const PUB = 'public';
const lire = (f: string) => readFileSync(join(PUB, f), 'utf8');

/** Largeur/hauteur d'un PNG lues dans l'en-tête IHDR (octets 16-24, big-endian). */
function taillePng(chemin: string): { largeur: number; hauteur: number } {
  const buf = readFileSync(chemin);
  expect(buf.subarray(1, 4).toString(), `${chemin} n'est pas un PNG`).toBe('PNG');
  return { largeur: buf.readUInt32BE(16), hauteur: buf.readUInt32BE(20) };
}

describe('manifest.webmanifest', () => {
  const m = JSON.parse(lire('manifest.webmanifest')) as Record<string, unknown> & {
    icons: Array<{ src: string; sizes: string; purpose: string }>;
  };

  it('JSON valide avec nom, description et mode standalone', () => {
    expect(m.name).toBeTruthy();
    expect(m.short_name).toBe('Accent');
    expect(m.display).toBe('standalone');
    expect(m.description).toBeTruthy();
  });

  it('GARDE-FOU Pages : start_url et scope RELATIFS (l’app vit sous /accent/)', () => {
    expect(m.start_url).toBe('./');
    expect(m.scope).toBe('./');
    expect(String(m.start_url).startsWith('/')).toBe(false);
  });

  it('couleurs alignées sur le thème sombre du produit', () => {
    expect(m.theme_color).toBe('#0b0f14');
    expect(m.background_color).toBe('#0b0f14');
  });

  it('déclare des icônes 192, 512 et une maskable', () => {
    const tailles = m.icons.map((i) => i.sizes);
    expect(tailles).toContain('192x192');
    expect(tailles).toContain('512x512');
    expect(m.icons.some((i) => i.purpose === 'maskable')).toBe(true);
    for (const icone of m.icons) expect(icone.src.startsWith('./'), icone.src).toBe(true);
  });
});

describe('icônes', () => {
  it('existent sur le disque et ont la taille annoncée', () => {
    for (const [f, attendu] of [
      ['icon-192.png', 192],
      ['icon-512.png', 512],
      ['icon-maskable-512.png', 512],
    ] as Array<[string, number]>) {
      const chemin = join(PUB, f);
      expect(existsSync(chemin), `${f} absent`).toBe(true);
      const { largeur, hauteur } = taillePng(chemin);
      expect(largeur, f).toBe(attendu);
      expect(hauteur, f).toBe(attendu);
    }
  });

  it('sont régénérables : le script de génération est versionné', () => {
    expect(existsSync('tools/gen-icon.py')).toBe(true);
    expect(readFileSync('tools/gen-icon.py', 'utf8')).toContain('#0b0f14');
  });
});

describe('service worker — les trois règles', () => {
  const sw = lire('sw.js');

  it('est versionné et purge les anciens caches à l’activation', () => {
    expect(sw).toMatch(/const VERSION = 'accent-v\d+'/);
    expect(sw).toContain("addEventListener('activate'");
    expect(sw).toMatch(/caches\.delete/);
  });

  it('RÈGLE 2 : n’intercepte jamais /api/', () => {
    expect(sw).toContain("url.pathname.startsWith('/api/')");
    // Le garde doit apparaître deux fois : dans interditDeCache et dans le fetch.
    expect(sw.split("startsWith('/api/')").length - 1).toBeGreaterThanOrEqual(2);
  });

  it('RÈGLE 1 : ne met jamais d’audio, de blob: ni de data: en cache', () => {
    expect(sw).toMatch(/audio\//);
    expect(sw).toContain("url.protocol === 'blob:'");
    expect(sw).toContain("url.protocol === 'data:'");
    expect(sw).toMatch(/interditDeCache\(request, reseau\)/);
  });

  it('RÈGLE 3 : les handlers sont protégés par try/catch', () => {
    const tryCount = sw.split('try {').length - 1;
    const catchCount = sw.split('catch').length - 1;
    expect(tryCount).toBeGreaterThanOrEqual(3);
    expect(catchCount).toBeGreaterThanOrEqual(tryCount);
  });

  it('navigation en réseau d’abord, repli cache (jamais de shell périmé imposé)', () => {
    expect(sw).toMatch(/request\.mode === 'navigate'/);
    expect(sw).toContain("cache.match('./index.html')");
  });

  it('assets hashés en cache d’abord, et seulement même origine', () => {
    expect(sw).toContain('CACHE_ASSETS');
    expect(sw).toMatch(/url\.origin !== self\.location\.origin/);
  });

  it('méthode non-GET ignorée (un POST ne se met jamais en cache)', () => {
    expect(sw).toMatch(/request\.method !== 'GET'/);
  });
});

describe('index.html — branchement PWA', () => {
  const html = readFileSync('index.html', 'utf8');

  it('référence le manifeste en chemin relatif', () => {
    expect(html).toContain('rel="manifest"');
    expect(html).toContain('href="./manifest.webmanifest"');
  });

  it('déclare icône, apple-touch-icon et titre installable', () => {
    expect(html).toContain('apple-touch-icon');
    expect(html).toContain('apple-mobile-web-app-title');
    expect(html).toContain('icon-192.png');
  });
});
