import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import Waveform, { dureeSecondes, niveauVersAmplitude, peaks } from './waveform';

/** Signal de test : 1 seconde à 16 kHz, enveloppe en dents de scie. */
function signal(n = 16000): Float32Array {
  const out = new Float32Array(n);
  for (let i = 0; i < n; i += 1) out[i] = ((i % 1000) / 1000) * 0.8;
  return out;
}

describe('peaks — fonction pure', () => {
  it('rend exactement le nombre de barres demandé', () => {
    expect(peaks(signal(), 48)).toHaveLength(48);
    expect(peaks(signal(), 1)).toHaveLength(1);
  });

  it('valeurs bornées dans [0, 1]', () => {
    for (const v of peaks(signal(), 32)) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
    }
  });

  it('silence → toutes les barres à zéro', () => {
    expect(peaks(new Float32Array(8000), 16).every((v) => v === 0)).toBe(true);
  });

  it('signal vide → barres à zéro, aucune exception', () => {
    const p = peaks(new Float32Array(0), 8);
    expect(p).toHaveLength(8);
    expect(p.every((v) => v === 0)).toBe(true);
  });

  it('nombre de barres invalide ramené à 1', () => {
    expect(peaks(signal(), 0)).toHaveLength(1);
    expect(peaks(signal(), -5)).toHaveLength(1);
  });

  it('déterministe : deux appels donnent la même chose', () => {
    const s = signal(4000);
    expect(peaks(s, 20)).toEqual(peaks(s, 20));
  });

  it('suit l’enveloppe : un signal croissant donne des barres croissantes', () => {
    // Amplitude qui monte linéairement de 0.1 à 0.9 sur 8 000 échantillons.
    const n = 8000;
    const rampe = new Float32Array(n);
    for (let i = 0; i < n; i += 1) rampe[i] = 0.1 + (0.8 * i) / (n - 1);
    const p = peaks(rampe, 8);
    expect(p[7]).toBeGreaterThan(p[0]);
    expect(p[0]).toBeCloseTo(0.2, 2); // pic de la première barre (fin de rampe incluse)
    expect(p[7]).toBeCloseTo(0.9, 2);
  });
});

describe('niveauVersAmplitude', () => {
  it('RMS nul ou négatif → 0', () => {
    expect(niveauVersAmplitude(0)).toBe(0);
    expect(niveauVersAmplitude(-0.2)).toBe(0);
  });

  it('borné à 1 même sur un signal très fort', () => {
    expect(niveauVersAmplitude(10)).toBe(1);
  });

  it('NaN géré sans planter', () => {
    expect(niveauVersAmplitude(Number.NaN)).toBe(0);
  });
});

describe('dureeSecondes', () => {
  it('16 000 échantillons à 16 kHz = 1 s', () => {
    expect(dureeSecondes(new Float32Array(16000))).toBe(1);
  });

  it('arrondi à une décimale', () => {
    expect(dureeSecondes(new Float32Array(24800))).toBe(1.6);
  });

  it('signal vide ou taux nul → 0', () => {
    expect(dureeSecondes(new Float32Array(0))).toBe(0);
    expect(dureeSecondes(new Float32Array(100), 0)).toBe(0);
  });
});

describe('Waveform — rendu accessible', () => {
  it('dessine un SVG avec role="img" et un aria-label', () => {
    const { container } = render(<Waveform pcm={signal(8000)} barres={12} />);
    const svg = container.querySelector('svg');
    expect(svg).not.toBeNull();
    expect(svg?.getAttribute('role')).toBe('img');
    expect(svg?.getAttribute('aria-label')).toBeTruthy();
    expect(container.querySelectorAll('rect')).toHaveLength(12);
  });

  it('accepte un aria-label personnalisé (transcription textuelle, RNF-06)', () => {
    const { container } = render(<Waveform niveau={0.05} label="Niveau du micro en direct" />);
    expect(container.querySelector('svg')?.getAttribute('aria-label')).toBe(
      'Niveau du micro en direct',
    );
  });

  it('sans signal : ne plante pas et dessine quand même des barres', () => {
    const { container } = render(<Waveform barres={5} />);
    expect(container.querySelectorAll('rect')).toHaveLength(5);
  });

  it('moins de 3 barres demandées → plancher de 3', () => {
    const { container } = render(<Waveform pcm={signal(1000)} barres={1} />);
    expect(container.querySelectorAll('rect')).toHaveLength(3);
  });
});
