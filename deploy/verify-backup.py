"""Restore a selected S3 backup into a temporary MySQL container, never production."""
import argparse
import gzip
import hashlib
import json
import os
from pathlib import Path
import re
import secrets
import shutil
import subprocess
import sys
import tempfile
import time
import uuid


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("key", help="S3 key under mysql/, from the backup journal")
    args = parser.parse_args()
    if not args.key.startswith("mysql/") or not args.key.endswith(".sql.gz"):
        parser.error("Expected mysql/...sql.gz")
    os.umask(0o077)
    import boto3
    from botocore.config import Config
    config = json.loads(Path("/etc/musicpets-ops.json").read_text())
    s3 = boto3.client("s3", region_name=config["region"], config=Config(
        retries={"mode": "standard", "total_max_attempts": 3}, connect_timeout=5, read_timeout=60))
    container = "musicpets-restore-check-" + uuid.uuid4().hex[:12]
    def run(command, **kwargs):
        return subprocess.run(command, check=True, stdout=subprocess.PIPE,
                              stderr=subprocess.PIPE, timeout=300, **kwargs)
    try:
        with tempfile.TemporaryDirectory(prefix="musicpets-restore-check-") as directory:
            root = Path(directory)
            packed, plain, env = root / "backup.sql.gz", root / "backup.sql", root / ".env"
            s3.download_file(config["backup_bucket"], args.key, str(packed))
            digest = hashlib.sha256(packed.read_bytes()).hexdigest()
            expected = s3.head_object(Bucket=config["backup_bucket"], Key=args.key)["Metadata"]["sha256"]
            if digest != expected:
                raise RuntimeError("Backup checksum mismatch")
            with gzip.open(packed, "rb") as source, plain.open("wb") as target:
                shutil.copyfileobj(source, target)
            table_count = len(re.findall(rb"^CREATE TABLE ", plain.read_bytes(), re.MULTILINE))
            if table_count == 0:
                raise RuntimeError("Backup has no tables")
            env.write_text("MYSQL_ROOT_PASSWORD=" + secrets.token_urlsafe(32) + "\n")
            run(["docker", "run", "-d", "--rm", "--name", container, "--network", "none",
                 "--memory", "512m", "--env-file", str(env), "mysql:8.0.43",
                 "--innodb-buffer-pool-size=64M", "--performance-schema=OFF", "--max-connections=5"])
            sql = ['docker', 'exec', '-i', container, 'sh', '-c',
                   'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" exec mysql --protocol=TCP -h127.0.0.1 -uroot -N -B']
            for attempt in range(60):
                try:
                    run(sql, input=b"SELECT 1;")
                    break
                except subprocess.CalledProcessError:
                    time.sleep(2)
            else:
                raise RuntimeError("Restore test MySQL did not start")
            with plain.open("rb") as source:
                run(sql, stdin=source)
            actual = int(run(sql, input=b"SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='musicpets' AND table_type='BASE TABLE';").stdout.strip())
            if actual != table_count:
                raise RuntimeError("Restored table count mismatch")
            run(sql, input=b"SELECT COUNT(*) FROM musicpets.flyway_schema_history WHERE success=1;")
            print(json.dumps({"checksum": "verified", "restore": "passed", "tables": actual,
                              "isolated_container": container, "production_database": "untouched"}))
            return 0
    except Exception as error:
        print("Restore verification failed: " + type(error).__name__, file=sys.stderr)
        return 1
    finally:
        # Only the randomly named disposable container and its anonymous volume.
        subprocess.run(["docker", "rm", "-f", "-v", container], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=60)


if __name__ == "__main__":
    sys.exit(main())
