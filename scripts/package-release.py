#!/usr/bin/env python3
"""Package only allowlisted static assets and license notices."""
from hashlib import sha256
import json
from pathlib import Path
import zipfile

root = Path(__file__).resolve().parents[1]
version = json.loads((root / "package.json").read_text())["version"]
output = root / "release"
output.mkdir(exist_ok=True)
name = f"junit-diff-lens-v{version}.zip"
with zipfile.ZipFile(output / name, "w", zipfile.ZIP_DEFLATED) as archive:
    for file in sorted((root / "dist").rglob("*")):
        if file.is_file() and file.suffix in {".html", ".js", ".css", ".svg"}:
            archive.write(file, file.relative_to(root / "dist"))
    archive.write(root / "LICENSE", "LICENSE")
    notices = []
    for dependency in ["react", "react-dom", "scheduler"]:
        notices.append(f"{dependency}\n\n" + (root / "node_modules" / dependency / "LICENSE").read_text())
    archive.writestr("THIRD_PARTY_NOTICES.txt", "\n\n---\n\n".join(notices))
    archive.writestr("START-HERE.txt", "JUnit Diff Lens\n\nRun in this directory:\n  python3 -m http.server 8080 --bind 127.0.0.1\nOn Windows, use py instead of python3.\nOpen http://127.0.0.1:8080\n\nNo Node.js or internet connection is required.\nSource and guide: https://github.com/Tomdachs/junit-diff-lens\n")
digest = sha256((output / name).read_bytes()).hexdigest()
(output / "SHA256SUMS").write_text(f"{digest}  {name}\n")
print(f"Packaged {name} ({(output / name).stat().st_size} bytes)")
