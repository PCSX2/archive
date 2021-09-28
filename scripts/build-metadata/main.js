// Enumerate through a collection of builds and aggregate the following:
// - file path to build
// - version number
// - commit author (if git)
// - commit full sha (if git)
// - commit message (if git)
// - associated PR (if git)
// - commit date (if git)

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

// Find all builds
import * as fs from 'fs';
let dirCont = fs.readdirSync(BUILD_DIR);
let files = dirCont.filter(function (elm) { return elm.match(/.*\.(7z?)/ig); });

console.log(chalk.blue(`Found ${files.length} builds.  One of which is - ${files[0]}`));

let failures = [];
let builds = [];

await processBuilds(files);

// Save JSON to a file
fs.writeFileSync('out/failures.json', JSON.stringify(failures, null, 2));
fs.writeFileSync('out/build-metadata.json', JSON.stringify(builds, null, 2));

async function processBuilds(buildList) {
  for (var i = 0; i < buildList.length; i++) {
    console.log(chalk.yellow(`[${i+1}/${buildList.length}]`) + ` Processing Builds`);
    let fileName = buildList[i];
    let buildProps = fileName.split("-");
    let semverComponents = buildProps[1].substring(1).split(".");
    let semverMajor = semverComponents[0];
    let semverMinor = semverComponents[1];
    let patchVer = buildProps[3];
    let shortHash = buildProps[4].substring(1);
    try {
      const { data: commit } = await octokit.rest.repos.getCommit({
        owner: "PCSX2",
        repo: "pcsx2",
        ref: shortHash,
      });

      const { data: associatedPulls } = await octokit.rest.repos.listPullRequestsAssociatedWithCommit({
        owner: "PCSX2",
        repo: "pcsx2",
        commit_sha: commit.sha,
      });

      let associatedPRs = [];
      for (var j = 0; j < associatedPulls.length; j++) {
        associatedPRs.push({
          title: associatedPulls[j].title,
          url: associatedPulls[j].html_url
        });
      }

      builds.push({
        fileName: fileName,
        versionNumber: `v${semverMajor}.${semverMinor}.${patchVer}`,
        commitAuthor: commit.commit.author.name,
        commitFullSha: commit.sha,
        commitMessage: commit.commit.message,
        commitAuthoredDate: commit.commit.author.date,
        commitCommitterDate: commit.commit.committer.date,
        associatedPullRequests: associatedPRs
      })
    } catch (e) {
      console.log(chalk.red(`- Failed to Retrieve Info - ${e}`));
      failures.push(fileName + " " + e);
      builds.push({
        fileName: fileName,
        versionNumber: `v${semverMajor}.${semverMinor}.${patchVer}`,
        commitAuthor: null,
        commitFullSha: null,
        commitMessage: null,
        commitAuthoredDate: null,
        commitCommitterDate: null,
        associatedPullRequests: null
      })
    }
  }
}


