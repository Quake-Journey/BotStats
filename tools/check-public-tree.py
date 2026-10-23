"""Check staged source paths and common secret formats without printing values."""
from pathlib import Path
import re
import subprocess
import sys

root = Path(__file__).resolve().parents[1]
files = subprocess.check_output(['git', 'ls-files', '-z'], cwd=root).decode().split('\0')
bad = []
patterns = [
    rb'gh[pousr]_[A-Za-z0-9]{30,}',
    rb'github_pat_[A-Za-z0-9_]{40,}',
    rb'AKIA[A-Z0-9]{16}',
    rb'\b[0-9]{8,12}:[A-Za-z0-9_-]{35}\b',
    rb'-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----',
    rb'mongodb(?:\+srv)?://[^\s/:]+:[^\s/@]+@',
]
for name in filter(None, files):
    path = Path(name)
    parts = set(path.parts)
    forbidden = (bool(parts & {'data', 'node_modules', 'runtime', 'bin', 'deploy'})
                 or name.endswith(('.local.json', '.production.json', '.log', '.mvd2', '.dm2', '.dmp', '.key', '.pem', '.pfx'))
                 or (path.name.startswith('.env') and path.name != '.env.example')
                 or name in {'local.json', 'config.json', 'importer.json', 'server.json'})
    if forbidden:
        bad.append((name, 'private/runtime path'))
        continue
    data = (root / name).read_bytes()
    if any(re.search(pattern, data) for pattern in patterns):
        bad.append((name, 'secret pattern'))
for name, reason in bad:
    print(f'{reason}: {name}')
print(f'Checked {sum(bool(f) for f in files)} tracked files; findings: {len(bad)}')
sys.exit(bool(bad))
