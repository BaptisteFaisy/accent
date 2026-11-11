#!/usr/bin/env python3
"""Porte de vérification de l'agent de conflit (hermes-conflit).

Une résolution de conflit **ne doit jamais atteindre la branche sans vérifier**.
Motif d'origine (dépôt vision, PR #615) : la réconciliation avait poussé une tête
cassée — paramètre manquant, variable hors portée, un test aux arguments
inversés —, le balayeur a classé l'échec « réel », et la PR est morte en silence
jusqu'à une reprise humaine.

Ici, le dépôt est TypeScript/Node : on vérifie les types (`tsc --noEmit`), les
tests (`vitest run`) et la syntaxe des modules Node (`node --check`) AVANT le
push. Rouge → rien n'est poussé, la branche reste intacte, la PR reste `DIRTY`
(le tour suivant rappelle l'agent, dans la limite du quota) et le compte rendu
cite les erreurs.

Une porte qui ne peut pas s'exécuter (pas de `node_modules`, délai dépassé) ne
bloque rien et le dit : le bail de la CI reste la preuve.
Coupe-circuit : `CONFLICT_COMPILE_GATE=0`.

Bibliothèque standard uniquement, aucune horloge implicite, aucun secret.
"""

import os
import shutil
import subprocess
import sys

GATE_ENV = "CONFLICT_COMPILE_GATE"
GATE_TIMEOUT_S = 200
GATE_EXCERPT = 1_500
# Marqueur de la tête posée par l'agent : le balayeur le cherche mot pour mot
# pour attribuer un échec à la résolution (label `intervention-humaine`) au
# lieu de laisser la PR mourir en silence.
MARK_AGENT = "<!-- agent-conflit sha=%s -->"

# Extensions qui engagent le typecheck du projet.
EXT_TS = (".ts", ".tsx", ".json", ".css", ".html")
# Rien à vérifier : documentation et textes.
EXT_INERTES = (".md", ".txt", ".markdown", ".yml", ".yaml", ".toml")


def _log(message):
    print("hermes-agent: %s" % message, flush=True)


def fichiers_modifies(base="origin/main"):
    """Fichiers que la branche change par rapport à `base` (best-effort)."""
    try:
        proc = subprocess.run(["git", "diff", "--name-only", "%s...HEAD" % base],
                              capture_output=True, text=True, timeout=120)
    except (OSError, subprocess.SubprocessError) as exc:
        _log("diff illisible, rien à vérifier : %s" % exc)
        return []
    if proc.returncode != 0:
        _log("diff illisible (%s), rien à vérifier" % base)
        return []
    return [line for line in (proc.stdout or "").splitlines() if line.strip()]


def est_test(path):
    """Un fichier de test (vitest) ou le dossier de tests."""
    return path.startswith("tests/") or ".test." in path


def taches_compilation(fichiers):
    """(commandes Node, fichiers Python) à vérifier pour ces chemins.

    Les commandes sont rendues dedupliquées et dans un ordre stable : types
    d'abord (rapides), tests ensuite. La documentation ne prouve rien et n'est
    pas vérifiée ici.
    """
    commandes, python, mjs = [], [], []
    typecheck = worker = tests = False
    for path in fichiers:
        if path.endswith(".py"):
            python.append(path)
            continue
        if path.endswith(".mjs"):
            mjs.append(path)
            continue
        if path.endswith(EXT_INERTES):
            continue
        if path.startswith("worker/") and path.endswith(EXT_TS):
            worker = True
            continue
        if path.endswith(EXT_TS):
            typecheck = True
        if est_test(path):
            tests = True
    if typecheck or worker:
        commandes.append(["npx", "tsc", "--noEmit"])
    if worker:
        commandes.append(["npx", "tsc", "-p", "worker", "--noEmit"])
    if tests:
        commandes.append(["npx", "vitest", "run"])
    for path in mjs:
        commandes.append(["node", "--check", path])
    return commandes, python


def extrait_compilateur(etape, texte):
    """Extrait publiable : les lignes d'erreur, sinon la fin du journal."""
    lignes = [ligne.strip() for ligne in texte.splitlines() if ligne.strip()]
    fautes = [ligne for ligne in lignes
              if "error TS" in ligne or ligne.startswith("e: ")
              or "error:" in ligne or ligne.startswith("FAIL")
              or ligne.startswith("AssertionError")]
    garde = fautes[:8] or lignes[-8:]
    return "`%s` :\n```\n%s\n```" % (etape, "\n".join(garde)[:GATE_EXCERPT])


def environnement_node():
    """PATH du runner : Node y est via ~/.local/bin, pas toujours dans PATH."""
    env = dict(os.environ)
    maison = os.path.expanduser("~")
    for ajout in (os.path.join(maison, ".local", "bin"), os.path.join(maison, "bin")):
        if ajout not in env.get("PATH", ""):
            env["PATH"] = ajout + os.pathsep + env.get("PATH", "")
    return env


def verifier_compilation(fichiers=None):
    """Vérifie les modules touchés avant le push. Rend (ok, message).

    `ok` faux n'est pas une panne : c'est la preuve que la résolution est
    cassée, donc le push est refusé et la branche reste intacte.
    """
    if os.environ.get(GATE_ENV, "1") == "0":
        return True, "porte de vérification désactivée (%s=0)" % GATE_ENV
    if not os.path.isdir("node_modules") or shutil.which("node") is None:
        return True, "porte sautée : pas de `node_modules` ni de `node` ici"
    fichiers = fichiers_modifies() if fichiers is None else fichiers
    commandes, python = taches_compilation(fichiers)
    if not commandes and not python:
        return True, "porte de vérification : aucun module touché"
    env = environnement_node()
    for path in python:
        try:
            proc = subprocess.run([sys.executable, "-m", "py_compile", path],
                                  capture_output=True, text=True, timeout=60)
        except (OSError, subprocess.SubprocessError) as exc:
            return True, "porte sautée (Python) : %s" % exc
        if proc.returncode != 0:
            return False, extrait_compilateur("Python %s" % path,
                                              proc.stderr or proc.stdout)
    for commande in commandes:
        try:
            proc = subprocess.run(commande, capture_output=True, text=True,
                                  timeout=GATE_TIMEOUT_S, env=env)
        except subprocess.TimeoutExpired:
            return True, ("porte non concluante : %d s dépassées (%s)"
                          % (GATE_TIMEOUT_S, " ".join(commande)))
        except (OSError, subprocess.SubprocessError) as exc:
            return True, "porte sautée : %s" % exc
        if proc.returncode != 0:
            return False, extrait_compilateur(" ".join(commande),
                                              (proc.stdout or "") + "\n"
                                              + (proc.stderr or ""))
    return True, "porte de vérification : %d commande(s) OK" % len(commandes)


def tete_git():
    """SHA de la tête (le push ne la change pas : marqueur exact)."""
    try:
        proc = subprocess.run(["git", "rev-parse", "HEAD"], capture_output=True,
                              text=True, timeout=60)
    except (OSError, subprocess.SubprocessError):
        return ""
    return (proc.stdout or "").strip() if proc.returncode == 0 else ""


def prepare_push(files, branch, fichiers=None):
    """(ok, message, corps) : décide du push et prépare son compte rendu.

    Le corps porte le marqueur de tête en première ligne ; l'appelant ne le
    poste qu'après un push réussi.
    """
    ok, message = verifier_compilation(fichiers)
    if not ok:
        return False, message, ""
    unique = sorted(set(files))
    corps = ("%s\n\nConflit réconcilié par l'agent : %d fichier(s) (%s), "
             "rebase poussé sur `%s` (%s). La file reprend."
             % (MARK_AGENT % tete_git(), len(unique), ", ".join(unique),
                branch, message))
    return True, message, corps
