"""Place rendered sketches using Live's clip APIs (quarter-note units)."""

import math


def integer(value, low, high, label):
    if type(value) is not int or not low <= value <= high:
        raise ValueError('Invalid ' + label)
    return value


def decode_clip(data, note_class, allow_rests=False):
    if not isinstance(data, dict):
        raise ValueError('Expected a sketch clip record')
    ppq = integer(data.get('ppq'), 480, 480, 'tick resolution')
    length = integer(data.get('ticks'), 1, 480 * 16384, 'clip length')
    meter = integer(data.get('meter'), 3, 4, 'meter')
    name = data.get('name')
    if not isinstance(name, str) or not name.strip() or len(name) > 128:
        raise ValueError('Invalid clip name')
    rows = data.get('notes')
    if not isinstance(rows, list) or len(rows) > 65536 or (not rows and not allow_rests):
        raise ValueError('Invalid performed note count')
    notes = []
    for row in rows:
        if not isinstance(row, list) or len(row) != 4:
            raise ValueError('Invalid performed note')
        start = integer(row[0], 0, length - 1, 'note onset')
        end = integer(row[1], start + 1, length, 'note end')
        notes.append(note_class(pitch=integer(row[2], 0, 127, 'pitch'), start_time=start / ppq,
                                duration=(end - start) / ppq, velocity=integer(row[3], 1, 127, 'velocity')))
    return name, length / ppq, meter, tuple(notes)


def session_start(song, clip_count):
    track = song.view.selected_track
    if track not in song.tracks or not track.has_midi_input or track.is_frozen:
        raise ValueError('Select an unfrozen MIDI track in Session View.')
    slots = tuple(track.clip_slots)
    highlighted = song.view.highlighted_clip_slot
    if highlighted not in slots:
        raise ValueError('Click the first empty Session clip slot on the destination MIDI track.')
    start = slots.index(highlighted)
    for scene, slot in enumerate(slots[start:start + clip_count], start + 1):
        if slot.has_clip:
            raise ValueError('Scene %d on %s already contains a clip. Choose an empty run of slots.' % (scene, track.name))
    return track, start


def fill_session_slot(slot, record):
    name, length, meter, notes = record
    slot.create_clip(length)
    clip = slot.clip
    clip.name = name
    clip.signature_denominator = 4
    clip.signature_numerator = meter
    if notes:
        clip.add_new_notes(notes)


def rollback_session(song, attempted, original_scenes):
    for slot in reversed(attempted):
        if slot.has_clip:
            slot.delete_clip()
    while len(song.scenes) > original_scenes:
        if any(slot.has_clip for slot in song.scenes[-1].clip_slots):
            raise RuntimeError('An appended scene is not empty')
        song.delete_scene(len(song.scenes) - 1)


def place_session_sketches(song, data, note_class):
    clips = data.get('clips')
    if not isinstance(clips, list) or not 1 <= len(clips) <= 7:
        raise ValueError('Expected between one and seven sketches.')
    records = [decode_clip(c, note_class, allow_rests=True) for c in clips]
    track, start = session_start(song, len(records))
    original_scenes = len(song.scenes)
    attempted = []
    song.begin_undo_step()
    try:
        for _ in range(original_scenes, start + len(records)):
            song.create_scene(-1)
        for index, record in enumerate(records, start):
            slot = track.clip_slots[index]
            if slot.has_clip:
                raise ValueError('Destination slot is no longer empty.')
            # Track an empty slot before creating: even a partially failed write is ours to remove.
            attempted.append(slot)
            fill_session_slot(slot, record)
    except Exception:
        try:
            rollback_session(song, attempted, original_scenes)
        except Exception as error:
            raise RuntimeError('Could not fully roll back. Check Session View before resending: ' + str(error)) from error
        raise
    finally:
        song.end_undo_step()
    if len(records) == 1:
        return 'Placed 1 sketch clip on %s, scene %d.' % (track.name, start + 1)
    return 'Placed %d sketch clips on %s, scenes %d–%d.' % (len(records), track.name, start + 1, start + len(records))


def place_clip(song, data, note_class):
    name, length, meter, notes = decode_clip(data, note_class)
    track = song.view.selected_track
    if track not in song.tracks or not track.has_midi_input or track.is_frozen:
        raise ValueError('Select an unfrozen MIDI track in Arrangement View.')
    start = float(song.start_time)
    if not math.isfinite(start) or not 0 <= start <= 1576800 - length:
        raise ValueError('Choose an Arrangement start marker within the song.')
    before = tuple(track.arrangement_clips)
    if any(c.start_time < start + length and c.end_time > start for c in before):
        raise ValueError('That timeline range contains a clip. Click an empty range and send again.')

    # All preflight and writes occur in one Live main-thread turn. No Session slot or transport is used.
    song.begin_undo_step()
    created = None
    try:
        track.create_midi_clip(start, length)
        created = next(c for c in track.arrangement_clips if c not in before and abs(c.start_time - start) < 1e-5)
        created.name = name
        created.signature_denominator = 4
        created.signature_numerator = meter
        created.add_new_notes(notes)
    except Exception:
        if created is not None:
            track.delete_clip(created)
        raise
    finally:
        song.end_undo_step()
    return 'Placed %s on %s at quarter-beat %g (%d notes).' % (name, track.name, start + 1, len(notes))
