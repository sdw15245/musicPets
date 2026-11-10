"""Host-only database backups and pull deployment. No AWS keys or SSH keys in CI."""
import argparse
import gzip
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import sys
import tempfile
import time
from datetime import datetime, timezone
from urllib.request import Request, urlopen

IMAGE_PREFIX = "sdw0501/musicpets:sha-"


def image_for(sha):
    if not re.fullmatch(r"[0-9a-f]{40}", sha):
        raise ValueError("Expected a full commit SHA")
    return IMAGE_PREFIX + sha


def read_image(path):
    values = re.findall(r"^BACKEND_IMAGE=(.+)$", path.read_text(), re.MULTILINE)
    if len(values) != 1:
        raise ValueError("Expected exactly one BACKEND_IMAGE")
    image = values[0].strip()
    if len(image) >= 2 and image[0] == image[-1] and image[0] in ("'", chr(34)):
        image = image[1:-1]
    if not image.startswith(IMAGE_PREFIX):
        raise ValueError("Expected a SHA-pinned BACKEND_IMAGE")
    image_for(image[len(IMAGE_PREFIX):])
    return image



def atomic_write(path, text):
    path.parent.mkdir(mode=0o700, parents=True, exist_ok=True)
    fd, name = tempfile.mkstemp(dir=path.parent)
    try:
        with os.fdopen(fd, "w", encoding="utf-8", newline="\n") as target:
            target.write(text)
            target.flush()
            os.fsync(target.fileno())
        os.replace(name, path)
    finally:
        if os.path.exists(name):
            os.unlink(name)


def set_image(path, image):
    image_for(image.removeprefix(IMAGE_PREFIX))
    read_image(path)
    atomic_write(path, re.sub(r"^BACKEND_IMAGE=.+$", "BACKEND_IMAGE=" + image,
                             path.read_text(), flags=re.MULTILINE))


def matches_run(run, sha):
    return (run.get("head_sha") == sha and run.get("head_branch") == "main"
            and run.get("event") in ("push", "workflow_dispatch")
            and run.get("status") == "completed" and run.get("conclusion") == "success")


def image_succeeded(response):
    return any(job.get("name") == "image" and job.get("conclusion") == "success"
               for job in response.get("jobs", []))


class Operations:
    def __init__(self, config):
        self.config = config
        self.app = Path(config["app_dir"])
        self.env = self.app / "deploy/.env"
        self.state_path = Path(config["state_dir"]) / "deployment.json"
        self.compose = ["docker", "compose", "--env-file", str(self.env),
                        "-f", str(self.app / "compose.production.yaml"),
                        "-f", str(self.app / "deploy/compose.https.yaml"),
                        "-p", "musicpets-production"]
        self._s3 = None

    def run(self, args, timeout=300, stdout=subprocess.PIPE):
        # Capture diagnostics: compose may interpolate secrets into errors.
        return subprocess.run(args, cwd=self.app, check=True, timeout=timeout,
                              stdout=stdout, stderr=subprocess.PIPE)

    def state(self):
        return json.loads(self.state_path.read_text()) if self.state_path.exists() else {}

    def save_state(self, state):
        atomic_write(self.state_path, json.dumps(state, indent=2) + "\n")

    def api(self, path):
        request = Request("https://api.github.com/repos/sdw15245/musicPets/" + path,
                          headers={"User-Agent": "MusicPets-EC2", "Accept": "application/vnd.github+json"})
        with urlopen(request, timeout=20) as response:
            return json.load(response)

    def latest_sha(self):
        sha = self.api("branches/main")["commit"]["sha"]
        image_for(sha)
        return sha

    def running_image(self):
        container = self.run(self.compose + ["ps", "-q", "backend"]).stdout.decode().strip()
        if not container:
            raise RuntimeError("No running backend to preserve")
        image = self.run(["docker", "inspect", "--format", "{{.Config.Image}}", container]).stdout.decode().strip()
        image_for(image.removeprefix(IMAGE_PREFIX))
        return image

    def pull(self, image):
        self.run(["docker", "pull", image], timeout=600)

    def apply(self):
        self.run(self.compose + ["up", "-d", "--no-deps", "--wait", "--wait-timeout", "180", "backend"], timeout=260)

    def healthy(self):
        # Check routing and database access, in addition to Compose readiness.
        for attempt in range(12):
            try:
                with urlopen("https://musicpets.duckdns.org/api/posts?page=0&size=1", timeout=10) as response:
                    if response.status == 200 and isinstance(json.load(response), (dict, list)):
                        return
            except (OSError, ValueError):
                pass
            time.sleep(5)
        raise RuntimeError("Public API health check failed")

    def s3(self):
        if self._s3 is None:
            import boto3
            from botocore.config import Config
            self._s3 = boto3.client("s3", region_name=self.config["region"], config=Config(
                retries={"mode": "standard", "total_max_attempts": 3}, connect_timeout=5, read_timeout=60))
        return self._s3

    def backup(self):
        from boto3.s3.transfer import TransferConfig
        stamp = datetime.now(timezone.utc).strftime("%Y/%m/%d/%Y%m%dT%H%M%S%fZ")
        key = "mysql/" + stamp + ".sql.gz"
        bucket = self.config["backup_bucket"]
        # Neither the database password nor SQL contents leave the private temp directory.
        with tempfile.TemporaryDirectory(prefix="musicpets-backup-") as directory:
            plain = Path(directory) / "dump.sql"
            packed = Path(directory) / "dump.sql.gz"
            with plain.open("wb") as output:
                self.run(self.compose + ["exec", "-T", "mysql", "sh", "-c",
                    'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" exec mysqldump -uroot --single-transaction '
                    '--quick --routines --events --triggers --no-tablespaces --set-gtid-purged=OFF '
                    '--hex-blob --databases musicpets'], stdout=output)
            if plain.stat().st_size == 0:
                raise RuntimeError("Empty database dump")
            with plain.open("rb") as source, gzip.open(packed, "wb") as target:
                shutil.copyfileobj(source, target)
            digest = hashlib.sha256()
            with packed.open("rb") as source:
                for chunk in iter(lambda: source.read(1024 * 1024), b""):
                    digest.update(chunk)
            self.s3().upload_file(str(packed), bucket, key,
                ExtraArgs={"ServerSideEncryption": "AES256", "Metadata": {"sha256": digest.hexdigest()}},
                Config=TransferConfig(max_concurrency=2))
            head = self.s3().head_object(Bucket=bucket, Key=key)
            if head["ContentLength"] != packed.stat().st_size or head["Metadata"].get("sha256") != digest.hexdigest():
                raise RuntimeError("Uploaded backup verification failed")
        print("Backup verified: " + key, flush=True)
        return key

    def recover(self):
        state = self.state()
        pending = state.get("pending")
        if pending:
            set_image(self.env, pending["old_image"])
            self.apply()
            self.healthy()
            state.pop("pending")
            state["rejected_sha"] = pending["sha"]
            self.save_state(state)
            print("Restored previous backend image", flush=True)

    def deploy(self, sha):
        image = image_for(sha)
        state = self.state()
        old = self.running_image()
        if old == image or state.get("rejected_sha") == sha:
            return
        if read_image(self.env) != old:
            raise RuntimeError("Configured and running images differ; reconcile manually")
        self.pull(image)
        backup = self.backup()
        if self.latest_sha() != sha:
            print("Main changed during preparation; waiting for next check", flush=True)
            return
        state["pending"] = {"old_image": old, "sha": sha}
        self.save_state(state)
        try:
            set_image(self.env, image)
            self.apply()
            self.healthy()
        except Exception:
            self.recover()
            raise
        self.save_state({"image": image, "previous_image": old, "sha": sha, "backup": backup,
                         "deployed_at": datetime.now(timezone.utc).isoformat()})
        print("Deployed healthy backend: " + image, flush=True)

    def poll(self):
        self.recover()
        sha = self.latest_sha()
        if self.running_image() == image_for(sha) or self.state().get("rejected_sha") == sha:
            return
        runs = self.api("actions/workflows/ci.yaml/runs?branch=main&head_sha=" + sha + "&per_page=10")
        for run in runs.get("workflow_runs", []):
            if matches_run(run, sha) and image_succeeded(self.api("actions/runs/" + str(int(run["id"])) + "/jobs?per_page=100")):
                self.deploy(sha)
                return


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("command", choices=("backup", "poll"))
    parser.add_argument("--config", default="/etc/musicpets-ops.json")
    args = parser.parse_args()
    os.umask(0o077)
    import fcntl
    with open("/var/lock/musicpets-ops.lock", "w") as lock:
        try:
            fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            print("Another backup/deployment is running; skipping")
            return 0
        try:
            operations = Operations(json.loads(Path(args.config).read_text()))
            getattr(operations, args.command)()
            return 0
        except Exception as error:
            # Never expose HTTP payloads, container diagnostics or credentials in journals.
            print("Operation failed: " + type(error).__name__, file=sys.stderr)
            return 1


if __name__ == "__main__":
    sys.exit(main())
