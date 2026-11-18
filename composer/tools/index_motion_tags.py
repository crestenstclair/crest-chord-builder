#!/usr/bin/env python3
"""Add optional Scaler 3 mood/genre filters to an existing Crest local bank.

The 3.4.0 tagging_json resource has display strings, not UUIDs. Accept only
one-to-one (family, name) matches against this build's ExpressionsData ZIP.
Normalise case, whitespace, and Colour/Color spelling. Do not propagate a tag
to numbered children, guess misspellings, or label S2-only templates.
"""

import argparse
from collections import defaultdict
import hashlib
import json
from pathlib import Path

from index_scaler import BUILDS, DEFAULT_OUTPUT, INSTALL_ROOT, existing_bytes, publish, read_build


TAG_RANGE = (41848288, 42675871)
TAG_SHA256 = 'aa50cb889073f40a36b5c414b742ed77310834e555a651c197a0d4240da90316'
FAMILY = {'Performance': 'Performances', 'Phrase': 'Phrases', 'Current Rhythm': 'Rhythms',
          'Melody': 'Melody', 'Bass': 'Bass', 'Passages': 'Passages', 'Sequences': 'Sequences',
          'Strummed Sequences': 'StrummedSequences'}


def name_key(name):
    return ' '.join(name.casefold().replace('colour', 'color').split())


def split_tags(cell):
    return sorted({s.strip() for s in (cell or '').split(',') if s.strip()}, key=str.casefold)


def unique_matches(table, records):
    tags, ids = defaultdict(list), defaultdict(list)
    for row in table:
        if row['Type'] in FAMILY and row['Name']:
            tags[(FAMILY[row['Type']], name_key(row['Name']))].append(row)
    for record in records:
        ids[(record['folder'], name_key(record['name']))].append(record['uuid'])
    matches = []
    for key, rows in tags.items():
        if len(rows) == len(ids[key]) == 1:
            matches.append({'id': ids[key][0], 'genres': split_tags(rows[0]['Genre']),
                            'moods': split_tags(rows[0]['Feel/Mood'])})
    return sorted(matches, key=lambda r: r['id'])


def install(output):
    output = output.expanduser().resolve()
    repo = Path(__file__).resolve().parents[2]
    if output == repo or repo in output.parents or not (output / 'index.json').is_file():
        raise ValueError('Choose an existing local bank directory outside the repository.')
    build = BUILDS[0]
    _, records = read_build(build, INSTALL_ROOT)  # verifies full executable before reading its ZIP
    with build.executable(INSTALL_ROOT).open('rb') as binary:
        binary.seek(TAG_RANGE[0])
        blob = binary.read(TAG_RANGE[1] - TAG_RANGE[0])
    if hashlib.sha256(blob).hexdigest() != TAG_SHA256:
        raise ValueError('Installed tag table digest does not match the verified build.')
    rows = unique_matches(json.loads(blob), records)
    data = {'version': 1, 'tagTable': TAG_SHA256, 'rows': rows}
    dest = output / 'motion-tags.json'
    content = (json.dumps(data, ensure_ascii=False, separators=(',', ':')) + '\n').encode()
    previous = existing_bytes(dest)
    if previous is None:
        publish(dest, content)
    elif previous != content:
        raise ValueError(f'Refusing to overwrite different file: {dest}')
    print(f'{len(rows)} unambiguous tags for {len(records)} Scaler 3 motions: {dest}')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', type=Path, default=DEFAULT_OUTPUT, help='existing local bank directory')
    try:
        install(parser.parse_args().output)
    except (OSError, ValueError) as err:
        parser.exit(1, f'index_motion_tags: {err}\n')
