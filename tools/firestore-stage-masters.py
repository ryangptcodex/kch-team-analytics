"""Load an Apps Script master snapshot into an isolated Firestore staging collection."""
import argparse
import hashlib
import json
import math
import subprocess
import urllib.error
import urllib.request
from pathlib import Path

PROJECT = 'kch-team-analytics-production'
DATABASE = f'projects/{PROJECT}/databases/(default)'
URL = f'https://firestore.googleapis.com/v1/{DATABASE}/documents'
STAGING = f'{DATABASE}/documents/_kchSheetImports'
SCHEMAS = {
    'PRODUCTS': ('product_id product_name category unit brand min_stock status', ('product_id',)),
    'PRICE_MASTER': ('product_id product_name unit team_name cost_price selling_price shj status', ('product_id', 'team_name')),
    'DISTRIBUTORS': ('distributor_id distributor_name distributor_type status', ('distributor_id',)),
}


def canonical(value):
    return json.dumps(value, sort_keys=True, separators=(',', ':'), ensure_ascii=False, allow_nan=False).encode()


def firestore_value(value):
    if value is None:
        return {'nullValue': None}
    if isinstance(value, bool):
        return {'booleanValue': value}
    if isinstance(value, str):
        return {'stringValue': value}
    if isinstance(value, int) and -(2**63) <= value < 2**63:
        return {'integerValue': str(value)}
    if isinstance(value, float) and math.isfinite(value):
        return {'doubleValue': value}
    raise ValueError('Tipe data master tidak didukung.')


def plan(payload):
    if not isinstance(payload, dict) or payload.get('version') != 1 or payload.get('project') != PROJECT:
        raise ValueError('File harus berasal dari ekspor master Production versi 1.')
    tables = payload.get('tables')
    if not isinstance(tables, dict) or set(tables) != set(SCHEMAS):
        raise ValueError('File harus memuat tepat tiga tabel master yang diizinkan.')
    counts, entries = {}, []
    for table, (allowed, keys) in SCHEMAS.items():
        rows = tables[table]
        if not isinstance(rows, list) or not rows:
            raise ValueError(f'{table}: tabel kosong atau tidak valid.')
        counts[table] = len(rows)
        seen = set()
        for number, row in enumerate(rows, 1):
            if not isinstance(row, dict) or set(row) != set(allowed.split()):
                raise ValueError(f'{table} baris {number}: kolom tidak sesuai.')
            key = tuple(row[name].strip().upper() if isinstance(row[name], str) else '' for name in keys)
            if not all(key) or key in seen:
                raise ValueError(f'{table} baris {number}: kunci kosong atau ganda.')
            seen.add(key)
            identifier = hashlib.sha256(canonical(key)).hexdigest()
            fields = {name: firestore_value(value) for name, value in row.items()}
            entries.append((table, identifier, fields))
    if len(entries) > 449:
        raise ValueError('Snapshot melebihi kapasitas staging satu batch.')
    snapshot_id = hashlib.sha256(canonical(tables)).hexdigest()
    parent = f'{STAGING}/{snapshot_id}'
    manifest = {'source': 'production_master_staging_v1', 'row_count': len(entries), 'snapshot_id': snapshot_id}
    documents = [{'name': parent, 'fields': {k: firestore_value(v) for k, v in manifest.items()}}]
    documents.extend({'name': f'{parent}/{table}/{identifier}', 'fields': fields} for table, identifier, fields in entries)
    return snapshot_id, counts, documents


def api(token, endpoint, payload=None, missing_ok=False):
    request = urllib.request.Request(
        URL + endpoint, data=None if payload is None else canonical(payload),
        headers={'Authorization': f'Bearer {token}', 'Content-Type': 'application/json'})
    try:
        with urllib.request.urlopen(request, timeout=45) as response:
            return json.load(response)
    except urllib.error.HTTPError as err:
        if missing_ok and err.code == 404:
            return None
        raise RuntimeError(f'Firestore HTTP {err.code}. Periksa izin akun pada proyek Production.') from None


def verify(token, documents):
    names = [doc['name'] for doc in documents]
    response = api(token, ':batchGet', {'documents': names})
    found = {item['found']['name']: item['found']['fields'] for item in response if 'found' in item}
    if found != {doc['name']: doc['fields'] for doc in documents}:
        raise RuntimeError('Pembacaan ulang staging berbeda dari sumber.')
    return len(found) - 1


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('snapshot', type=Path)
    parser.add_argument('--write-staging', action='store_true')
    args = parser.parse_args()
    snapshot_id, counts, documents = plan(json.loads(args.snapshot.read_text(encoding='utf-8')))
    report = {'project': PROJECT, 'snapshot': snapshot_id, 'counts': counts}
    if args.write_staging:
        token = subprocess.check_output(['gcloud', 'auth', 'print-access-token'], text=True).strip()
        if not token:
            raise RuntimeError('Token akun Cloud Shell belum tersedia.')
        if api(token, f'/_kchSheetImports/{snapshot_id}', missing_ok=True) is None:
            api(token, ':commit', {'writes': [{'update': doc, 'currentDocument': {'exists': False}} for doc in documents]})
        report['verifiedRows'] = verify(token, documents)
        report['status'] = 'STAGING_VERIFIED'
    else:
        report['status'] = 'DRY_RUN'
    print(json.dumps(report))


if __name__ == '__main__':
    try:
        main()
    except (ValueError, OSError, RuntimeError, subprocess.CalledProcessError) as error:
        raise SystemExit(str(error)) from None
