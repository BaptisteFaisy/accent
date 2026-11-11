import type { CodePhoneme, EntreePhoneme, LangueCible } from '../types';

/**
 * Taxonomie fermée des 15 phonèmes — ACCENT.md §17.
 *
 * Décision structurante : cette table est de la DONNÉE, codée en dur, versionnée
 * et testée. L'étape 4 du pipeline (« Explique ») ne doit jamais appeler de
 * modèle : la connaissance pédagogique vit ici, ce qui rend le diagnostic
 * instantané, gratuit, hors ligne et défendable.
 */
export const PHONEMES: Readonly<Record<CodePhoneme, EntreePhoneme>> = {
  P01: {
    code: 'P01',
    ipa: 'θ',
    label: 'le « th » soufflé de think',
    langueCible: 'en',
    signature: 'sort en /s/ ou /f/ : le son n’existe pas en français',
    produitComme: ['s', 'f'],
    pairesMinimales: [['think', 'sink'], ['three', 'free'], ['mouth', 'mouse']],
    motsExemples: ['think', 'three', 'thing', 'mouth', 'bath'],
    difficulte: 3,
    nature: 'phonetique',
    conseil:
      'Pose la pointe de la langue entre les dents et souffle. Ce n’est pas un « s », c’est un filet d’air.',
  },
  P02: {
    code: 'P02',
    ipa: 'ð',
    label: 'le « th » vibré de this',
    langueCible: 'en',
    signature: 'sort en /z/ ou /d/',
    produitComme: ['z', 'd'],
    pairesMinimales: [['this', 'zis'], ['they', 'day'], ['breathe', 'breeze']],
    motsExemples: ['this', 'that', 'they', 'mother', 'breathe'],
    difficulte: 3,
    nature: 'phonetique',
    conseil:
      'Même place que pour /θ/, mais la gorge vibre. La langue touche à peine les dents.',
  },
  P03: {
    code: 'P03',
    ipa: 'h',
    label: 'le « h » aspiré',
    langueCible: 'en',
    signature: 'muet : le h ne se prononce pas en français',
    produitComme: [],
    pairesMinimales: [['happy', 'appy'], ['house', 'ouse'], ['heat', 'eat']],
    motsExemples: ['happy', 'house', 'hand', 'behind', 'hello'],
    difficulte: 2,
    nature: 'phonetique',
    conseil: 'Souffle avant la voyelle, comme sur des lunettes à nettoyer. Rien ne vibre.',
  },
  P04: {
    code: 'P04',
    ipa: 'ɪ',
    label: 'le « i » court de ship',
    langueCible: 'en',
    signature: 'les deux sortent en /i/ français, sans différence de longueur',
    produitComme: ['i'],
    pairesMinimales: [['ship', 'sheep'], ['live', 'leave'], ['fill', 'feel']],
    motsExemples: ['ship', 'it', 'big', 'live', 'english'],
    difficulte: 3,
    nature: 'phonetique',
    conseil:
      'Le /ɪ/ anglais est plus lâche et plus court que le « i » français : mâchoire détendue, son bref.',
  },
  P05: {
    code: 'P05',
    ipa: 'æ',
    label: 'le « a » ouvert de cat',
    langueCible: 'en',
    signature: 'sort en /a/ français, trop fermé',
    produitComme: ['a'],
    pairesMinimales: [['cat', 'kat'], ['bad', 'bard'], ['man', 'mum']],
    motsExemples: ['cat', 'bad', 'man', 'after', 'apple'],
    difficulte: 2,
    nature: 'phonetique',
    conseil: 'Ouvre la bouche comme pour un « a » français, puis tire la langue vers l’avant.',
  },
  P06: {
    code: 'P06',
    ipa: 'ʌ',
    label: 'le « a » bref de cup',
    langueCible: 'en',
    signature: 'sort en /o/ ou /œ/',
    produitComme: ['o', 'œ'],
    pairesMinimales: [['cup', 'kop'], ['bus', 'boss'], ['hut', 'hot']],
    motsExemples: ['cup', 'bus', 'sun', 'money', 'other'],
    difficulte: 2,
    nature: 'phonetique',
    conseil: 'Un son court, au fond de la bouche, entre « eu » et « a ». Jamais arrondi comme « o ».',
  },
  P07: {
    code: 'P07',
    ipa: 'ɹ',
    label: 'le « r » anglais',
    langueCible: 'en',
    signature: 'r roulé, ou guttural français',
    produitComme: ['ʁ', 'r'],
    pairesMinimales: [['red', 'zed'], ['very', 'vet'], ['right', 'light']],
    motsExemples: ['red', 'very', 'right', 'around', 'more'],
    difficulte: 3,
    nature: 'phonetique',
    conseil:
      'La pointe de la langue se rapproche du palais sans le toucher, lèvres à peine arrondies. Aucune vibration de gorge.',
  },
  P08: {
    code: 'P08',
    ipa: 'ŋ',
    label: 'le « ng » nasal de sing',
    langueCible: 'en',
    signature: 'devient /n/ + /g/ (« singue »)',
    produitComme: ['n', 'g'],
    pairesMinimales: [['sing', 'sin'], ['long', 'lon'], ['thing', 'thin']],
    motsExemples: ['sing', 'going', 'long', 'english', 'think'],
    difficulte: 1,
    nature: 'phonetique',
    conseil:
      'Le dos de la langue touche le palais mou, le nez vibre. Aucun « g » final : ne dis pas « singue ».',
  },
  P09: {
    code: 'P09',
    ipa: 'v',
    label: '/v/ contre /w/',
    langueCible: 'en',
    signature: 'les deux sortent en /v/ ou en /w/ confondus',
    produitComme: ['w'],
    pairesMinimales: [['vest', 'west'], ['very', 'wary'], ['vine', 'wine']],
    motsExemples: ['very', 'vest', 'voice', 'love', 'never'],
    difficulte: 2,
    nature: 'phonetique',
    conseil: '/v/ : la lèvre du bas touche les dents du haut. /w/ : les lèvres s’arrondissent, aucune dent.',
  },
  P10: {
    code: 'P10',
    ipa: 'dʒ',
    label: 'le « j » anglais de job',
    langueCible: 'en',
    signature: 'sort en /ʒ/ français (le « j » de je)',
    produitComme: ['ʒ'],
    pairesMinimales: [['job', 'joe'], ['bridge', 'breeze'], ['age', 'ache']],
    motsExemples: ['job', 'age', 'bridge', 'just', 'language'],
    difficulte: 2,
    nature: 'phonetique',
    conseil: 'Commence collé, comme un « d », puis relâche en /ʒ/. Le son anglais a une attaque.',
  },
  P11: {
    code: 'P11',
    ipa: 'ə',
    label: 'le schwa, voyelle neutre',
    langueCible: 'en',
    signature: 'absent : chaque voyelle est prononcée pleine',
    produitComme: ['e', 'a'],
    pairesMinimales: [['banana', 'bananA'], ['about', 'AbOut'], ['sofa', 'sofA']],
    motsExemples: ['banana', 'about', 'sofa', 'teacher', 'problem'],
    difficulte: 3,
    nature: 'phonetique',
    conseil:
      'Les syllabes non accentuées se réduisent à un son neutre très court. Ne prononce pas toutes les voyelles.',
  },
  P12: {
    code: 'P12',
    ipa: 'b',
    label: 'consonnes finales sonores',
    langueCible: 'en',
    signature: 'assourdies : dog → dok, bed → bet',
    produitComme: ['p', 't', 'k'],
    pairesMinimales: [['dog', 'dock'], ['bed', 'bet'], ['cab', 'cap']],
    motsExemples: ['dog', 'bed', 'have', 'loud', 'friend'],
    difficulte: 2,
    nature: 'phonetique',
    conseil:
      'La dernière consonne doit vibrer : pose-la au lieu de la couper. « dog » ne finit pas comme « dock ».',
  },
  P13: {
    code: 'P13',
    ipa: 'st',
    label: 'groupes consonantiques',
    langueCible: 'en',
    signature: 'voyelle parasite insérée : street → s(e)treet',
    produitComme: ['ə'],
    pairesMinimales: [['street', 'seastreet'], ['asked', 'ask-ed'], ['strengths', 'strengthes']],
    motsExemples: ['street', 'asked', 'strengths', 'sport', 'next'],
    difficulte: 2,
    nature: 'phonetique',
    conseil: 'Enchaîne les consonnes sans voyelle entre elles : « s-t-r » collé, pas « se-t-r ».',
  },
  P14: {
    code: 'P14',
    ipa: 'ˈ',
    label: 'accent de mot',
    langueCible: 'en',
    signature: 'l’accent tombe au mauvais endroit',
    produitComme: [],
    pairesMinimales: [['REcord', 'reCORD'], ['PHOtograph', 'phoTOgraphy']],
    motsExemples: ['record', 'photograph', 'banana', 'present', 'begin'],
    difficulte: 3,
    nature: 'positionnel',
    conseil:
      'Ce n’est pas un son, c’est une place : la syllabe accentuée est plus longue, plus haute, plus forte.',
    accentuation: [
      { mot: 'record', syllabes: ['RE', 'cord'], accent: 0 },
      { mot: 'photograph', syllabes: ['PHO', 'to', 'graph'], accent: 0 },
      { mot: 'photography', syllabes: ['pho', 'TO', 'gra', 'phy'], accent: 1 },
      { mot: 'begin', syllabes: ['be', 'GIN'], accent: 1 },
    ],
  },
  P15: {
    code: 'P15',
    ipa: 'ʊ',
    label: 'le « ou » court de full',
    langueCible: 'en',
    signature: 'les deux sortent en /u/ français',
    produitComme: ['u'],
    pairesMinimales: [['full', 'fool'], ['pull', 'pool'], ['look', 'luke']],
    motsExemples: ['full', 'pull', 'book', 'put', 'would'],
    difficulte: 1,
    nature: 'phonetique',
    conseil: 'Le /ʊ/ est bref et relâché : lèvres peu arrondies, beaucoup plus court que « ou ».',
  },

  /* ------------------------------------------------------------------ *
   * RF-20 — Espagnol → Français. Même architecture, même moteur, mêmes
   * seuils : seule la donnée change. C'est l'argument qui compte face à
   * un coach « anglais uniquement » : la taxonomie est une table.
   * ------------------------------------------------------------------ */
  E01: {
    code: 'E01',
    ipa: 'y',
    label: 'le « u » français',
    langueCible: 'fr',
    signature: 'sort en /u/ espagnol : « tu » devient « tou »',
    produitComme: ['u'],
    pairesMinimales: [['tu', 'tout'], ['vu', 'vous'], ['rue', 'roux']],
    motsExemples: ['tu', 'vu', 'rue', 'lune', 'sur'],
    difficulte: 3,
    nature: 'phonetique',
    conseil:
      'Place les lèvres en avant comme pour « ou », puis dis « i » sans bouger les lèvres.',
  },
  E02: {
    code: 'E02',
    ipa: 'ʁ',
    label: 'le « r » français',
    langueCible: 'fr',
    signature: 'r roulé à l’espagnole, au lieu du r grasseyé',
    produitComme: ['r'],
    pairesMinimales: [['rire', 'lire'], ['roi', 'loi'], ['riz', 'lit']],
    motsExemples: ['rouge', 'rue', 'quatre', 'merci', 'Paris'],
    difficulte: 3,
    nature: 'phonetique',
    conseil:
      'Le r français vient du fond de la gorge ; la pointe de la langue reste en bas, derrière les dents.',
  },
  E03: {
    code: 'E03',
    ipa: 'ɑ̃',
    label: 'les voyelles nasales',
    langueCible: 'fr',
    signature: 'dénasalisée, ou suivie d’un /n/ qui n’existe pas : « bon » → « bonne »',
    produitComme: ['an', 'on'],
    pairesMinimales: [['bon', 'bonne'], ['pain', 'paix'], ['vin', 'vis']],
    motsExemples: ['bon', 'pain', 'vin', 'temps', 'dans'],
    difficulte: 3,
    nature: 'phonetique',
    conseil:
      'L’air passe à la fois par le nez et par la bouche, et le mot s’arrête là : aucune consonne finale.',
  },
  E04: {
    code: 'E04',
    ipa: 'ʃ',
    label: 'le « ch » français',
    langueCible: 'fr',
    signature: 'sort en /tʃ/ : « chien » devient « tchien »',
    produitComme: ['tʃ'],
    pairesMinimales: [['chien', 'tien'], ['chaud', 'sot'], ['chèque', 'sec']],
    motsExemples: ['chien', 'chèque', 'chapeau', 'chez', 'chat'],
    difficulte: 2,
    nature: 'phonetique',
    conseil: 'Pas d’attaque dure : souffle le « ch » sans coller la langue au palais.',
  },
  E05: {
    code: 'E05',
    ipa: 'v',
    label: '/v/ contre /b/',
    langueCible: 'fr',
    signature: 'confondu avec /b/ : en espagnol les deux ne s’opposent pas',
    produitComme: ['b'],
    pairesMinimales: [['vin', 'bain'], ['voix', 'bois'], ['veau', 'beau']],
    motsExemples: ['vin', 'voix', 'veau', 'vivre', 'avec'],
    difficulte: 2,
    nature: 'phonetique',
    conseil:
      'Les dents du haut frôlent la lèvre du bas et ça continue de sonner : le /v/ frotte, le /b/ explose.',
  },
  E06: {
    code: 'E06',
    ipa: 'ɛ',
    label: '/ɛ/ ouvert contre /e/ fermé',
    langueCible: 'fr',
    signature: 'les deux sortent en /e/ espagnol, sans distinction',
    produitComme: ['e'],
    pairesMinimales: [['mettre', 'maître'], ['prêt', 'pré'], ['faite', 'fée']],
    motsExemples: ['mettre', 'prêt', 'mer', 'père', 'très'],
    difficulte: 2,
    nature: 'phonetique',
    conseil: 'L’ouvert /ɛ/ descend la mâchoire ; le fermé /e/ garde la bouche presque fermée.',
  },
  E07: {
    code: 'E07',
    ipa: 'ø',
    label: 'le « eu » français',
    langueCible: 'fr',
    signature: 'n’existe pas en espagnol : sort en /e/ ou en /o/',
    produitComme: ['e', 'o'],
    pairesMinimales: [['deux', 'doux'], ['jeune', 'jaune'], ['peu', 'pou']],
    motsExemples: ['deux', 'jeune', 'sœur', 'peu', 'heure'],
    difficulte: 3,
    nature: 'phonetique',
    conseil: 'Arrondis les lèvres comme pour « o » et dis « é » en même temps.',
  },
  E08: {
    code: 'E08',
    ipa: 'k',
    label: 'consonnes finales',
    langueCible: 'fr',
    signature: 'consonne finale effacée, ou voyelle ajoutée : « sac » → « saco »',
    produitComme: ['ə'],
    pairesMinimales: [['sac', 'ça'], ['cap', 'cas'], ['vite', 'vit']],
    motsExemples: ['sac', 'cap', 'net', 'vite', 'porte'],
    difficulte: 2,
    nature: 'phonetique',
    conseil: 'Coupe net à la fin du mot : la dernière consonne s’entend, aucune voyelle derrière.',
  },
  E09: {
    code: 'E09',
    ipa: 'ʒ',
    label: 'le « j » français',
    langueCible: 'fr',
    signature: 'sort en /ʃ/ (« ch ») ou en jota /x/',
    produitComme: ['ʃ', 'x'],
    pairesMinimales: [['je', 'chez'], ['joue', 'chou'], ['gîte', 'chic']],
    motsExemples: ['je', 'joue', 'jaune', 'gîte', 'toujours'],
    difficulte: 2,
    nature: 'phonetique',
    conseil: 'La gorge vibre : c’est le « j » de journal, pas celui de jamón.',
  },
};

export const CODES_PHONEMES = Object.keys(PHONEMES) as CodePhoneme[];

/** Les codes d'une paire de langues : le profil et l'export ne montrent que ceux-là. */
export function codesPourLangue(langue: LangueCible): CodePhoneme[] {
  return CODES_PHONEMES.filter((c) => PHONEMES[c].langueCible === langue);
}

/** Toutes les entrées d'une langue, triées par code (ordre stable pour l’affichage). */
export function entrees(langue: LangueCible = 'en'): EntreePhoneme[] {
  return codesPourLangue(langue).map((c) => PHONEMES[c]);
}

export function entree(code: CodePhoneme): EntreePhoneme {
  return PHONEMES[code];
}

/**
 * Rattache un IPA renvoyé par une API à un code de la taxonomie.
 * `langue` évite les collisions entre paires (ex. /v/ existe en P09 et E05) :
 * sans elle, on parcourt tout et le premier code gagne.
 * Un phonème hors taxonomie vaut null : on l'affiche, on ne le cible pas.
 */
export function codePourIpa(ipa: string, langue?: LangueCible): CodePhoneme | null {
  const nettoye = ipa.trim().toLowerCase();
  const codes = langue ? codesPourLangue(langue) : CODES_PHONEMES;
  for (const code of codes) {
    if (PHONEMES[code].ipa.toLowerCase() === nettoye) return code;
  }
  return null;
}

/** Un mot appartient-il à la liste d'exemples / paires minimales d'un code ? */
export function motPorteur(code: CodePhoneme, mot: string): boolean {
  const m = mot.toLowerCase().replace(/[^a-z']/g, '');
  const e = PHONEMES[code];
  return (
    e.motsExemples.includes(m) ||
    e.pairesMinimales.some(([a, b]) => a.toLowerCase() === m || b.toLowerCase() === m)
  );
}
