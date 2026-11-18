"""Source-bank fidelity tests; only the opt-in integration test needs an installed bank."""

import io
import json
import os
from pathlib import Path
import struct
import sys
import tempfile
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'tools'))
import index_scaler as adapter


def vlq(stream):
    value = 0
    for _ in range(4):
        (part,) = stream.read(1)
        value = 128 * value + (part & 127)
        if part < 128:
            return value
    raise AssertionError('Overlong SMF variable-length quantity')


def decode_smf(raw):
    """Independent, strict reader for plain type-0 SMF with explicit statuses."""
    hdr, n, fmt, tracks, ppq, trk, track_size = struct.unpack_from('>4sIHHH4sI', raw)
    assert (hdr, n, fmt, tracks, trk, track_size) == (b'MThd', 6, 0, 1, b'MTrk', len(raw)-22)
    s = io.BytesIO(raw[22:]); tick = 0
    active, notes, metadata = {}, [], {}
    while s.tell() < track_size:
        tick += vlq(s)
        (status,) = s.read(1)
        if status == 0xff:
            (kind,) = s.read(1)
            value = s.read(vlq(s))
            if kind == 0x2f:
                assert not active and not value and s.tell() == track_size
                return ppq, tick, metadata, sorted(notes)
            assert tick == 0 and kind not in metadata
            metadata[kind] = value
            continue
        pitch, vel = s.read(2)
        channel = status & 15
        assert channel != 9 and 0 <= pitch < 128 and 0 <= vel < 128
        key = (channel, pitch)
        if status >> 4 == 9:
            assert vel > 0 and key not in active
            active[key] = (tick, vel)
        else:
            assert status >> 4 == 8 and key in active
            start, velocity = active.pop(key)
            assert start < tick
            notes.append((start, tick, pitch, velocity))
    raise AssertionError('Missing end of track')


class IndexTests(unittest.TestCase):
    def assert_mapping(self, meta, row):
        family = {'Performances': 1, 'Grooves': 1, 'Rhythms': 2}.get(row['folder'])
        if family is None:
            self.assertNotIn(0x7f, meta)
            return
        s = io.BytesIO(meta[0x7f]); data = row['expressionsData']
        self.assertEqual(s.read(9), b'CRESTMAP1')
        self.assertEqual(s.read(1)[0], family)
        self.assertEqual(int.from_bytes(s.read(1), 'big', signed=True), row['octaveDiff'])
        palette = list(s.read(s.read(1)[0]))
        self.assertEqual(palette, data['metaData']['allNotesNumber'])
        count = int.from_bytes(s.read(4), 'big')
        expected = [(e['position'], e['duration'], e['noteIndex'], e['velocity']) for e in data['events']]
        self.assertEqual(count, len(expected))
        self.assertEqual(list(struct.iter_unpack('>IIBB', s.read())), expected)

    def test_raw_selector_order_and_old_grooves_name(self):
        data = {'metaData': {'allNotesNumber':[67,48], 'ticksPerBeat':96, 'lastPosition':100,
                             'timeSignature':{'numerator':4,'denominator':4}},
                'events':[dict(noteId=1,position=44,duration=0,noteIndex=1,noteNumber=48,velocity=62),
                          dict(noteId=0,position=0,duration=40,noteIndex=0,noteNumber=67,velocity=83)]}
        for family in ('Performances','Grooves','Rhythms','Phrases'):
            row = {'folder':family,'octaveDiff':-2,'expressionsData':data}
            _,_,meta,notes = decode_smf(adapter.motion_midi(data, adapter.mapping_event(row)))
            self.assert_mapping(meta, row)
            self.assertEqual(notes, [(0,40,67,83), (44,45,48,62)])

    def test_overlaps_reversed_releases_zero_gate_retrigger_and_trailing_rest(self):
        records = [(8, 57, 70, 4), (0, 57, 60, 0), (0, 57, 50, 12), (12, 57, 33, 1)]
        events = [dict(noteId=i, position=t, noteNumber=p, velocity=v, duration=d)
                  for i, (t,p,v,d) in enumerate(records)]
        data = {'metaData': {'ticksPerBeat': 96, 'lastPosition': 300,
                             'timeSignature': {'numerator': 6, 'denominator': 8}}, 'events': events}
        ppq, end, meta, notes = decode_smf(adapter.motion_midi(data))
        self.assertEqual((ppq, end, meta), (96, 300, {0x58: bytes([6, 3, 24, 8])}))
        self.assertEqual(notes, [(0,1,57,60), (0,12,57,50), (8,12,57,70), (12,13,57,33)])

    def test_refuses_unknown_build_before_output(self):
        with tempfile.TemporaryDirectory() as d:
            root = Path(d); executable = adapter.BUILDS[0].executable(root)
            executable.parent.mkdir(parents=True); executable.write_bytes(b'not this build')
            with self.assertRaisesRegex(ValueError, 'Unsupported.*SHA-256'):
                adapter.generate_bank(root)

    def test_existing_output_is_preserved_and_rerun_is_idempotent(self):
        with tempfile.TemporaryDirectory() as d:
            out = Path(d); files = {'motions/a.mid': b'example', 'index.json': b'{}'}
            (out/'motions').mkdir(); (out/'motions/a.mid').write_bytes(b'user song')
            with self.assertRaisesRegex(ValueError, 'different MIDI'):
                adapter.install_bank(out, files)
            self.assertEqual((out/'motions/a.mid').read_bytes(), b'user song')
            (out/'motions/a.mid').unlink(); (out/'index.json').write_bytes(b'user index')
            with self.assertRaisesRegex(ValueError, 'unrelated'):
                adapter.install_bank(out, files)
            self.assertFalse((out/'motions/a.mid').exists())
            (out/'index.json').unlink(); adapter.install_bank(out, files)
            inode = (out/'index.json').stat().st_ino
            adapter.install_bank(out, files)
            self.assertEqual(inode, (out/'index.json').stat().st_ino)
            adapter.install_bank(out, dict(files, **{'index.json': b'{"version":1}'}))
            self.assertEqual((out/'index.json').read_bytes(), b'{"version":1}')
            (out/'index.json').write_bytes(b'edited index')
            with self.assertRaisesRegex(ValueError, 'Modified'):
                adapter.install_bank(out, files)

    def test_upgrades_only_indexed_byte_exact_predecessors(self):
        path = 'motions/old.mid'
        with tempfile.TemporaryDirectory() as d:
            out = Path(d)
            index = json.dumps({'motions':[{'midi':path}]}).encode()
            before = {path:b'old export', 'index.json':index}; after = {path:b'new export','index.json':index}
            predecessors = {path:before[path]}
            adapter.install_bank(out,before)
            (out/path).write_bytes(b'edited song')
            with self.assertRaisesRegex(ValueError, 'different MIDI'):
                adapter.install_bank(out,after,predecessors)
            self.assertEqual((out/path).read_bytes(),b'edited song')
            (out/path).write_bytes(before[path]); adapter.install_bank(out,after,predecessors)
            self.assertEqual((out/path).read_bytes(),after[path])
            inode = (out/path).stat().st_ino; adapter.install_bank(out,after,predecessors)
            self.assertEqual((out/path).stat().st_ino,inode)

    @unittest.skipUnless(os.environ.get('CREST_VERIFY_SCALER_BANK'), 'no installed bank explicitly selected')
    def test_every_installed_file_against_source(self):
        out = Path(os.environ['CREST_VERIFY_SCALER_BANK']).expanduser()
        index = json.loads((out/'index.json').read_bytes())
        self.assertLessEqual((out/'index.json').stat().st_size,4*1024*1024)
        self.assertEqual(set(index), {'version','motions','progressions','colors'})
        self.assertEqual(index['version'], 1)
        self.assertLessEqual(len(index['motions']),10000)
        self.assertLessEqual(len(index['progressions']),1000)
        self.assertLessEqual(len(index['colors']),100)
        builds = adapter.installed_builds(); sources = {}; chords = None
        for build in builds:
            bank, records = adapter.read_build(build, adapter.INSTALL_ROOT)
            chords = chords or bank
            for r in records:
                sources.setdefault(r['uuid'], r)
        self.assertEqual(len(index['motions']), len(sources))
        self.assertEqual({x['id'] for x in index['motions']}, set(sources))
        for motion in index['motions']:
            with self.subTest(id=motion['id']):
                r = sources[motion['id']]; data = r['expressionsData']; meta = data['metaData']
                self.assertEqual((motion['name'],motion['group']), (r['name'],r['subfolder']))
                self.assertEqual(motion['family'], 'Performances' if r['folder']=='Grooves' else r['folder'])
                self.assertEqual(motion['midi'], f'motions/{r["uuid"]}.mid')
                ppq, end, midi_meta, notes = decode_smf((out/motion['midi']).read_bytes())
                self.assert_mapping(midi_meta, r)
                self.assertEqual((ppq,end), (meta['ticksPerBeat'], meta['lastPosition']))
                meter = meta['timeSignature']; numerator,denom,_,_ = midi_meta[0x58]
                self.assertEqual((numerator,2**denom), (meter['numerator'],meter['denominator']))
                self.assertEqual(int.from_bytes(midi_meta.get(0x51, b''),'big'), meta.get('microsecondsPerBeat',0))
                expected = sorted((e['position'], e['position'] + max(1, e['duration']), e['noteNumber'], e['velocity'])
                                  for e in data['events'])
                self.assertEqual(notes, expected)
        progressions = {x['uuid']:x for x in chords['Song Sets'] if x['subfolder']=='Common Progressions'}
        colors = {x['name']:x for x in chords['Voicings']}
        self.assertEqual(len(index['progressions']), len(progressions))
        self.assertEqual(len(index['colors']), len(colors))
        for p in index['progressions']:
            self.assertIn(p['tonic'],(0,9))
            self.assertTrue(p['group'])
            self.assertEqual(p['name'], progressions[p['id']]['name'])
            self.assert_slots(p, progressions[p['id']])
        for row in index['colors']:
            self.assertEqual(row.get('tonic',0),0)
            self.assert_slots(row, colors[row['name']])
        triads = {p['group']:p for p in index['progressions'] if p['name'].startswith('Triads (')}
        self.assertEqual([s['root'] for s in triads['I-VII-I']['slots']], [0,10,0])
        self.assertEqual(triads['i-V-i-iv']['tonic'], 9)
        self.assertEqual(triads['vi-IV-I-V']['tonic'], 0)

    def assert_slots(self, row, source):
        self.assertEqual([s['notes'] for s in row['slots']],
                         [[60+n for n in v['intervals']] for v in source['voicings']])
        self.assertTrue(1 <= len(row['slots']) <= 8)
        for s in row['slots']:
            self.assertTrue(s['name'] and type(s['root']) is int and 0 <= s['root'] <= 11)
            self.assertTrue(1 <= len(s['notes']) <= 16)
            self.assertTrue(all(type(n) is int and 12 <= n <= 115 for n in s['notes']))


if __name__ == '__main__':
    unittest.main()
