#!/usr/bin/env python3
"""Build the owner's local Explore/search sidecar for the identified Scaler 3 install."""

import argparse
from collections import defaultdict
from hashlib import sha256
import json
import mmap
import os
from pathlib import Path
from tempfile import NamedTemporaryFile

SOURCE = Path('/Library/Audio/Plug-Ins/VST3/Scaler 3.vst3/Contents/MacOS/Scaler 3')
DEST = Path.home() / 'Library/Application Support/Crest Composer/Local Bank'
DIGEST = 'ee469bd2458668d7740c38df51f3caca97f2b4b48111b3a4ec80a4a3cfef8fb0'
EXPLORE_RANGE = slice(44018208, 44115068)
CHORD_RANGE = slice(43144448, 43244032)


def semitone(degree):
    number = int(degree.strip('b#')) - 1
    return 12 * (number // 7) + (0, 2, 4, 5, 7, 9, 11)[number % 7] + degree.count('#') - degree.count('b')


def chord_dictionary(source):
    """Keep the full search formula; index optional-tone subsets separately for naming."""
    formulas, signatures = [], defaultdict(list)
    for order, (name, item) in enumerate(source.items()):
        steps = [semitone(d) for d in item['formula']]
        suffix = name.replace('min', 'm')
        formulas.append(dict(suffix=suffix, steps=sorted(set(steps))))
        add_signatures(signatures, steps, item['optional'], suffix, order)
    return formulas, signatures


def add_signatures(signatures, steps, optional, suffix, order):
    for bits in range(1 << len(optional)):
        omitted = {index for bit, index in enumerate(optional) if bits & (1 << bit)}
        classes = frozenset(step % 12 for i, step in enumerate(steps) if i not in omitted)
        signatures[classes].append((len(omitted), len(suffix), order, suffix))


def identify(notes, signatures):
    """Infer a label; never alter stored pitches to fit it. A blank match is meaningful."""
    matches = []
    bass = notes[0] % 12
    for root in sorted({n % 12 for n in notes}):
        classes = frozenset((n - root) % 12 for n in notes)
        for missing, complexity, order, suffix in signatures[classes]:
            matches.append((missing, complexity, root != bass, order, root, suffix))
    if not matches:
        return bass, ' voicing'
    return min(matches)[-2:]


def make_slot(voicing, signatures):
    notes = [60 + n for n in voicing['intervals']]
    if notes != sorted(set(notes)) or not (0 < notes[0] <= notes[-1] < 128):
        raise ValueError('Unexpected Explore pitches')
    root, suffix = identify(notes, signatures)
    return dict(root=root, suffix=suffix, notes=notes)


def make_preset(record, signatures):
    slots = [make_slot(v, signatures) for v in record['voicings']]
    if len(slots) != 16:
        raise ValueError('Unexpected constellation topology')
    return dict(id=record['uuid'], name=record['name'], genre=record['category'],
                mood=record['type'].capitalize(), slots=slots)


def build(source):
    with source.open('rb') as f, mmap.mmap(f.fileno(), 0, access=mmap.ACCESS_READ) as data:
        actual = sha256(data).hexdigest()
        if actual != DIGEST:
            raise ValueError(f'Unrecognized Scaler 3 build: {actual}; expected {DIGEST}')
        formulas, signatures = chord_dictionary(json.loads(data[CHORD_RANGE]))
        presets = [make_preset(r, signatures) for r in json.loads(data[EXPLORE_RANGE])['Explore']]
    if len({(p['genre'], p['mood']) for p in presets}) != 81 or len(formulas) != 253:
        raise ValueError('Unexpected Atlas inventory')
    return dict(version=1, source=actual, formulas=formulas, presets=presets)


def publish(path, document):
    """An exclusive hard link publishes all bytes at once, never replacing an existing file."""
    payload = (json.dumps(document, separators=(',', ':'), ensure_ascii=False) + '\n').encode()
    path.parent.mkdir(parents=True, exist_ok=True)
    with NamedTemporaryFile(dir=path.parent, prefix='.atlas-') as staged:
        staged.write(payload)
        staged.flush()
        try:
            os.link(staged.name, path)
        except FileExistsError:
            if (path.is_symlink() or not path.is_file() or path.stat().st_size != len(payload)
                    or path.read_bytes() != payload):
                raise ValueError(f'Refusing to overwrite {path}') from None
    return sha256(payload).hexdigest()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source', type=Path, default=SOURCE)
    parser.add_argument('--output', type=Path, default=DEST, help='local bank directory outside this repository')
    args = parser.parse_args()
    folder = args.output.expanduser().resolve()
    if folder.is_relative_to(Path(__file__).resolve().parents[2]):
        parser.error('Choose a local bank outside the repository')
    try:
        digest = publish(folder / 'atlas-v1.json', build(args.source))
    except (OSError, ValueError) as error:
        parser.exit(1, f'{error}\n')
    print(f'81 constellations, 1,296 voiced chords, 253 search formulas: {folder}/atlas-v1.json\nSHA-256 {digest}')


if __name__ == '__main__':
    main()
