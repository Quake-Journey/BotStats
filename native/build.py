"""Build the standalone MVD fact decoder; requires Python 3 and GCC."""
import argparse
import json
import os
from pathlib import Path
import subprocess

root = Path(__file__).resolve().parent
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--cc', default=os.environ.get('CC', 'gcc'))
parser.add_argument('--output', type=Path, default=root.parent / 'bin' / ('mvd-decoder.exe' if os.name == 'nt' else 'mvd-decoder'))
args = parser.parse_args()
args.output = args.output.resolve()
args.output.parent.mkdir(parents=True, exist_ok=True)
sources = json.loads((root / 'sources.json').read_text())['sources']
command = [args.cc, '-std=c17', '-O2', '-flto', '-Wall', '-Wextra',
           '-ffunction-sections', '-fdata-sections', '-Wl,--gc-sections',
           '-I' + str(root / 'inc'), '-DUSE_LITTLE_ENDIAN=1',
           '-DUSE_CLIENT=1', '-DUSE_SERVER=0', '-DUSE_NEW_GAME_API=1',
           '-DUSE_MVD_CLIENT=1']
if os.name == 'nt':
    command.append('-Wl,--no-insert-timestamp')
command += [str(root / source) for source in sources] + ['-o', str(args.output), '-lm']
subprocess.run(command, check=True)
print(args.output)
