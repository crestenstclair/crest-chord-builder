"""Package the same Crest editor as a Live MIDI effect, upstream of any instrument."""

import argparse
from datetime import datetime
import json
import os
from pathlib import Path
import shutil
import struct
import tempfile


NAME = 'Crest Composer MIDI'
COMPOSER = Path(__file__).resolve().parents[1]
BUILD = COMPOSER / 'build/MIDI Effect'
USER_LIBRARY = Path.home() / 'Music/Ableton/User Library'
PLUGIN = Path.home() / 'Library/Audio/Plug-Ins/VST3/Crest Composer.vst3'
TEMPLATE = Path('/Applications/Ableton Live 12 Suite.app/Contents/App-Resources/Misc/Max Devices/Max MIDI Effect.amxd')


def read_device_json(container):
    """Read the uncompressed stock Live MIDI device container. Reject other layouts."""
    if len(container) < 33 or container[:28] != (b'ampf' + struct.pack('<I', 4) + b'mmmmmeta' +
                                                  struct.pack('<II', 4, 0) + b'ptch'):
        raise ValueError('Unsupported Max MIDI Effect container')
    if struct.unpack_from('<I', container, 28)[0] != len(container) - 32 or container[-1:] != b'\0':
        raise ValueError('Incomplete Max MIDI Effect container')
    return json.loads(container[32:-1])


def stock_midi_device():
    """Keep the host's complete project record and all patcher defaults, including unknown ones."""
    graph = read_device_json(TEMPLATE.read_bytes())
    project = graph['patcher']['project']
    if project.get('amxdtype') != int.from_bytes(b'mmmm', 'big') or not all(
            isinstance(project.get(key), dict) for key in ('contents', 'layout', 'searchpath')):
        raise ValueError('Installed template is not a supported Live MIDI device project')
    return graph


def device_graph(plugin_name):
    boxes, lines = [], []

    def add(ref, kind, text, rect, inputs, outlets, panel=None, **attrs):
        box = dict(id=ref, maxclass=kind, patching_rect=rect, numinlets=inputs, numoutlets=len(outlets), **attrs)
        if text is not None:
            box['text'] = text
        if outlets:
            box['outlettype'] = outlets
        if panel:
            box.update(presentation=1, presentation_rect=panel)
        boxes.append({'box': box})

    def link(source, outlet, dest, inlet=0):
        lines.append({'patchline': {'source': [source, outlet], 'destination': [dest, inlet]}})

    def obj(ref, text, xy, inputs=1, outlets=('',), **attrs):
        add(ref, 'newobj', text, [*xy, max(55, len(text) * 5), 22], inputs, list(outlets), **attrs)

    def label(ref, text, rect, size=11):
        add(ref, 'live.comment', text, rect, 1, [], rect, fontsize=size, textjustification=0)

    label('brand', 'CREST  /  COMPOSER MIDI', [8, 5, 235, 18], 13)
    editor_button = {'valueof': {'parameter_longname': 'Open Composer', 'parameter_shortname': 'Editor',
                                 'parameter_type': 2, 'parameter_enum': ['Off', 'On'],
                                 'parameter_initial_enable': 1, 'parameter_initial': [0]}}
    add('open-ui', 'live.text', 'Open Composer', [9, 32, 148, 28], 1, ['', ''],
        [8, 30, 164, 29], texton='Open Composer', mode=0, parameter_enable=1, varname='open_composer',
        saved_attribute_attributes=editor_button, hint='Open Sketch, Colors, and the full Composer editor')
    add('open-msg', 'message', 'open', [9, 210, 42, 22], 2, [''])
    obj('editor-press', 'route bang 1', [9, 182], outlets=['', '', ''])
    link('open-ui', 0, 'editor-press'); link('editor-press', 0, 'open-msg'); link('editor-press', 1, 'open-msg')

    mode = {'valueof': {'parameter_longname': 'Controller mode', 'parameter_shortname': 'Keys',
                        'parameter_type': 2, 'parameter_enum': ['Keys thru', 'Lane bind'],
                        'parameter_initial_enable': 1, 'parameter_initial': [0]}}
    add('mode', 'live.tab', None, [10, 80, 162, 24], 1, ['', ''], [8, 66, 164, 36],
        parameter_enable=1, varname='controller_mode', saved_attribute_attributes=mode)
    label('help1', 'Place an instrument preset after this device.', [8, 106, 248, 16])
    label('help2', 'Pick a chord or play a sketch in Composer.', [8, 124, 248, 16])
    label('indicator-caption', 'MIDI out', [194, 39, 51, 16])
    add('flash', 'button', None, [776, 418, 17, 17], 1, ['bang'], [176, 39, 14, 14], ignoreclick=1)

    # A stored-only blob is per device instance. Load in the constructor, not via loadbang,
    # so opening a Set does not replace Live's recalled plug-in state with a fresh instance.
    state = {'valueof': {'parameter_longname': 'Composer state', 'parameter_shortname': 'Sketches',
                         'parameter_type': 3, 'parameter_invisible': 1}}
    plugin_arg = str(plugin_name).replace('\\', '\\\\').replace('"', '\\"')
    obj('engine', f'vst~ 2 2 "{plugin_arg}" @prefer VST3 @parameter_enable 1 @autosave 1 @floateditorwindow 1',
        [300, 340], 2, ['signal', 'signal', '', 'list', 'int', '', '', ''], varname='crest_engine',
        saved_attribute_attributes=state, saved_object_attributes={'parameter_enable': 1, 'parameter_mappable': 0}, autosave=1)
    link('open-msg', 0, 'engine')

    # Thru and bind are mutually exclusive. A controller key should never double a bound chord.
    obj('input', 'midiin', [270, 200], outlets=['int'])
    obj('select', '+ 1', [80, 205], 2, ['int'])
    obj('change', 't i b b', [80, 239], outlets=['int', 'bang', 'bang'])
    obj('gate', 'gate 2 1', [242, 246], 2, ['', ''])
    obj('thru', 'midiflush', [220, 292], outlets=['int'])
    obj('decode', 'midiparse', [330, 286], outlets=['', '', '', 'int', 'int', '', 'int', ''])
    add('release', 'message', 'midievent 176 123 0', [12, 291, 132, 22], 2, [''])
    link('mode', 0, 'select'); link('select', 0, 'change'); link('change', 2, 'thru'); link('change', 1, 'release')
    link('release', 0, 'engine'); link('change', 0, 'gate'); link('input', 0, 'gate', 1)
    link('gate', 0, 'thru'); link('gate', 1, 'decode'); link('decode', 7, 'engine')
    obj('output', 'midiout', [550, 438], outlets=[])
    link('thru', 0, 'output'); link('engine', 4, 'output')
    # Max's documented raw-MIDI outlet is fourth from the right. The signal is metered
    # internally to keep the MSP graph active, never connected to the track audio path.
    obj('sink', 'peakamp~ 80', [300, 391], outlets=['float']); link('engine', 0, 'sink')
    obj('monitor', 'midiparse', [700, 382], outlets=['', '', '', 'int', 'int', '', 'int', ''])
    link('engine', 4, 'monitor'); link('thru', 0, 'monitor'); link('monitor', 0, 'flash')
    graph = stock_midi_device()
    graph['patcher'].update({'rect': [50, 50, 850, 480], 'openrect': [0, 0, 260, 169],
            'openinpresentation': 1, 'devicewidth': 260, 'title': NAME, 'default_fontsize': 11.,
            'description': 'Sketch and audition through the instrument on this MIDI track.',
            'tags': 'Crest Composer MIDI harmony chords', 'boxes': boxes, 'lines': lines,
            'parameters': {'engine': ['Composer state', 'Sketches', 0], 'mode': ['Controller mode', 'Keys', 0],
                           'open-ui': ['Open Composer', 'Editor', 0],
                           'inherited_shortname': 1}, 'autosave': 0})
    return graph


def amxd_bytes(graph):
    payload = json.dumps(graph, ensure_ascii=True, indent=2).encode() + b'\n\0'
    return b'ampf' + struct.pack('<I', 4) + b'mmmmmeta' + struct.pack('<II', 4, 0) + b'ptch' + struct.pack('<I', len(payload)) + payload


def build_and_install(user_library=USER_LIBRARY, install=False):
    if not (PLUGIN / 'Contents/MacOS/Crest Composer').is_file():
        raise FileNotFoundError('Install the Crest Composer VST3 before its MIDI effect: ' + str(PLUGIN))
    graph = device_graph(PLUGIN)
    BUILD.mkdir(parents=True, exist_ok=True)
    (BUILD / (NAME + '.maxpat')).write_text(json.dumps(graph, indent=2) + '\n')
    payload = amxd_bytes(graph)
    if read_device_json(payload)['patcher']['project'] != stock_midi_device()['patcher']['project']:
        raise ValueError('Project metadata did not survive packaging')
    artifact = BUILD / (NAME + '.amxd')
    artifact.write_bytes(payload)
    if not install:
        return artifact
    folder = user_library / 'Presets/MIDI Effects/Max MIDI Effect'
    folder.mkdir(parents=True, exist_ok=True)
    destination = folder / artifact.name
    if destination.exists():
        if destination.read_bytes() == payload:
            return destination
        backup = Path.home() / 'Library/Application Support/Crest Composer/Backups' / datetime.now().strftime('%Y%m%d-%H%M%S-%f')
        backup.mkdir(parents=True)
        shutil.copy2(destination, backup / destination.name)
    with tempfile.NamedTemporaryFile(dir=folder, delete=False) as temp:
        temp.write(payload)
    os.replace(temp.name, destination)
    return destination


if __name__ == '__main__':
    cli = argparse.ArgumentParser(description=__doc__)
    cli.add_argument('--install', action='store_true', help='Also copy to the Live User Library (default: stage only)')
    cli.add_argument('--user-library', type=Path, default=USER_LIBRARY)
    args = cli.parse_args()
    print(build_and_install(args.user_library.expanduser(), args.install))
