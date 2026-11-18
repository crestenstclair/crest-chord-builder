"""Local placement contract: correct timeline target and no edits on a rejected send."""

import sys
import unittest
from pathlib import Path
from types import SimpleNamespace

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'live/CrestTimeline'))
from placement import place_clip, place_session_sketches


class Track:
    has_midi_input = True
    is_frozen = False
    name = 'Keys'

    def __init__(self):
        self.arrangement_clips = []
        self.write_notes = lambda notes: setattr(self, 'notes', notes)

    def create_midi_clip(self, at, length):
        self.arrangement_clips.append(SimpleNamespace(start_time=at, end_time=at + length, add_new_notes=self.write_notes))

    def delete_clip(self, clip):
        self.arrangement_clips.remove(clip)


class TimelineTests(unittest.TestCase):
    def setUp(self):
        self.track, self.undo = Track(), []
        self.song = SimpleNamespace(tracks=[self.track], view=SimpleNamespace(selected_track=self.track),
                                    start_time=12.5, current_song_time=177, begin_undo_step=lambda: self.undo.append('begin'),
                                    end_undo_step=lambda: self.undo.append('end'))
        self.clip = dict(name='Waltz', ticks=2880, meter=3, ppq=480, notes=[[17, 483, 57, 86], [32, 466, 61, 98]])

    def place(self):
        return place_clip(self.song, self.clip, SimpleNamespace)

    def test_start_marker_not_playhead_and_preserve_performance(self):
        self.track.create_midi_clip(8, 4.5)  # touching, not overlapping
        self.place()
        clip = self.track.arrangement_clips[-1]
        self.assertEqual((clip.start_time, clip.end_time, clip.signature_numerator, clip.name), (12.5, 18.5, 3, 'Waltz'))
        self.assertEqual(self.undo, ['begin', 'end'])
        self.assertEqual([(n.pitch, n.velocity, n.start_time, n.duration) for n in self.track.notes],
                         [(57, 86, 17/480, 466/480), (61, 98, 32/480, 434/480)])

    def test_occupied_range_preserved(self):
        self.track.create_midi_clip(16, 4)
        with self.assertRaisesRegex(ValueError, 'contains a clip'):
            self.place()
        self.assertEqual((len(self.track.arrangement_clips), self.undo), (1, []))

    def test_invalid_destination_or_payload_never_creates_clip(self):
        for prop, value in [('has_midi_input', False), ('is_frozen', True)]:
            setattr(self.track, prop, value)
            with self.assertRaises(ValueError):
                self.place()
            delattr(self.track, prop)
        self.clip['notes'][1][1] = 4000
        with self.assertRaises(ValueError):
            self.place()
        self.assertEqual((self.track.arrangement_clips, self.undo), ([], []))

    def test_failed_note_write_removes_only_new_clip(self):
        self.track.create_midi_clip(0, 4)
        self.track.write_notes = lambda _: (_ for _ in ()).throw(ValueError('note write failed'))
        with self.assertRaises(ValueError):
            self.place()
        self.assertEqual([c.start_time for c in self.track.arrangement_clips], [0])
        self.assertEqual(self.undo, ['begin', 'end'])


class Slot:
    clip = None
    reject_notes = False

    @property
    def has_clip(self):
        return self.clip is not None

    def create_clip(self, length):
        assert not self.has_clip
        self.clip = SimpleNamespace(length=length, notes=[], add_new_notes=self.write_notes)

    def write_notes(self, notes):
        if self.reject_notes:
            raise RuntimeError('note write failed')
        self.clip.notes.extend(notes)

    def delete_clip(self):
        self.clip = None


class SessionSong:
    def __init__(self):
        self.track = SimpleNamespace(clip_slots=[], has_midi_input=True, is_frozen=False, name='Keys')
        self.tracks = [self.track]
        self.scenes, self.undo = [], []
        for _ in range(4):
            self.create_scene(-1)
        self.view = SimpleNamespace(selected_track=self.track, highlighted_clip_slot=self.track.clip_slots[2])

    def create_scene(self, index):
        assert index == -1
        slot = Slot()
        self.track.clip_slots.append(slot)
        self.scenes.append(SimpleNamespace(clip_slots=[slot]))

    def delete_scene(self, index):
        del self.track.clip_slots[index]
        del self.scenes[index]

    def begin_undo_step(self):
        self.undo.append('begin')

    def end_undo_step(self):
        self.undo.append('end')


class SessionPlacementTests(unittest.TestCase):
    def setUp(self):
        self.song = SessionSong()
        self.slots = self.song.track.clip_slots
        self.slots[0].create_clip(4)
        self.keep = self.slots[0].clip
        self.verse = dict(name='Verse | Am - Rest | Accento', ticks=2880, meter=3, ppq=480,
                          notes=[[17, 483, 57, 86]])
        self.pause = dict(self.verse, name='Break | Rest | Block chords', ticks=720, notes=[])
        self.batch = {'clips': [self.verse, self.verse.copy(), self.pause]}

    def place(self):
        return place_session_sketches(self.song, self.batch, SimpleNamespace)

    def test_labeled_clips_start_at_highlight_and_append_only_needed_scenes(self):
        self.assertIn('scenes 3–5', self.place())
        self.assertIs(self.slots[0].clip, self.keep)
        self.assertFalse(self.slots[1].has_clip)
        self.assertEqual([s.clip.name for s in self.slots[2:]], [self.verse['name']] * 2 + [self.pause['name']])
        verse, pause = self.slots[2].clip, self.slots[4].clip
        self.assertEqual((verse.length, verse.signature_numerator, verse.signature_denominator), (6, 3, 4))
        note = verse.notes[0]
        self.assertEqual((note.pitch, note.velocity, note.start_time, note.duration), (57, 86, 17 / 480, 466 / 480))
        self.assertEqual((pause.length, pause.notes, self.song.undo), (1.5, [], ['begin', 'end']))

    def test_occupied_middle_slot_aborts_the_whole_batch(self):
        self.slots[3].create_clip(7)
        other = self.slots[3].clip
        with self.assertRaisesRegex(ValueError, 'Scene 4'):
            self.place()
        self.assertIs(self.slots[3].clip, other)
        self.assertFalse(self.slots[2].has_clip)
        self.assertEqual((len(self.song.scenes), self.song.undo), (4, []))

    def test_invalid_last_record_or_target_causes_no_edits(self):
        self.pause['meter'] = 7
        with self.assertRaisesRegex(ValueError, 'meter'):
            self.place()
        self.pause['meter'] = 3
        self.song.track.is_frozen = True
        with self.assertRaisesRegex(ValueError, 'unfrozen MIDI'):
            self.place()
        self.song.track.is_frozen = False
        self.song.view.highlighted_clip_slot = Slot()
        with self.assertRaisesRegex(ValueError, 'destination MIDI track'):
            self.place()
        self.assertEqual((len(self.slots), self.song.undo), (4, []))

    def test_rollback_preserves_existing_clips_and_removes_new_scenes(self):
        self.slots[3].reject_notes = True
        with self.assertRaisesRegex(RuntimeError, 'note write failed'):
            self.place()
        self.assertIs(self.slots[0].clip, self.keep)
        self.assertEqual([s.has_clip for s in self.slots], [True, False, False, False])
        self.assertEqual((len(self.song.scenes), self.song.undo), (4, ['begin', 'end']))


if __name__ == '__main__':
    unittest.main()
