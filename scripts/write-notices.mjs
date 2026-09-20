import { readFile, writeFile } from "node:fs/promises";

const notices = ["JUnit Diff Lens\n\n" + (await readFile("LICENSE", "utf8"))];
for (const name of ["react", "react-dom", "scheduler"]) {
  notices.push(
    `${name}\n\n${await readFile(`node_modules/${name}/LICENSE`, "utf8")}`,
  );
}
await writeFile("dist/THIRD_PARTY_NOTICES.txt", notices.join("\n\n---\n\n"));
