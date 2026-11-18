#!/usr/bin/env python3
"""Index verified, locally installed Scaler VST3 banks for Crest Composer (macOS)."""

import argparse
from collections import defaultdict
from dataclasses import dataclass
import hashlib
import io
import json
import os
from pathlib import Path
import re
import struct
import tempfile
import uuid
import zipfile


INSTALL_ROOT = Path('/Library/Audio/Plug-Ins/VST3')
DEFAULT_OUTPUT = Path.home() / 'Library/Application Support/Crest Composer/Local Bank'
OWNER = '.crest-scaler-index.sha256'


@dataclass(frozen=True)
class Build:
    name: str
    version: str
    sha256: str
    zip_range: tuple
    chord_range: tuple

    def executable(self, root):
        return root / (self.name + '.vst3') / 'Contents/MacOS' / self.name


# A digest pins both ranges; never guess offsets for a different release.
BUILDS = (
    Build('Scaler 3', '3.4.0', 'ee469bd2458668d7740c38df51f3caca97f2b4b48111b3a4ec80a4a3cfef8fb0',
          (40524144, 41759872), (43244048, 44018196)),
    Build('Scaler2', '2.8.1', '225097845ed9603d13c23538598e75bc4f22cf15541568a4d68d2e9bdd84544d',
          (40710640, 41538117), (41932944, 42290395)),
)


def read_range(stream, bounds):
    start, end = bounds
    stream.seek(start)
    return stream.read(end - start)


def read_build(build, root):
    path = build.executable(root)
    with path.open('rb') as stream:
        digest = hashlib.sha256()
        for chunk in iter(lambda: stream.read(1 << 20), b''):
            digest.update(chunk)
        if digest.hexdigest() != build.sha256:
            raise ValueError(f'Unsupported {path}: SHA-256 {digest.hexdigest()}; expected '
                             f'{build.version} ({build.sha256}). No bank written.')
        chord_bank = json.loads(read_range(stream, build.chord_range))
        archive = read_range(stream, build.zip_range)
    with zipfile.ZipFile(io.BytesIO(archive)) as bank:
        members = [i for i in bank.infolist() if i.filename.endswith('.json')
                   and not i.filename.startswith('__MACOSX/') and i.filename != 'expressions.json']
        return chord_bank, [json.loads(bank.read(i)) for i in members]


def installed_builds(root=INSTALL_ROOT):
    builds = [b for b in BUILDS if (root / (b.name + '.vst3')).exists()]
    if not builds:
        raise ValueError(f'No Scaler 3 or Scaler2 VST3 installed in {root}.')
    return builds


def delta_ticks(value):
    if not 0 <= value <= 0x0fffffff:
        raise ValueError(f'MIDI delta outside four-byte range: {value}')
    parts = [value & 127]
    value >>= 7
    while value:
        parts.append((value & 127) | 128)
        value >>= 7
    return bytes(reversed(parts))


PITCHED_CHANNELS = tuple(c for c in range(16) if c != 9)  # GM channel 10 = drums


def midi_edges(data):
    """Use extra channels only for overlapping same-pitch notes, never shorten a release."""
    end_tick = data['metaData']['lastPosition']
    releases = defaultdict(dict)  # pitch -> channel -> last release tick
    edges = []
    for event in sorted(data['events'], key=lambda e: (e['position'], e['noteId'])):
        start, pitch, velocity = event['position'], event['noteNumber'], event['velocity']
        end = start + max(1, event['duration'])
        if not 0 <= start < end <= end_tick:
            raise ValueError(f'Note outside declared cycle: {start}..{end} of {end_tick}')
        held = releases[pitch]
        channel = next((c for c in PITCHED_CHANNELS if held.get(c, 0) <= start), None)
        if channel is None:
            raise ValueError('Too many overlapping notes of one pitch for a pitched MIDI file')
        held[channel] = end
        edges.extend([(start, 0x90 | channel, pitch, velocity), (end, 0x80 | channel, pitch, 0)])
    return sorted(edges)  # all releases sort before attacks at the same tick


def mapping_event(motion):
    """SMF tick-zero sequencer metadata for the two recovered Scaler selectors."""
    family = {'Performances': 1, 'Grooves': 1, 'Rhythms': 2}.get(motion['folder'])
    if family is None:
        return b''
    data = motion['expressionsData']
    palette = data['metaData']['allNotesNumber']
    if not 1 <= len(palette) <= 127 or any(not 0 <= pitch <= 127 for pitch in palette):
        raise ValueError('Unrepresentable CRESTMAP1 palette')
    payload = bytearray(b'CRESTMAP1')
    payload.extend(struct.pack('>BbB', family, motion['octaveDiff'], len(palette)))
    payload.extend(palette)  # first-appearance order is significant
    payload.extend(struct.pack('>I', len(data['events'])))
    for e in data['events']:  # source order, including simultaneous, unsorted and duration-zero events
        idx, velocity = e['noteIndex'], e['velocity']
        if not 0 <= idx < len(palette) or palette[idx] != e['noteNumber'] or not 1 <= velocity <= 127:
            raise ValueError('Invalid CRESTMAP1 note selector or velocity')
        payload.extend(struct.pack('>IIBB', e['position'], e['duration'], idx, velocity))
    return b'\0\xff\x7f' + delta_ticks(len(payload)) + payload


def motion_midi(data, mapping=b''):
    meta = data['metaData']
    meter = meta['timeSignature']
    denominator = meter['denominator']
    if denominator <= 0 or denominator & (denominator - 1):
        raise ValueError(f'Cannot express denominator {denominator} in a MIDI time signature')
    track = bytearray([0, 0xff, 0x58, 4, meter['numerator'], denominator.bit_length()-1, 24, 8])
    if 'microsecondsPerBeat' in meta:
        track.extend(b'\0\xff\x51\x03' + meta['microsecondsPerBeat'].to_bytes(3, 'big'))
    track.extend(mapping)
    tick = 0
    for when, status, pitch, velocity in midi_edges(data):
        track.extend(delta_ticks(when - tick) + bytes((status, pitch, velocity)))
        tick = when
    track.extend(delta_ticks(meta['lastPosition'] - tick) + b'\xff\x2f\0')
    header = struct.pack('>4sIHHH', b'MThd', 6, 0, 1, meta['ticksPerBeat'])
    return header + struct.pack('>4sI', b'MTrk', len(track)) + track


MAJOR = (0, 2, 4, 5, 7, 9, 11)
MINOR = (0, 2, 3, 5, 7, 8, 10)
DEGREES = ('I', 'II', 'III', 'IV', 'V', 'VI', 'VII')
PITCH_NAMES = ('C', 'Db', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B')
QUALITY = {(0,3,7): 'm', (0,4,7): '', (0,3,6): 'dim', (0,4,8): 'aug',
           (0,2,7): 'sus2', (0,5,7): 'sus4', (0,3,7,10): 'm7', (0,4,7,10): '7',
           (0,4,7,11): 'maj7', (0,3,6,10): 'm7b5', (0,3,6,9): 'dim7',
           (0,4,7,9): '6', (0,3,7,9): 'm6', (0,2,4,7): 'add9', (0,2,3,7): 'm(add9)',
           (0,2,4,7,11): 'maj9', (0,2,3,7,10): 'm9', (0,2,4,7,10): '9'}


def chord_slot(voicing, root, degree):
    notes = [60 + interval for interval in voicing['intervals']]
    formula = tuple(sorted({(pitch-root) % 12 for pitch in notes}))
    if formula in QUALITY:
        name = PITCH_NAMES[root] + QUALITY[formula]
        bass = min(notes) % 12
        if bass != root:
            name += '/' + PITCH_NAMES[bass]
    else:
        name = f'{PITCH_NAMES[root]} ({degree})'  # no guessed quality for an ambiguous shape
    return {'root': root, 'name': name, 'notes': notes}


def inferred_root(degree, tonic, triad):
    scale = MINOR if tonic == 9 else MAJOR
    candidate = (tonic + scale[DEGREES.index(degree.rstrip('7').upper())]) % 12
    pitches = [n % 12 for n in triad['intervals']]
    # The bank's VII in I-VII-I is actually a bVII triad. Consult the pitched
    # reference variant before applying the same root to all that family's colors.
    return candidate if candidate in pitches else pitches[0]


def common_progressions(bank):
    rows = [s for s in bank['Song Sets'] if s['subfolder'] == 'Common Progressions']
    references = {group: s['voicings'] for s in rows
                  for style, group in [split_title(s['name'])] if style == 'Triads'}
    return [progression_entry(row, references) for row in rows]


def split_title(title):
    match = re.fullmatch(r'(.+) \(([^()]+)\)', title)
    if not match:
        raise ValueError(f'Missing Roman-numeral group in {title!r}')
    return match.groups()


def progression_entry(row, references):
    _, group = split_title(row['name'])
    degrees = group.split('-')
    tonic = 9 if degrees[0] == 'i' else 0
    if not len(degrees) == len(references[group]) == len(row['voicings']):
        raise ValueError(f'Unaligned progression slots: {row["name"]}')
    slots = [chord_slot(v, inferred_root(degree, tonic, reference), degree)
             for v, degree, reference in zip(row['voicings'], degrees, references[group])]
    return {'id': row['uuid'], 'name': row['name'], 'group': group, 'tonic': tonic, 'slots': slots}


def color_entry(row):
    # These particular factory rows ascend C major or C natural minor; eight-slot rows
    # return to degree I. The key is inferred, not a promise about Scaler transposition.
    pitches = [n % 12 for v in row['voicings'] for n in v['intervals']]
    scale = min((MAJOR, MINOR), key=lambda s: sum(p not in s for p in pitches))
    slots = [chord_slot(v, scale[i % 7], DEGREES[i % 7]) for i,v in enumerate(row['voicings'])]
    return {'name': row['name'], 'slots': slots}


def add_motions(records, motions, files, predecessors):
    for motion in records:
        key = str(uuid.UUID(motion['uuid']))  # canonical UUID only, never an asset-supplied filename
        if key in motions:
            continue
        path = f'motions/{key}.mid'
        family = motion['folder']
        motions[key] = {'id': key, 'name': motion['name'],
                        'family': 'Performances' if family == 'Grooves' else family,
                        'group': motion['subfolder'], 'midi': path}
        data = motion['expressionsData']
        mapping = mapping_event(motion)
        if mapping:
            # A byte-identical earlier export is the only MIDI eligible for replacement.
            predecessors[path] = motion_midi(data)
        files[path] = motion_midi(data, mapping)


def generate_bank(root=INSTALL_ROOT):
    builds = installed_builds(root)  # most recent first; retain its metadata on shared UUIDs
    motions, files, predecessors = {}, {}, {}
    chord_bank = None
    for build in builds:
        chords, records = read_build(build, root)
        if chord_bank is None:
            chord_bank = chords
        add_motions(records, motions, files, predecessors)
    index = {'version': 1,
             'motions': sorted(motions.values(), key=lambda r: (r['family'],r['group'],r['name'],r['id'])),
             'progressions': sorted(common_progressions(chord_bank), key=lambda r: (r['group'],r['name'])),
             'colors': [color_entry(row) for row in chord_bank['Voicings']]}
    files['index.json'] = (json.dumps(index, indent=2, ensure_ascii=False) + '\n').encode()
    return builds, index, files, predecessors


def existing_bytes(path):
    if path.is_symlink() or (path.exists() and not path.is_file()):
        raise ValueError(f'Refusing non-regular output file: {path}')
    return path.read_bytes() if path.exists() else None


def marker(index_bytes):
    return (hashlib.sha256(index_bytes).hexdigest() + '\n').encode('ascii')


def publish(path, contents, replace=False):
    # Readers always see a complete file. New paths use link() so an unexpected
    # collision, even after preflight, cannot overwrite someone else's file.
    tmp = tempfile.NamedTemporaryFile(dir=path.parent, prefix='.crest-index-', delete=False)
    try:
        with tmp:
            tmp.write(contents)
        if replace:
            os.replace(tmp.name, path)
        else:
            os.link(tmp.name, path)
    finally:
        Path(tmp.name).unlink(missing_ok=True)


def install_bank(output, files, predecessors=None):
    output = output.expanduser().absolute()
    repo = Path(__file__).resolve().parents[2]
    if (repo / '.git').exists() and (output.resolve() == repo or repo in output.resolve().parents):
        raise ValueError('Choose an output directory outside the repository.')
    if output.is_symlink() or (output / 'motions').is_symlink():
        raise ValueError('Output and motions directories must not be symbolic links.')
    output.mkdir(mode=0o700, parents=True, exist_ok=True)
    index_path, owner_path = output/'index.json', output/OWNER
    old_index, old_owner = existing_bytes(index_path), existing_bytes(owner_path)
    owned = old_index is not None and old_owner == marker(old_index)
    if old_owner is not None and not owned:
        raise ValueError(f'Modified or incomplete bank at {output}; choose a new --output directory.')
    if old_index is not None and old_index != files['index.json'] and not owned:
        raise ValueError(f'Refusing to overwrite unrelated {index_path}. Choose a new --output directory.')
    old_paths = {r['midi'] for r in json.loads(old_index).get('motions', [])} if owned and predecessors else set()
    writes = []
    for relative, contents in files.items():
        if relative == 'index.json':
            continue
        dest = output/relative
        old = existing_bytes(dest)
        if old is None:
            writes.append((dest, contents, False))
        elif old != contents:
            if relative not in old_paths or old != predecessors.get(relative):
                raise ValueError(f'Refusing to replace different MIDI file: {dest}. Choose a new --output directory.')
            writes.append((dest, contents, True))
    (output/'motions').mkdir(mode=0o700, exist_ok=True)
    for dest, contents, replace in writes:
        publish(dest, contents, replace=replace)
    # Publish the index last: by the time the UI sees it every referenced MIDI exists.
    new_index = files['index.json']
    if old_index != new_index:
        publish(index_path, new_index, replace=owned)
    if old_owner != marker(new_index):
        publish(owner_path, marker(new_index), replace=owned)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', type=Path, default=DEFAULT_OUTPUT,
                        help=f'local bank destination (default: {DEFAULT_OUTPUT})')
    args = parser.parse_args()
    try:
        builds, index, files, predecessors = generate_bank()
        install_bank(args.output, files, predecessors)
    except (OSError, ValueError, zipfile.BadZipFile) as error:
        parser.exit(1, f'index_scaler: {error}\n')
    print('Verified: ' + ', '.join(f'{b.name} {b.version}' for b in builds))
    print(f'{len(index["motions"])} motion MIDI files, {len(index["progressions"])} common progressions, '
          f'{len(index["colors"])} voiced color sets: {args.output.expanduser() / "index.json"}')


if __name__ == '__main__':
    main()
