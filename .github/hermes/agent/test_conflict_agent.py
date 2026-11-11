#!/usr/bin/env python3
"""Tests ciblés de conflict_agent.py — bibliothèque standard uniquement.

Lance : python3 -m unittest test_conflict_agent -v
(depuis .github/hermes/agent/).
"""
import json
import os
import shutil
import subprocess
import tempfile
import time
import unittest
from unittest import mock

import compilation_gate


def compilation_timeout(argv, **kw):
    raise compilation_gate.subprocess.TimeoutExpired(cmd=argv, timeout=1)


compilation_agent_subprocess = compilation_gate.subprocess
import conflict_agent


class EnvOrTest(unittest.TestCase):
    """Résolution des réglages : une var GitHub absente arrive comme ""."""

    def test_var_absente_rend_defaut(self):
        with mock.patch.dict(os.environ):
            os.environ.pop("FIREWORKS_MODEL", None)
            self.assertEqual(
                conflict_agent.env_or("FIREWORKS_MODEL", "DEFAUT"), "DEFAUT")

    def test_var_vide_rend_defaut(self):
        # Régression 28/10 : modèle "" → 400 Fireworks sur un vrai conflit.
        with mock.patch.dict(os.environ, {"FIREWORKS_MODEL": ""}):
            self.assertEqual(
                conflict_agent.env_or("FIREWORKS_MODEL", "DEFAUT"), "DEFAUT")

    def test_var_renseignee_gagne(self):
        with mock.patch.dict(os.environ, {"FIREWORKS_MODEL": "M"}):
            self.assertEqual(
                conflict_agent.env_or("FIREWORKS_MODEL", "DEFAUT"), "M")


class PushUrlTest(unittest.TestCase):
    """URL push : PAT du CI, repli "origin" en local."""

    def test_avec_token_rend_url_authentifiee(self):
        with mock.patch.dict(os.environ, {"GH_TOKEN": "T"}):
            url = conflict_agent.push_url("O/R")
            self.assertEqual(
                url, "https://x-access-token:T@github.com/O/R.git")

    def test_sans_token_rend_origin(self):
        with mock.patch.dict(os.environ):
            os.environ.pop("GH_TOKEN", None)
            self.assertEqual(conflict_agent.push_url("O/R"), "origin")


class SplitHunksTest(unittest.TestCase):
    """Découpage des marqueurs : le propre recopié, les bords nommés."""

    def test_sans_marqueur_tout_propre(self):
        segs = conflict_agent.split_hunks("a\nb\n")
        self.assertEqual(segs, [("clean", "a\nb\n")])

    def test_diff_simple(self):
        text = ("A\n<<<<<<< HEAD\nm1\n=======\nb1\n>>>>>>> br\nZ\n")
        segs = conflict_agent.split_hunks(text)
        self.assertEqual(len(segs), 3)
        self.assertEqual(segs[0], ("clean", "A"))
        kind, hunk = segs[1]
        self.assertEqual(kind, "hunk")
        self.assertEqual(hunk["head"], ["m1"])
        self.assertIsNone(hunk["base"])
        self.assertEqual(hunk["saved"], ["b1"])
        self.assertEqual(segs[2], ("clean", "Z\n"))

    def test_diff3_avec_base(self):
        text = ("<<<<<<< HEAD\nm\n||||||| base\nb\n=======\ns\n>>>>>>> br\n")
        segs = conflict_agent.split_hunks(text)
        self.assertEqual(len(segs), 2)
        kind, hunk = segs[0]
        self.assertEqual(hunk["head"], ["m"])
        self.assertEqual(hunk["base"], ["b"])
        self.assertEqual(hunk["saved"], ["s"])

    def test_rebase_reel_second_bloc_est_branche(self):
        # Non-régression 28/10 : en rebase, "saved" = branche rejouée.
        repo = tempfile.mkdtemp(prefix="fw-sides-")
        self.addCleanup(shutil.rmtree, repo, True)
        old = os.getcwd()
        self.addCleanup(os.chdir, old)
        os.chdir(repo)
        run = lambda *a: subprocess.run(  # noqa: E731
            ["git", *a], capture_output=True, text=True)
        run("init", "-q")
        run("config", "user.email", "t@t")
        run("config", "user.name", "t")
        with open("f.txt", "w") as fh:
            fh.write("base\n")
        run("add", ".")
        run("commit", "-qm", "base")
        main = run("branch", "--show-current").stdout.strip()
        run("checkout", "-qb", "br")
        with open("f.txt", "w") as fh:
            fh.write("BRANCHE\n")
        run("commit", "-qam", "br")
        run("checkout", "-q", main)
        with open("f.txt", "w") as fh:
            fh.write("MASTER\n")
        run("commit", "-qam", "m")
        run("checkout", "-q", "br")
        failed = subprocess.run(["git", "rebase", main],
                                capture_output=True)
        self.assertNotEqual(failed.returncode, 0)  # conflit attendu
        with open("f.txt") as fh:
            segs = conflict_agent.split_hunks(fh.read())
        hunks = [s for k, s in segs if k == "hunk"]
        self.assertEqual(len(hunks), 1)
        self.assertEqual(hunks[0]["saved"], ["BRANCHE"])
        self.assertEqual(hunks[0]["head"], ["MASTER"])


def _scratch_repo(test):
    """Dépôt git réel en temp, cwd dedans, nettoyé après. Rend run()."""
    repo = tempfile.mkdtemp(prefix="fw-loop-")
    test.addCleanup(shutil.rmtree, repo, True)
    old = os.getcwd()
    test.addCleanup(os.chdir, old)
    os.chdir(repo)
    def run(*args):
        return subprocess.run(["git", *args], capture_output=True, text=True)
    run("init", "-q")
    run("config", "user.email", "t@t")
    run("config", "user.name", "t")
    run("config", "commit.gpgsign", "false")
    return run


def _commit(run, files, message):
    for path, content in files.items():
        with open(path, "w") as fh:
            fh.write(content)
    run("add", ".")
    assert run("commit", "-qm", message).returncode == 0


class RebaseLoopTest(unittest.TestCase):
    """Boucle multi-passes : chaque arrêt est résolu, puis poussé."""

    def test_rebase_in_progress_suit_le_rebase(self):
        run = _scratch_repo(self)
        _commit(run, {"f.txt": "base\n"}, "base")
        base_branch = run("branch", "--show-current").stdout.strip()
        self.assertFalse(conflict_agent.rebase_in_progress())
        run("checkout", "-qb", "br")
        _commit(run, {"f.txt": "BR\n"}, "br")
        run("checkout", "-q", base_branch)
        _commit(run, {"f.txt": "M\n"}, "m")
        run("checkout", "-q", "br")
        failed = subprocess.run(["git", "rebase", base_branch],
                                capture_output=True)
        self.assertNotEqual(failed.returncode, 0)
        self.assertTrue(conflict_agent.rebase_in_progress())
        run("rebase", "--abort")
        self.assertFalse(conflict_agent.rebase_in_progress())

    def test_boucle_deux_arrets(self):
        # Non-régression 28/10 : #125 a deux commits en conflit, l'ancien
        # code échouait au premier --continue ("Resolve all conflicts").
        run = _scratch_repo(self)
        _commit(run, {"f.txt": "base\n", "g.txt": "base\n"}, "base")
        base_branch = run("branch", "--show-current").stdout.strip()
        run("checkout", "-qb", "br")
        _commit(run, {"f.txt": "BR-F\n"}, "br1")
        _commit(run, {"g.txt": "BR-G\n"}, "br2")
        run("checkout", "-q", base_branch)
        _commit(run, {"f.txt": "M-F\n"}, "m1")
        _commit(run, {"g.txt": "M-G\n"}, "m2")
        run("checkout", "-q", "br")
        failed = subprocess.run(["git", "rebase", base_branch],
                                capture_output=True)
        self.assertNotEqual(failed.returncode, 0)
        with mock.patch.object(conflict_agent, "modele_complete",
                               return_value="```\nRESOLU\n```"):
            resolved = conflict_agent.finish_loop(
                "http://x", "K", "M", time.time() + 60)
        self.assertEqual(sorted(resolved), ["f.txt", "g.txt"])
        self.assertFalse(conflict_agent.rebase_in_progress())
        log = run("log", "--format=%s").stdout
        self.assertIn("br1", log)
        self.assertIn("br2", log)

    def test_commit_vide_skip(self):
        # La résolution reprend le bord main : le commit rejoué est vide,
        # --continue échoue ("empty") et la boucle le saute.
        run = _scratch_repo(self)
        _commit(run, {"f.txt": "X\n"}, "base")
        base_branch = run("branch", "--show-current").stdout.strip()
        run("checkout", "-qb", "br")
        _commit(run, {"f.txt": "Y\n"}, "br")
        run("checkout", "-q", base_branch)
        _commit(run, {"f.txt": "Z\n"}, "m")
        run("checkout", "-q", "br")
        failed = subprocess.run(["git", "rebase", base_branch],
                                capture_output=True)
        self.assertNotEqual(failed.returncode, 0)
        with mock.patch.object(conflict_agent, "modele_complete",
                               return_value="```\nZ\n```"):
            conflict_agent.finish_loop("http://x", "K", "M",
                                       time.time() + 60)
        self.assertFalse(conflict_agent.rebase_in_progress())
        log = run("log", "--format=%s").stdout
        self.assertNotIn("br", log.splitlines())
        with open("f.txt") as fh:
            self.assertEqual(fh.read().strip(), "Z")

    def test_borne_max_rounds(self):
        # Un conflit qui ne part pas (résolution sans effet) abandonne
        # après MAX_ROUNDS au lieu de boucler.
        run = _scratch_repo(self)
        _commit(run, {"f.txt": "base\n"}, "base")
        base_branch = run("branch", "--show-current").stdout.strip()
        run("checkout", "-qb", "br")
        _commit(run, {"f.txt": "BR\n"}, "br")
        run("checkout", "-q", base_branch)
        _commit(run, {"f.txt": "M\n"}, "m")
        run("checkout", "-q", "br")
        failed = subprocess.run(["git", "rebase", base_branch],
                                capture_output=True)
        self.assertNotEqual(failed.returncode, 0)
        with mock.patch.object(conflict_agent, "resolve_one",
                               return_value=None):
            with self.assertRaises(conflict_agent.AgentError) as ctx:
                conflict_agent.finish_loop("http://x", "K", "M",
                                           time.time() + 60)
        self.assertIn("arrêts", str(ctx.exception))


class FinishPushTest(unittest.TestCase):
    """Fin de rebase : un seul push avec bail, puis compte rendu."""

    def test_un_seul_push(self):
        # Non-régression 29/10 : le push était exécuté deux fois avec le même
        # bail — le second échouait toujours après un premier succès, et la PR
        # repartait en « conflit » sans commentaire ni label.
        appels = []

        def faux_run(argv, **kw):
            appels.append(argv)
            return mock.Mock(returncode=0, stdout="", stderr="")

        with mock.patch.object(conflict_agent.subprocess, "run",
                               side_effect=faux_run):
            rc = conflict_agent.finish("O/R", "1", "br", "sha", ["f.txt"])
        self.assertEqual(rc, 0)
        pushes = [a for a in appels if a[:2] == ["git", "push"]]
        self.assertEqual(len(pushes), 1)
        self.assertIn("--force-with-lease=br:sha", pushes[0])

    def test_push_refuse_sans_compte_rendu_succes(self):
        def faux_run(argv, **kw):
            if argv[:2] == ["git", "push"]:
                return mock.Mock(returncode=1, stdout="", stderr="bail")
            return mock.Mock(returncode=0, stdout="", stderr="")

        with mock.patch.object(conflict_agent.subprocess, "run",
                               side_effect=faux_run):
            rc = conflict_agent.finish("O/R", "1", "br", "sha", ["f.txt"])
        self.assertEqual(rc, 1)


class DryRunStampTest(unittest.TestCase):
    """Le dry-run n'écrit jamais d'empreinte (ni cooldown ni plafond)."""

    def test_dry_run_sans_stamp(self):
        # Non-régression 29/10 : une simulation touchait l'empreinte avant la
        # branche dry-run, et bloquait un vrai run pendant 20 min.
        run = _scratch_repo(self)
        _commit(run, {"f.txt": "base\n"}, "base")
        base_branch = run("branch", "--show-current").stdout.strip()
        run("checkout", "-qb", "br")
        _commit(run, {"f.txt": "BR\n"}, "br")
        run("checkout", "-q", base_branch)
        _commit(run, {"f.txt": "M\n"}, "m")
        run("checkout", "-q", "br")
        failed = subprocess.run(["git", "rebase", base_branch],
                                capture_output=True)
        self.assertNotEqual(failed.returncode, 0)
        home = tempfile.mkdtemp(prefix="fw-home-")
        self.addCleanup(shutil.rmtree, home, True)
        args = mock.Mock(repo="O/R", pr="1", branch="", sha="abc",
                         dry_run=True)
        with mock.patch.dict(os.environ, {"HOME": home}), \
                mock.patch.object(conflict_agent, "pr_labels", return_value=[]):
            rc = conflict_agent.cmd_resolve(args)
        self.assertEqual(rc, 0)
        cache = os.path.join(home, ".cache", "hermes-agent")
        stamps = os.listdir(cache) if os.path.isdir(cache) else []
        self.assertEqual(stamps, [])


class UnionSansModeleTest(unittest.TestCase):
    """Le câblage : un journal se règle sans appeler le modèle."""

    def test_finish_loop_union_sans_saisine(self):
        run = _scratch_repo(self)
        _commit(run, {"CHANGELOG.md": "# J\n\n## Ancien\n"}, "base")
        base_branch = run("branch", "--show-current").stdout.strip()
        run("checkout", "-qb", "br")
        _commit(run, {"CHANGELOG.md": "# J\n\n## B\n\n## Ancien\n"}, "br")
        run("checkout", "-q", base_branch)
        _commit(run, {"CHANGELOG.md": "# J\n\n## M\n\n## Ancien\n"}, "m")
        run("checkout", "-q", "br")
        failed = subprocess.run(["git", "rebase", base_branch],
                                capture_output=True)
        self.assertNotEqual(failed.returncode, 0)
        with mock.patch.object(conflict_agent, "modele_complete",
                               side_effect=AssertionError("modèle appelé")):
            resolved = conflict_agent.finish_loop(
                "http://x", "K", "M", time.time() + 60)
        self.assertEqual(resolved, ["CHANGELOG.md"])
        self.assertFalse(conflict_agent.rebase_in_progress())



class TachesCompilationTest(unittest.TestCase):
    """Quelles vérifications la porte lance pour un diff donné (dépôt TS/Node)."""

    def test_docs_ne_verifient_rien(self):
        self.assertEqual(
            compilation_gate.taches_compilation(["docs/A.md", "README.md"]),
            ([], []))

    def test_source_ts_lance_le_typecheck(self):
        commandes, python = compilation_gate.taches_compilation(["src/engine/x.ts"])
        self.assertIn(["npx", "tsc", "--noEmit"], commandes)
        self.assertEqual(python, [])

    def test_typecheck_dedoublonne(self):
        commandes, _ = compilation_gate.taches_compilation(
            ["src/a.ts", "src/b.tsx", "package-lock.json"])
        self.assertEqual(commandes.count(["npx", "tsc", "--noEmit"]), 1)

    def test_worker_a_son_propre_tsconfig(self):
        commandes, _ = compilation_gate.taches_compilation(["worker/index.ts"])
        self.assertIn(["npx", "tsc", "-p", "worker", "--noEmit"], commandes)

    def test_tests_lancent_vitest(self):
        commandes, _ = compilation_gate.taches_compilation(["tests/proxy.test.ts"])
        self.assertIn(["npx", "vitest", "run"], commandes)

    def test_python_verifie_seul(self):
        self.assertEqual(
            compilation_gate.taches_compilation([".github/hermes/gate.py"]),
            ([], [".github/hermes/gate.py"]))

    def test_module_node_verifie_par_node_check(self):
        commandes, _ = compilation_gate.taches_compilation(["server/lib.mjs"])
        self.assertIn(["node", "--check", "server/lib.mjs"], commandes)

    def test_ci_et_mergify_ne_lancent_rien(self):
        # Un workflow ou la config Mergify ne se « compilent » pas : la porte
        # n'a rien à prouver ici (et ne doit rien bloquer).
        self.assertEqual(
            compilation_gate.taches_compilation(
                [".github/workflows/ci.yml", ".mergify.yml"]),
            ([], []))


MARQUEUR = "<!-- agent-conflit sha=abc123 -->\n\nConflit réconcilié."


class PorteCompilationTest(unittest.TestCase):
    """Une résolution qui ne compile pas n'atteint jamais la branche."""

    def setUp(self):
        # La porte exige `node` au PATH : on ne dépend pas de la machine de test.
        patcher = mock.patch.object(compilation_gate.shutil, "which",
                                    return_value="/usr/bin/node")
        patcher.start()
        self.addCleanup(patcher.stop)

    def test_desactivee_par_variable(self):
        with mock.patch.dict(os.environ, {"CONFLICT_COMPILE_GATE": "0"}):
            ok, message = compilation_gate.verifier_compilation(["core/a.kt"])
        self.assertTrue(ok)
        self.assertIn("désactivée", message)

    def test_sans_node_modules_ne_bloque_rien(self):
        # Un clone sans outillage (test local, worktree sans dépendances) ne
        # doit pas empêcher le rebase : la CI reste la preuve.
        tmp = tempfile.mkdtemp()
        ancien = os.getcwd()
        os.chdir(tmp)
        try:
            ok, message = compilation_gate.verifier_compilation(["src/a.ts"])
        finally:
            os.chdir(ancien)
            shutil.rmtree(tmp, ignore_errors=True)
        self.assertTrue(ok)
        self.assertIn("node_modules", message)

    def test_typecheck_rouge_refuse_avec_extrait(self):
        tmp = tempfile.mkdtemp()
        ancien = os.getcwd()
        os.chdir(tmp)
        try:
            os.mkdir("node_modules")

            def faux_run(argv, **kw):
                if argv[:3] == ["npx", "tsc", "--noEmit"]:
                    return mock.Mock(
                        returncode=2,
                        stdout="src/engine/x.ts(12,5): error TS2322: Type "
                               "'string' is not assignable to type 'number'.",
                        stderr="")
                return mock.Mock(returncode=0, stdout="", stderr="")

            with mock.patch.object(conflict_agent.subprocess, "run",
                                   side_effect=faux_run):
                ok, message = compilation_gate.verifier_compilation(
                    ["src/engine/x.ts"])
        finally:
            os.chdir(ancien)
            shutil.rmtree(tmp, ignore_errors=True)
        self.assertFalse(ok)
        self.assertIn("error TS2322", message)

    def test_vitest_rouge_refuse_avec_extrait(self):
        tmp = tempfile.mkdtemp()
        ancien = os.getcwd()
        os.chdir(tmp)
        try:
            os.mkdir("node_modules")

            def faux_run(argv, **kw):
                if argv[:3] == ["npx", "vitest", "run"]:
                    return mock.Mock(returncode=1,
                                     stdout="FAIL tests/x.test.ts\n"
                                            "AssertionError: attendu 3, reçu 4",
                                     stderr="")
                return mock.Mock(returncode=0, stdout="", stderr="")

            with mock.patch.object(conflict_agent.subprocess, "run",
                                   side_effect=faux_run):
                ok, message = compilation_gate.verifier_compilation(
                    ["tests/x.test.ts"])
        finally:
            os.chdir(ancien)
            shutil.rmtree(tmp, ignore_errors=True)
        self.assertFalse(ok)
        self.assertIn("AssertionError", message)

    def test_timeout_ne_bloque_pas(self):
        # Une porte qui ne peut pas conclure ne bloque pas le push : la CI juge.
        tmp = tempfile.mkdtemp()
        ancien = os.getcwd()
        os.chdir(tmp)
        try:
            os.mkdir("node_modules")
            with mock.patch.object(compilation_agent_subprocess, "run",
                                   side_effect=compilation_timeout):
                ok, message = compilation_gate.verifier_compilation(["src/a.ts"])
        finally:
            os.chdir(ancien)
            shutil.rmtree(tmp, ignore_errors=True)
        self.assertTrue(ok)
        self.assertIn("non concluante", message)

    def test_finish_ne_pousse_pas_un_arbre_casse(self):
        # Régression 31/10 (#615) : la réconciliation avait poussé une tête
        # qui ne compilait pas, le balayeur l'a classée « échec réel » et plus
        # aucun agent n'écrit de correctif de code → PR morte en silence.
        appels = []

        def faux_run(argv, **kw):
            appels.append(argv)
            return mock.Mock(returncode=0, stdout="", stderr="")

        with mock.patch.object(conflict_agent, "porte_compilation",
                               return_value=(False, "e: x", "")), \
                mock.patch.object(conflict_agent.subprocess, "run",
                                  side_effect=faux_run):
            rc = conflict_agent.finish("O/R", "1", "br", "sha", ["f.kt"])
        self.assertEqual(rc, 1)
        self.assertEqual([a for a in appels if a[:2] == ["git", "push"]], [])

    def test_marqueur_de_tete_dans_le_compte_rendu(self):
        # Le balayeur cherche `<!-- agent-conflit sha=<tête> -->` mot pour mot
        # pour dire sur un échec réel que la résolution est en cause.
        corps = []
        with mock.patch.object(conflict_agent, "porte_compilation",
                               return_value=(True, "ok", MARQUEUR)), \
                mock.patch.object(conflict_agent, "comment",
                                  side_effect=lambda r, p, b: corps.append(b)), \
                mock.patch.object(conflict_agent, "add_label"), \
                mock.patch.object(conflict_agent.subprocess, "run",
                                  return_value=mock.Mock(
                                      returncode=0, stdout="", stderr="")):
            rc = conflict_agent.finish("O/R", "1", "br", "sha", ["f.kt"])
        self.assertEqual(rc, 0)
        self.assertIn("<!-- agent-conflit sha=abc123 -->", corps[0])

    def test_prepare_push_porte_le_marqueur_de_tete(self):
        with mock.patch.object(compilation_gate, "verifier_compilation",
                               return_value=(True, "ok")), \
                mock.patch.object(compilation_gate, "tete_git",
                                  return_value="deadbeef"):
            ok, message, corps = compilation_gate.prepare_push(
                ["core/b.kt", "core/a.kt"], "br")
        self.assertTrue(ok)
        self.assertTrue(corps.startswith("<!-- agent-conflit sha=deadbeef -->"))
        self.assertIn("2 fichier(s) (core/a.kt, core/b.kt)", corps)


class PlafondFichiersTest(unittest.TestCase):
    """Plafond de fichiers par passe : 100 (était 8 avant le 01/11)."""

    def test_neuf_fichiers_couverts(self):
        # Non-régression : un conflit à >8 fichiers était refusé avant.
        fichiers = ["f%02d.txt" % i for i in range(9)]
        conflict_agent.check_round_files(fichiers)  # ne lève pas

    def test_cent_fichiers_couverts(self):
        fichiers = ["f%03d.txt" % i for i in range(100)]
        conflict_agent.check_round_files(fichiers)  # ne lève pas

    def test_cent_un_fichiers_refuses(self):
        fichiers = ["f%03d.txt" % i for i in range(101)]
        with self.assertRaises(conflict_agent.AgentError) as ctx:
            conflict_agent.check_round_files(fichiers)
        self.assertIn("plafond 100", str(ctx.exception))


if __name__ == "__main__":
    unittest.main()


class FournisseurInferHubTest(unittest.TestCase):
    """Le modèle se choisit par variables : InferHub d'abord, Fireworks en repli."""

    def test_defauts_inferhub(self):
        self.assertEqual(conflict_agent.API_DEFAULT,
                         "https://api.inferhub.dev/v1/chat/completions")
        self.assertEqual(conflict_agent.MODEL_DEFAULT, "combo/cheap")

    def test_inferhub_gagne_sur_fireworks(self):
        with mock.patch.dict(os.environ, {"INFERHUB_MODEL": "combo/cheap",
                                          "FIREWORKS_MODEL": "minimax"}):
            self.assertEqual(
                conflict_agent.env_ou(("INFERHUB_MODEL", "FIREWORKS_MODEL"), "d"),
                "combo/cheap")

    def test_repli_fireworks_si_inferhub_absent(self):
        with mock.patch.dict(os.environ, {"FIREWORKS_MODEL": "minimax"}):
            os.environ.pop("INFERHUB_MODEL", None)
            self.assertEqual(
                conflict_agent.env_ou(("INFERHUB_MODEL", "FIREWORKS_MODEL"), "d"),
                "minimax")

    def test_variable_injectee_vide_par_github_ne_compte_pas(self):
        # GitHub injecte une variable de dépôt absente comme "" : elle ne doit
        # pas écraser le défaut (sinon 400 côté fournisseur).
        with mock.patch.dict(os.environ, {"INFERHUB_MODEL": ""}):
            self.assertEqual(conflict_agent.env_ou(("INFERHUB_MODEL",), "defaut"),
                             "defaut")

    def test_user_agent_pose_sur_la_requete(self):
        # Piège payé : sans User-Agent, le CDN d'InferHub répond 403 « 1010 ».
        captures = {}

        class FauxUrlopen(object):
            def __init__(self, req, timeout=None):
                captures["req"] = req

            def __enter__(self):
                return self

            def __exit__(self, *args):
                return False

            def read(self):
                return json.dumps(
                    {"choices": [{"message": {"content": "ok"}}]}).encode("utf-8")

        with mock.patch.object(conflict_agent.urllib.request, "urlopen", FauxUrlopen):
            texte = conflict_agent.modele_complete(
                "https://api.inferhub.dev/v1/chat/completions", "cle",
                "combo/cheap", [{"role": "user", "content": "x"}])
        self.assertEqual(texte, "ok")
        self.assertEqual(captures["req"].get_header("User-agent"),
                         "accent-hermes-agent/1.0")

    def test_cle_et_modele_lus_dans_preflight(self):
        with mock.patch.dict(os.environ, {
                "INFERHUB_API_KEY": "sk-test",
                "INFERHUB_MODEL": "combo/claude-opus-5-5"}), \
                mock.patch.object(conflict_agent, "pr_labels", return_value=[]), \
                mock.patch.object(conflict_agent, "unmerged_files",
                                  return_value=["src/a.ts"]), \
                mock.patch.object(conflict_agent, "check_round_files"), \
                mock.patch.object(conflict_agent.quota, "gc_stamps"), \
                mock.patch.object(conflict_agent.quota, "autoriser",
                                  return_value=None):
            cle, modele, url, fichiers = conflict_agent.preflight(
                "O/R", 1, "sha", False, 0.0)
        self.assertEqual(cle, "sk-test")
        self.assertEqual(modele, "combo/claude-opus-5-5")
        self.assertEqual(url, "https://api.inferhub.dev/v1/chat/completions")
        self.assertEqual(fichiers, ["src/a.ts"])
