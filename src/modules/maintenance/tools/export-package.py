#!/usr/bin/env python3
"""Allowlisted, deterministic technical export. Never reads environment or business DBs."""
import argparse
import hashlib
import json
from pathlib import Path
import re
import subprocess
import zipfile

ROOT = Path(__file__).resolve().parents[4]
MODULE = 'src/modules/maintenance'
BASE = ROOT / MODULE
MANIFEST = BASE / 'spec/EXPORT_MANIFEST.json'
sha = lambda data: hashlib.sha256(data).hexdigest()


def regenerate():
    old = json.loads(MANIFEST.read_text())
    portable = sorted(str(p.relative_to(ROOT)) for p in BASE.rglob('*') if p.is_file()
                      and '/standalone/' not in str(p) and '/adapters/__tests__/' not in str(p)
                      and '__pycache__' not in str(p) and p.suffix != '.pyc')
    keys = sorted(re.findall(r'nc\(["\']([^"\']+)["\']\)', (BASE / 'adapters/icore/repositories.ts').read_text()))
    manifest = {
        'module': 'maintenance', 'contractVersion': old['contractVersion'],
        'formatVersion': 2, 'operations': len(keys), 'operationKeys': keys,
        'operationCounts': {k: sum(x.startswith(k + '.') for x in keys) for k in sorted({x.split('.')[0] for x in keys})},
        'capabilities': {'maintenance': False, 'corrective': False, 'metrology': False},
        'capabilityMeaning': 'Real ICORE adapter readiness, not exported SQL/UI availability; all remain disabled until destination acceptance.',
        'include': portable,
        'exclude': ['**/.git/**', '**/.env*', '**/node_modules/**', '**/dist/**', '**/__pycache__/**',
                    f'{MODULE}/adapters/standalone/**', f'{MODULE}/adapters/__tests__/**',
                    'src/routes/**', 'src/contexts/**', 'src/integrations/**', 'src/components/**',
                    'src/lib/**', 'src/router.tsx', 'drizzle/**', 'supabase/**', 'tests/sql/**',
                    'business database dumps, documents/files, organizations, people, sites, assets, plans, executions, incidents, histories'],
        'testOnly': [p for p in portable if '/__tests__/' in p],
        'hostProvides': old['hostProvides'] + ['MaintenanceUiProvider.RecordDocument', 'TanStack route wrappers, QueryClient, semantic styles'],
        'npm': old['npm'], 'env': [],
        'limitations': ['Real ICORE host/repositories unimplemented; skeleton rejects all operations.',
                        'SQL tests use a disposable host fixture; they do not prove real-host or browser integration.',
                        'Host documentation/configuration routes are excluded and mapped in INTEGRATION_HANDOFF.md.',
                        'Only frozen revision c15a30cf34e2ffc1e45ca2be14189d28359fff48 is a verified upgrade baseline.'],
        'seal': {'algorithm': 'SHA-256', 'envelopeFiles': ['SHA256SUMS', 'PACKAGE_RECEIPT.json'],
                 'payloadShaRule': 'SHA-256 of UTF-8 SHA256SUMS: one sorted line per included file: <sha>  <path>\\n',
                 'archiveSha': 'external .sha256 sidecar; never embedded in its own archive'},
    }
    MANIFEST.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n')
    print(f'Manifest: {len(portable)} files, {len(keys)} operations')


def seal(destination):
    manifest = json.loads(MANIFEST.read_text())
    files = manifest['include']
    if files != sorted(set(files)):
        raise ValueError('Manifest paths must be sorted and unique')
    payload = {}
    for name in files:
        path = ROOT / name
        if not name.startswith(MODULE + '/') or '/standalone/' in name or '..' in Path(name).parts or path.is_symlink():
            raise ValueError(f'Unsafe export entry: {name}')
        payload[name] = path.read_bytes()
    sums = ''.join(f'{sha(data)}  {name}\n' for name, data in payload.items()).encode()
    revision = subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=ROOT, text=True).strip()
    receipt = json.dumps({'sourceBaseCommit': revision, 'revisionMeaning': 'Base commit plus sealed working-tree payload; not a new Git commit.',
                          'payloadSha256': sha(sums), 'fileCount': len(files), 'operations': manifest['operations'],
                          'upgradeBaselineCommit': 'c15a30cf34e2ffc1e45ca2be14189d28359fff48',
                          'demoBusinessData': False, 'realIcoreAdapter': False}, ensure_ascii=False, indent=2).encode() + b'\n'
    output = Path(destination)
    output.mkdir(parents=True, exist_ok=True)
    archive = output / f'maintenance-handoff-{sha(sums)[:16]}.zip'
    with zipfile.ZipFile(archive, 'w', zipfile.ZIP_DEFLATED, compresslevel=9) as z:
        for name, data in {**payload, 'SHA256SUMS': sums, 'PACKAGE_RECEIPT.json': receipt}.items():
            info = zipfile.ZipInfo(name, (1980, 1, 1, 0, 0, 0))
            info.external_attr = 0o100644 << 16
            info.compress_type = zipfile.ZIP_DEFLATED
            z.writestr(info, data)
    digest = sha(archive.read_bytes())
    archive.with_suffix('.zip.sha256').write_text(f'{digest}  {archive.name}\n')
    print(json.dumps({'archive': str(archive), 'archiveSha256': digest, 'payloadSha256': sha(sums), 'fileCount': len(files)}, indent=2))


def verify(archive):
    with zipfile.ZipFile(archive) as z:
        names = z.namelist()
        if len(names) != len(set(names)) or any('..' in Path(n).parts or n.startswith('/') for n in names):
            raise ValueError('Unsafe or duplicate ZIP entries')
        sums = z.read('SHA256SUMS')
        receipt = json.loads(z.read('PACKAGE_RECEIPT.json'))
        if sha(sums) != receipt['payloadSha256']:
            raise ValueError('Receipt mismatch')
        payload_names = []
        for line in sums.decode().splitlines():
            digest, name = line.split('  ', 1)
            if sha(z.read(name)) != digest:
                raise ValueError(f'Hash mismatch: {name}')
            payload_names.append(name)
        manifest = json.loads(z.read(MODULE + '/spec/EXPORT_MANIFEST.json'))
        if payload_names != manifest['include'] or sorted(names) != sorted(payload_names + ['SHA256SUMS', 'PACKAGE_RECEIPT.json']):
            raise ValueError('Manifest/ZIP coverage mismatch')
        print(f'VERIFIED {len(payload_names)} payload files; SHA-256 {receipt["payloadSha256"]}')


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--manifest', action='store_true')
    parser.add_argument('--seal', metavar='OUTPUT_DIRECTORY')
    parser.add_argument('--verify', metavar='ZIP')
    args = parser.parse_args()
    if args.manifest: regenerate()
    if args.seal: seal(args.seal)
    if args.verify: verify(args.verify)