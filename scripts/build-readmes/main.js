// Enumerate through build metadata generated from the other script
// Which has associated each file with all the information needed to construct a useful description

// This is slow as hell because it's linear, but theres no reason to be fancy on a one off script imo

const METADATA_FILE = `./../../metadata/1.7/build-metadata.json`

import * as fs from 'fs';

let markdown = "";

let buildMetadata = JSON.parse(fs.readFileSync(METADATA_FILE));

let patchNums = []

for (var i = 0; i < buildMetadata.length; i++) {
  let metadata = buildMetadata[i];
  let semverProps = metadata.versionNumber.substring(1).split(".");
  let patchNum = semverProps[2];
  patchNums.push(parseInt(patchNum));
}

patchNums.sort((a, b) => b - a);

for (var i = 0; i < patchNums.length; i++) {
  markdown += `- [v1.7.${patchNums[i]}](https://github.com/PCSX2/archive/releases/tag/v1.7.${patchNums[i]})\n`;
}

fs.writeFileSync('out/markdown.md', markdown);
