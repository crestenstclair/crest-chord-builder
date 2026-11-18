"""The installed check is opt-in; the publication test uses only temporary synthetic data."""
import json
import os
from pathlib import Path
import sys
import tempfile
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'tools'))
import index_atlas as atlas


class AtlasTests(unittest.TestCase):
    def test_exclusive_publication(self):
        with tempfile.TemporaryDirectory() as temp:
            out = Path(temp) / 'atlas-v1.json'
            digest = atlas.publish(out, {'demo': [1, 2]})
            self.assertEqual(atlas.publish(out, {'demo': [1, 2]}), digest)
            out.write_bytes(b'owner edit')
            with self.assertRaisesRegex(ValueError, 'Refusing'):
                atlas.publish(out, {'demo': [1, 2]})
            self.assertEqual(out.read_bytes(), b'owner edit')
            self.assertEqual(list(out.parent.iterdir()), [out])

    @unittest.skipUnless(os.environ.get('CREST_VERIFY_ATLAS'), 'set CREST_VERIFY_ATLAS=1 for the local Scaler install')
    def test_installed_voicings(self):
        sidecar = json.loads((atlas.DEST / 'atlas-v1.json').read_bytes())
        self.assertEqual(sidecar, atlas.build(atlas.SOURCE))
        with atlas.SOURCE.open('rb') as f:
            f.seek(44018208)
            source = json.loads(f.read(96860))['Explore']
        self.assertEqual(len({r['uuid'] for r in source}), 81)
        for record, preset in zip(source, sidecar['presets'], strict=True):
            self.assertEqual(preset['id'], record['uuid'])
            self.assertEqual([s['notes'] for s in preset['slots']],
                             [[60+n for n in v['intervals']] for v in record['voicings']])


if __name__ == '__main__':
    unittest.main()
