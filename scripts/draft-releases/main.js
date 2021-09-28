// Enumerate through build metadata generated from the other script
// Which has associated each file with all the information needed to construct a useful description

// This is slow as hell because it's linear, but theres no reason to be fancy on a one off script imo

import { Octokit } from "@octokit/rest";
import { throttling } from "@octokit/plugin-throttling";
import { retry } from "@octokit/plugin-retry";
Octokit.plugin(throttling);
Octokit.plugin(retry);
import chalk from 'chalk';
import dotenv from 'dotenv'
dotenv.config();
const octokit = new Octokit({
  auth: process.env.GH_TOKEN,
  userAgent: 'PCSX2/archive',
  log: {
    debug: () => { },
    info: () => { },
    warn: console.warn,
    error: console.error
  },
  throttle: {
    onRateLimit: (retryAfter, options) => {
      octokit.log.warn(
        `Request quota exhausted for request ${options.method} ${options.url}`
      );

      // Retry twice after hitting a rate limit error, then give up
      if (options.request.retryCount <= 2) {
        console.log(`Retrying after ${retryAfter} seconds!`);
        return true;
      }
    },
    onAbuseLimit: (retryAfter, options) => {
      // does not retry, only logs a warning
      octokit.log.warn(
        `Abuse detected for request ${options.method} ${options.url}`
      );
    },
  }
})

const BUILD_DIR = `./../../builds/1.7 dev cycle/`
const METADATA_FILE = `./../../metadata/1.7/build-metadata.json`

import * as fs from 'fs';
import * as path from 'path';

let buildMetadata = JSON.parse(fs.readFileSync(METADATA_FILE));

console.log(chalk.blue(`Found ${buildMetadata.length} build metadata entries.  The first of which is: \n${JSON.stringify(buildMetadata[0], null, 2)}`));

let failures = [];

for (var i = 0; i < buildMetadata.length; i++) {
  console.log(chalk.yellow(`[${i+1}/${buildMetadata.length}]`) + ` Processing Metadata and Uploading Build`);
  let metadata = buildMetadata[i];

  try {
    var releaseBody = "This release corresponds to a commit that no longer exists.";
    if (metadata.commitFullSha != null) {
      releaseBody = `### Commit Information\n\n- **Author** - ${metadata.commitAuthor}\n- **Full SHA** - [${metadata.commitFullSha}](https://github.com/PCSX2/pcsx2/commit/${metadata.commitFullSha})\n- **Authored Date** - ${metadata.commitAuthoredDate}\n- **Committed Date** - ${metadata.commitCommitterDate}\n- **Commit Message**:\n\`\`\`\n${metadata.commitMessage}\n\`\`\`\n\n### Associated PRs\n\n`;
      if (metadata.associatedPullRequests.length == 0) {
        releaseBody += `- No Associated Pull Requests Found!`
      } else {
        for(var j = 0; j < metadata.associatedPullRequests.length; j++) {
          var pr = metadata.associatedPullRequests[j];
          var prNum = pr.url.split("/").slice(-1)[0];
          releaseBody += `- [${pr.title} - #${prNum}](${pr.url})`
        }
      }
      releaseBody += "\n";
    }

    const { data: release } = await octokit.rest.repos.createRelease({
      owner: "PCSX2",
      repo: "archive",
      tag_name: metadata.versionNumber,
      body: releaseBody,
      prerelease: true
    });

    var releaseId = release.id;

    var buildPath = path.join(BUILD_DIR, metadata.fileName);

    var assetBytes = fs.readFileSync(buildPath, null);

    const { data: uploadAsset } = await octokit.rest.repos.uploadReleaseAsset({
      owner: "PCSX2",
      repo: "archive",
      release_id: releaseId,
      name: metadata.fileName,
      data: assetBytes,
    });

    // Add some delay
    await new Promise(resolve => setTimeout(resolve, 2500));
  } catch (e) {
    console.log(chalk.red(`- Failed to Create Release - ${e}`));
    failures.push(metadata.fileName + " " + e);
  }
}

// Save JSON to a file
fs.writeFileSync('out/failures.json', JSON.stringify(failures, null, 2));
