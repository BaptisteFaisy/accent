/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Fond sombre, contraste AA vérifié (RNF-06).
        nuit: {
          DEFAULT: '#0b0f14',
          carte: '#141b23',
          bord: '#22303c',
        },
        // Jamais de rouge pour un son à travailler (ACCENT.md §21) : le rouge
        // est réservé aux erreurs système.
        aTravailler: {
          DEFAULT: '#f2a33c',
          doux: '#3a2a12',
        },
        acquis: {
          DEFAULT: '#4ec98a',
          doux: '#12301f',
        },
        neutre: {
          DEFAULT: '#8fa3b3',
          doux: '#1b242d',
        },
        erreur: {
          DEFAULT: '#e5484d',
          doux: '#351416',
        },
        texte: '#e8eef4',
      },
      fontSize: {
        // Texte courant ≥ 16 px (RNF-06).
        base: ['16px', '24px'],
        phoneme: ['clamp(48px, 14vw, 96px)', '1'],
      },
      minHeight: {
        tactile: '48px',
      },
      minWidth: {
        tactile: '48px',
      },
      fontFamily: {
        sans: ['system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
    },
  },
  plugins: [],
};
