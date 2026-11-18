"""Install the local build, preserving any previous Crest Composer bundle."""

from datetime import datetime
from pathlib import Path
import shutil
import subprocess
import tempfile


def install_timeline_surface(composer):
    source = composer / 'live/CrestTimeline'
    target = Path.home() / 'Music/Ableton/User Library/Remote Scripts/CrestTimeline'
    target.mkdir(parents=True, exist_ok=True)
    stamp = datetime.now().strftime('%Y%m%d-%H%M%S-%f')
    for file in sorted(source.glob('*.py')):
        dst = target / file.name
        if dst.exists():
            if dst.read_bytes() == file.read_bytes():
                continue
            backup = Path.home() / 'Library/Application Support/Crest Composer/Backups' / stamp / 'CrestTimeline'
            backup.mkdir(parents=True, exist_ok=True)
            shutil.copy2(dst, backup / file.name)
        with tempfile.NamedTemporaryFile(dir=target, delete=False) as temp:
            temp.write(file.read_bytes())
        Path(temp.name).replace(dst)
    print(f'Installed Live Control Surface: {target}')


def main():
    composer = Path(__file__).resolve().parents[1]
    name = 'Crest Composer.vst3'
    source = composer / 'build/CrestComposer_artefacts/Release/VST3' / name
    destination = Path.home() / 'Library/Audio/Plug-Ins/VST3' / name
    subprocess.run(['codesign', '--verify', '--deep', '--strict', str(source)], check=True)
    destination.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(dir=destination.parent, prefix='.composer-') as staging:
        staged = Path(staging) / name
        shutil.copytree(source, staged, symlinks=True)
        subprocess.run(['codesign', '--verify', '--deep', '--strict', str(staged)], check=True)
        backup = None
        if destination.exists():
            stamp = datetime.now().strftime('%Y%m%d-%H%M%S-%f')
            backup = Path.home() / 'Library/Application Support/Crest Composer/Backups' / stamp / name
            backup.parent.mkdir(parents=True, exist_ok=False)
            destination.rename(backup)
        try:
            staged.rename(destination)
        except OSError:
            if backup is not None:
                backup.rename(destination)
            raise
    print(f'Installed {destination}')
    install_timeline_surface(composer)
    if backup is not None:
        print(f'Previous bundle: {backup}')


if __name__ == '__main__':
    main()
