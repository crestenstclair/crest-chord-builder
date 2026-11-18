"""Receive Crest Composer clips in the same Live process. Enable once as a Control Surface."""

import json
import os
import time
import uuid
from pathlib import Path

import Live
from _Framework.ControlSurface import ControlSurface
from .placement import place_clip, place_session_sketches


def write_json(path, value):
    temp = path.with_suffix('.tmp')
    temp.write_text(json.dumps(value), encoding='utf-8')
    os.replace(temp, path)


class CrestTimeline(ControlSurface):
    def __init__(self, c_instance):
        super(CrestTimeline, self).__init__(c_instance)
        self.root = Path.home() / 'Library/Application Support/Crest Composer/Timeline' / str(os.getpid())
        self.root.mkdir(mode=0o700, exist_ok=True, parents=True)
        self.session = uuid.uuid4().hex
        # A separate inbox per Live surface lifetime prevents a delayed send from reaching a reopened set.
        self.inbox = self.root / self.session
        self.inbox.mkdir(mode=0o700)
        write_json(self.root / 'active.json', {'version': 1, 'session': self.session, 'session_clips': 1})
        self.song_at_open = self.song()

    def update_display(self):
        super(CrestTimeline, self).update_display()
        if not getattr(self, 'inbox', None):
            return
        try:
            request = next(self.inbox.glob('*.request'), None)
            if request is not None:
                self.receive(request)
        except OSError as error:
            self.log_message('Crest Timeline: ' + str(error))

    def receive(self, request):
        claimed = request.with_suffix('.working')
        try:
            os.rename(request, claimed)
        except FileNotFoundError:
            return
        try:
            if claimed.stat().st_size > 3 * 1024 * 1024:
                raise ValueError('Sketch data exceeds transfer limit.')
            data = json.loads(claimed.read_text(encoding='utf-8'))
            if data.get('session') != self.session or self.song() != self.song_at_open:
                raise ValueError('Live Set changed. Send again from the current set.')
            if not time.time() * 1000 <= data.get('expires', 0) <= time.time() * 1000 + 15000:
                raise ValueError('Send expired. Select the target and send again.')
            if data.get('op') == 'session-sketches':
                text = place_session_sketches(self.song(), data, Live.Clip.MidiNoteSpecification)
            elif 'op' not in data and 'clips' not in data:  # 0.2.1 Arrangement client
                text = place_clip(self.song(), data, Live.Clip.MidiNoteSpecification)
            else:
                raise ValueError('Unknown clip operation. Check the CrestTimeline version.')
        except Exception as error:
            text = 'Not placed: ' + (str(error) or type(error).__name__)
        finally:
            claimed.unlink()
        write_json(request.with_suffix('.reply'), {'message': text})

    def disconnect(self):
        if getattr(self, 'inbox', None):
            active = self.root / 'active.json'
            try:
                if json.loads(active.read_text(encoding='utf-8')).get('session') == self.session:
                    active.unlink()
            except (OSError, ValueError):
                pass
            self.inbox = None
        super(CrestTimeline, self).disconnect()


def create_instance(c_instance):
    return CrestTimeline(c_instance)
