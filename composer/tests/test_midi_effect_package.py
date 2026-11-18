"""Check the deliverable against Live's stock MIDI-device project, not just a .maxpat."""

import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'tools'))
from build_midi_effect import PLUGIN, TEMPLATE, amxd_bytes, device_graph, read_device_json


@unittest.skipUnless(TEMPLATE.is_file(), 'Live 12 Suite template is not installed')
class MidiEffectPackageTests(unittest.TestCase):
    def test_packaged_project_preserves_entire_stock_dictionary(self):
        stock = read_device_json(TEMPLATE.read_bytes())['patcher']
        emitted = read_device_json(amxd_bytes(device_graph(PLUGIN)))['patcher']
        self.assertEqual(emitted['project'], stock['project'])
        self.assertEqual(emitted['appversion'], stock['appversion'])
        self.assertIsInstance(emitted['project']['searchpath'], dict)
        self.assertTrue(any('vst~' in b['box'].get('text', '') for b in emitted['boxes']))


if __name__ == '__main__':
    unittest.main()
