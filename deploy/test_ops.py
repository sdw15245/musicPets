import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
import ops

OLD = "sdw0501/musicpets:sha-" + "a" * 40
SHA = "b" * 40
NEW = "sdw0501/musicpets:sha-" + SHA

class DeploymentTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        root = Path(self.temp.name)
        (root / "deploy").mkdir()
        self.env = root / "deploy/.env"
        self.env.write_text("SECRET=keep-me\nBACKEND_IMAGE=" + OLD + "\n")
        self.ops = ops.Operations({"app_dir": str(root), "state_dir": str(root / "state")})
        self.running = OLD
        self.fail_new = False
        self.backups = []
        def apply():
            self.running = ops.read_image(self.env)
            if self.fail_new and self.running == NEW:
                raise RuntimeError("new container unhealthy")
        for name, replacement in {
            "running_image": lambda: self.running,
            "latest_sha": lambda: SHA,
            "pull": lambda image: None,
            "backup": lambda: self.backups.append("mysql/backup.gz") or "mysql/backup.gz",
            "apply": apply,
            "healthy": lambda: None,
        }.items():
            patcher = patch.object(self.ops, name, replacement)
            patcher.start()
            self.addCleanup(patcher.stop)

    def test_success_records_backup_and_keeps_secrets(self):
        self.ops.deploy(SHA)
        self.assertEqual(self.running, NEW)
        self.assertEqual(self.env.read_text(), "SECRET=keep-me\nBACKEND_IMAGE=" + NEW + "\n")
        self.assertEqual(self.ops.state()["backup"], "mysql/backup.gz")
        self.assertNotIn("pending", self.ops.state())

    def test_failed_backup_leaves_running_app_and_env_untouched(self):
        with patch.object(self.ops, "backup", side_effect=RuntimeError("S3 unavailable")):
            with self.assertRaises(RuntimeError):
                self.ops.deploy(SHA)
        self.assertEqual(self.running, OLD)
        self.assertEqual(ops.read_image(self.env), OLD)

    def test_unhealthy_release_restores_previous_image(self):
        self.fail_new = True
        with self.assertRaises(RuntimeError):
            self.ops.deploy(SHA)
        self.assertEqual(self.running, OLD)
        self.assertEqual(ops.read_image(self.env), OLD)
        self.assertEqual(self.ops.state()["rejected_sha"], SHA)
        self.assertNotIn("pending", self.ops.state())

    def test_changed_main_does_not_deploy_stale_release(self):
        with patch.object(self.ops, "latest_sha", return_value="c" * 40):
            self.ops.deploy(SHA)
        self.assertEqual(self.running, OLD)
        self.assertEqual(ops.read_image(self.env), OLD)

    def test_same_image_does_not_repeat_backup(self):
        self.running = NEW
        self.ops.deploy(SHA)
        self.assertEqual(self.backups, [])

    def test_rejected_release_is_not_retried_automatically(self):
        self.ops.save_state({"rejected_sha": SHA})
        self.ops.deploy(SHA)
        self.assertEqual(self.running, OLD)
        self.assertEqual(self.backups, [])

    def test_interrupted_deployment_recovers_on_next_run(self):
        ops.set_image(self.env, NEW)
        self.running = NEW
        self.ops.save_state({"pending": {"old_image": OLD, "sha": SHA}})
        self.ops.recover()
        self.assertEqual(self.running, OLD)
        self.assertEqual(ops.read_image(self.env), OLD)
        self.assertNotIn("pending", self.ops.state())

    def test_compose_quoted_image_can_be_updated_without_changing_secrets(self):
        for quote in ["'", chr(34)]:
            self.env.write_text("SECRET=keep-me\nBACKEND_IMAGE=" + quote + OLD + quote + "\n")
            self.assertEqual(ops.read_image(self.env), OLD)
            ops.set_image(self.env, NEW)
            self.assertEqual(ops.read_image(self.env), NEW)
            self.assertTrue(self.env.read_text().startswith("SECRET=keep-me\n"))

    def test_invalid_sha_rejected_before_changes(self):
        with self.assertRaises(ValueError):
            self.ops.deploy("main; command")
        self.assertEqual(self.running, OLD)

class CandidateTests(unittest.TestCase):
    def test_failed_or_skipped_image_is_not_deployable(self):
        for conclusion in ["failure", "skipped", None]:
            self.assertFalse(ops.image_succeeded({"jobs": [{"name": "image", "conclusion": conclusion}]}))
        self.assertTrue(ops.image_succeeded({"jobs": [{"name": "image", "conclusion": "success"}]}))

    def test_only_successful_main_workflow_of_exact_sha_matches(self):
        run = {"head_sha": SHA, "head_branch": "main", "event": "push", "status": "completed", "conclusion": "success"}
        self.assertTrue(ops.matches_run(run, SHA))
        for field, value in [("head_sha", "c" * 40), ("head_branch", "other"), ("event", "pull_request"), ("conclusion", "failure"), ("status", "in_progress")]:
            self.assertFalse(ops.matches_run({**run, field: value}, SHA))

if __name__ == "__main__":
    unittest.main()
