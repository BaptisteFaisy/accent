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
};

export const CODES_PHONEMES = Object.keys(PHONEMES) as CodePhoneme[];

/** Toutes les entrées, triées par code (ordre stable pour l’affichage). */
export function entrees(langue: LangueCible = 'en'): EntreePhoneme[] {
  return CODES_PHONEMES.map((c) => PHONEMES[c]).filter((e) => e.langueCible === langue);
}

export function entree(code: CodePhoneme): EntreePhoneme {
  return PHONEMES[code];
}

/** Le code d'un phonème hors taxonomie vaut null : on l'affiche, on ne le cible pas. */
export function codePourIpa(ipa: string): CodePhoneme | null {
  const nettoye = ipa.trim().toLowerCase();
  for (const code of CODES_PHONEMES) {
    const e = PHONEMES[code];
    if (e.ipa.toLowerCase() === nettoye) return code;
    if (e.produitComme.some((p) => p.toLowerCase() === nettoye) && e.nature === 'phonetique') {
      // Un API peut renvoyer le phonème *produit* : on le rattache à la cible.
      continue;
    }
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
