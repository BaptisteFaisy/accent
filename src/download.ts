/**
 * Téléchargement d'un fichier texte depuis le navigateur.
 *
 * Factorisé ici parce que deux écrans en ont besoin (Profil et Tes données) et
 * que `URL.createObjectURL` n'existe pas partout (jsdom, vieux navigateurs) :
 * l'échec est attrapé et signalé par un booléen, jamais par une exception qui
 * casserait l'écran.
 */
export function telechargerFichier(contenu: string, nomFichier: string): boolean {
  try {
    const blob = new Blob([contenu], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = nomFichier;
    a.click();
    URL.revokeObjectURL(url);
    return true;
  } catch {
    return false;
  }
}
