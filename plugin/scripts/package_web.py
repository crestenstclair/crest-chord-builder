"""Bundle the static site, never personal output/project JSON files."""
from pathlib import Path
import sys
import zipfile

source, destination = map(Path, sys.argv[1:])
if not (source / "reference.html").is_file():
    raise SystemExit("Build the website before packaging the plug-in.")
destination.parent.mkdir(parents=True, exist_ok=True)
with zipfile.ZipFile(destination, "w", zipfile.ZIP_DEFLATED) as archive:
    for file in sorted(source.rglob("*")):
        if file.is_file() and not file.name.startswith("."):
            archive.write(file, file.relative_to(source).as_posix())
print(f"Packaged offline web assets: {destination}")
