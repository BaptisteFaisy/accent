#!/usr/bin/env python3
"""Générateur des icônes PWA d'Accent — zéro dépendance (zlib + struct).

Les icônes sont de la DONNÉE dessinée par ce script, pas des binaires opaques :
on peut les régénérer, les auditer, les changer. Le dessin reprend la grammaire
visuelle du produit — fond `nuit` (#0b0f14), forme d'onde verte (`acquis`) avec
une barre orange (`à travailler`), jamais de rouge.

Usage : python3 tools/gen-icon.py public/
Produit : icon-192.png, icon-512.png, icon-maskable-512.png (fond plein, zone sûre
centrée, conforme aux exigences maskable d'Android).
"""
import struct, zlib, sys

FOND = (11, 15, 20)          # #0b0f14 (nuit)
VERT = (78, 201, 138)        # #4ec98a (acquis)
ORANGE = (242, 163, 60)      # #f2a33c (à travailler)

def png(taille, chemin, maskable=False):
    # Barres : hauteurs relatives d'une forme d'onde, centrées.
    hauteurs = [0.28, 0.52, 0.80, 0.44, 0.22]
    couleurs = [VERT, VERT, ORANGE, VERT, VERT]
    marge = int(taille * (0.18 if maskable else 0.12))
    zone = taille - 2 * marge
    nb = len(hauteurs)
    esp = zone / nb
    largeur = int(esp * 0.46)
    rayon = int(taille * 0.20)  # coins arrondis

    px = bytearray()
    for y in range(taille):
        ligne = bytearray()
        for x in range(taille):
            r, g, b = 0, 0, 0
            a = 0
            # fond arrondi
            dx = max(rayon - x, x - (taille - 1 - rayon), 0)
            dy = max(rayon - y, y - (taille - 1 - rayon), 0)
            inside = (dx * dx + dy * dy) <= rayon * rayon if (dx or dy) else True
            if maskable:
                inside = True  # maskable : fond plein, la zone sûre est au centre
            if inside:
                r, g, b, a = FOND[0], FOND[1], FOND[2], 255
                # barres
                for i in range(nb):
                    cx = marge + esp * i + esp / 2
                    h = hauteurs[i] * zone
                    y0 = (taille - h) / 2
                    if abs(x - cx) <= largeur / 2 and y0 <= y <= y0 + h:
                        r, g, b = couleurs[i]
            ligne += bytes((r, g, b, a))
        px += b'\x00' + bytes(ligne)

    def chunk(t, d):
        c = struct.pack('>I', len(d)) + t + d
        return c + struct.pack('>I', zlib.crc32(t + d) & 0xffffffff)

    ihdr = struct.pack('>IIBBBBB', taille, taille, 8, 6, 0, 0, 0)
    data = b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', ihdr) + chunk(b'IDAT', zlib.compress(bytes(px), 9)) + chunk(b'IEND', b'')
    open(chemin, 'wb').write(data)
    print(f'{chemin} : {taille}x{taille}, {len(data)} octets')

base = sys.argv[1]
png(192, f'{base}/icon-192.png')
png(512, f'{base}/icon-512.png')
png(512, f'{base}/icon-maskable-512.png', maskable=True)
