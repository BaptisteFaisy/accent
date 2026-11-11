import { DUREE_MAX_MS, TAUX_ECHANTILLONNAGE } from '../constants';
import { decoderVersMono16k, encoderWav } from './wav';
import { analyserQualite, type QualiteAudio } from './quality';

/**
 * Capture micro (RF-02) : MediaRecorder natif, 1 à 15 s, aperçu avant envoi.
 * L'audio n'est jamais persisté (RNF-P1) : le blob vit en mémoire et est
 * remplacé par un ArrayBuffer PCM, puis libéré après analyse.
 */

export interface Enregistrement {
  /** PCM mono 16 kHz prêt à envoyer. */
  pcm: Float32Array;
  wav: ArrayBuffer;
  dureeMs: number;
  qualite: QualiteAudio;
  /** Aperçu local (URL d'objet) : à révoquer après écoute, jamais uploadé. */
  apercuUrl: string;
  taux: number;
}

export interface ControlesCapture {
  onNiveau?: (rms: number) => void;
  onDuree?: (ms: number) => void;
}

export class CaptureMicro {
  private flux: MediaStream | null = null;

  private media: MediaRecorder | null = null;

  private morceaux: Blob[] = [];

  private debut = 0;

  private minuteur: number | null = null;

  private ctx: AudioContext | null = null;

  async demarrer(ctrl: ControlesCapture = {}): Promise<void> {
    this.flux = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, channelCount: 1 },
    });
    this.morceaux = [];
    this.media = new MediaRecorder(this.flux);
    this.media.ondataavailable = (e) => {
      if (e.data.size > 0) this.morceaux.push(e.data);
    };
    this.media.start(200);
    this.debut = Date.now();
    this.suivreNiveau(ctrl);
    this.minuteur = window.setInterval(() => {
      const ms = Date.now() - this.debut;
      ctrl.onDuree?.(ms);
      if (ms >= DUREE_MAX_MS) void this.arreter();
    }, 100);
  }

  /** Visualisation temps réel (écran 2) : RMS par fenêtre de 100 ms. */
  private suivreNiveau(ctrl: ControlesCapture): void {
    if (!ctrl.onNiveau || !this.flux) return;
    const Ctx: typeof AudioContext = window.AudioContext;
    this.ctx = new Ctx();
    const source = this.ctx.createMediaStreamSource(this.flux);
    const analyseur = this.ctx.createAnalyser();
    analyseur.fftSize = 1024;
    source.connect(analyseur);
    const tampon = new Float32Array(analyseur.fftSize);
    const boucle = () => {
      analyseur.getFloatTimeDomainData(tampon);
      let somme = 0;
      for (let i = 0; i < tampon.length; i += 1) somme += tampon[i] * tampon[i];
      ctrl.onNiveau?.(Math.sqrt(somme / tampon.length));
      if (this.ctx) this.raf = requestAnimationFrame(boucle);
    };
    this.raf = requestAnimationFrame(boucle);
  }

  private raf = 0;

  async arreter(): Promise<Enregistrement> {
    if (this.minuteur !== null) window.clearInterval(this.minuteur);
    this.minuteur = null;
    const media = this.media;
    const blob = await new Promise<Blob>((resolve) => {
      if (!media) {
        resolve(new Blob(this.morceaux));
        return;
      }
      media.onstop = () => resolve(new Blob(this.morceaux, { type: media.mimeType }));
      media.stop();
    });
    this.libereMicro();
    const dureeMs = Date.now() - this.debut;
    const pcm = await decoderVersMono16k(blob);
    const wav = encoderWav(pcm, TAUX_ECHANTILLONNAGE);
    const qualite = analyserQualite(pcm, TAUX_ECHANTILLONNAGE);
    return {
      pcm,
      wav,
      dureeMs: Math.max(dureeMs, qualite.dureeMs),
      qualite,
      apercuUrl: URL.createObjectURL(blob),
      taux: TAUX_ECHANTILLONNAGE,
    };
  }

  private libereMicro(): void {
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;
    void this.ctx?.close();
    this.ctx = null;
    this.flux?.getTracks().forEach((t) => t.stop());
    this.flux = null;
    this.media = null;
  }

  annuler(): void {
    if (this.minuteur !== null) window.clearInterval(this.minuteur);
    this.minuteur = null;
    this.morceaux = [];
    this.libereMicro();
  }
}

/** RF-02 : repli « téléverser un fichier audio » si le micro est refusé. */
export async function depuisFichier(fichier: File): Promise<Enregistrement> {
  const pcm = await decoderVersMono16k(fichier);
  const wav = encoderWav(pcm, TAUX_ECHANTILLONNAGE);
  const qualite = analyserQualite(pcm, TAUX_ECHANTILLONNAGE);
  return {
    pcm,
    wav,
    dureeMs: qualite.dureeMs,
    qualite,
    apercuUrl: URL.createObjectURL(fichier),
    taux: TAUX_ECHANTILLONNAGE,
  };
}

/** RNF-P1 : l'aperçu local est une URL d'objet, on la révoque après usage. */
export function oublier(enr: Enregistrement | null): void {
  if (enr?.apercuUrl) URL.revokeObjectURL(enr.apercuUrl);
}
