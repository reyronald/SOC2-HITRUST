#!/usr/bin/env node

// @ts-check

import fs from "node:fs";

const REPO = process.env.REPO;
const ACCESS_TOKEN = process.env.ACCESS_TOKEN;

const ENV_START_AT = process.env.START_AT;
const ENV_END_AT = process.env.END_AT;

const DEFAULT_START_AT = new Date("2023-10-01T00:00:00Z"); // October 1st, 2023
const DEFAULT_END_AT = new Date("2024-09-30T23:59:59Z"); // September 30th, 2024

const START_AT = ENV_START_AT ? new Date(ENV_START_AT) : DEFAULT_START_AT;
const END_AT = ENV_END_AT ? new Date(ENV_END_AT) : DEFAULT_END_AT;

const args = process.argv.slice(2).map((s) => s.toLowerCase());

if (args.includes("help") || args.includes("-h")) {
  showUsage();
  process.exit(0);
}

assertIsDefined(REPO, "REPO");
assertIsDefined(ACCESS_TOKEN, "ACCESS_TOKEN");

/**
 * @typedef {Object} GithubPullRequest
 * @prop {string} title
 * @prop {string} html_url
 * @prop {string} created_at
 * @prop {object} user: { login: string }
 * @prop {string | null} merged_at
 * @prop {string | null} closed_at
 */

/**
 * @typedef {Object} SlimPullRequest
 * @prop {string} title
 * @prop {string} html_url
 * @prop {string} user
 * @prop {Date} created_at
 * @prop {Date} merged_at
 */

function assertIsDefined(
  /** @type *unknown */ val,
  /** @type {string} */ name
) {
  if (val == null) {
    console.error(
      `\n` +
        `❌ Expected "${name}" to be defined. \n` +
        `   It needs to be passed as an environment variable.\n`
    );
    showUsage();
    process.exit(1);
  }
}

function showUsage() {
  console.log(`
    Example usage:
      
      export var REPO=org/repo
      export var ACCESS_TOKEN=ghp_...

      # Optional
      export var START_AT=2023-10-01T00:00:00Z
      export var END_AT=2024-09-30T23:59:59Z
  
      npx reyronald/SOC2-HITRUST exec
    
    Get you Github Access Token at https://github.com/settings/tokens
      
  `);
}

async function getPullRequests(/** @type {number} */ page) {
  // https://docs.github.com/en/rest/pulls/pulls?apiVersion=2022-11-28#list-pull-requests
  const query = new URLSearchParams([
    ["state", "closed"],
    ["base", "main"],
    ["sort", "created"],
    ["direction", "desc"],
    ["per_page", "100"],
    ["page", page.toString()],
  ]);
  const url = `https://api.github.com/repos/${REPO}/pulls?${query.toString()}`;

  const response = await fetch(url, {
    headers: {
      Authorization: `token ${ACCESS_TOKEN}`,
      Accept: "application/vnd.github.v3+json",
    },
  });

  if (!response.ok) {
    throw new Error(
      `Error fetching pull requests: ${response.status} ${response.statusText}`
    );
  }

  /** @type {GithubPullRequest[]} */
  const pullRequests = await response.json();

  /** @type {SlimPullRequest[]} */
  const result = pullRequests
    .filter((pr) => pr.merged_at != null)
    .map((pr) => ({
      title: pr.title,
      html_url: pr.html_url,
      user: pr.user.login,
      created_at: new Date(pr.created_at),
      merged_at: new Date(pr.merged_at),
    }));

  return result;
}

async function main() {
  console.log(
    `\n` +
      `⌛️ Getting pull requests in ${REPO} \n` +
      `   from ${START_AT.toISOString()} to ${END_AT.toISOString()}. \n` +
      `   Please wait...\n`
  );

  /** @type {SlimPullRequest[]} */
  const allPullRequests = [];

  for (
    let page = 1;
    allPullRequests.length === 0 ||
    allPullRequests.at(-1).merged_at >= START_AT;
    page++
  ) {
    const pullRequestsPage = await getPullRequests(page);
    allPullRequests.push(...pullRequestsPage);
  }

  allPullRequests.sort(
    (a, b) => -b.merged_at.getTime() + a.merged_at.getTime()
  );

  const pullRequestsInDateRange = allPullRequests.filter(
    (pr) => pr.merged_at >= START_AT && pr.merged_at <= END_AT
  );

  const csv =
    [
      // Columns
      "URL",
      "Title",
      "Author",
      "Created",
      "Merged",
    ].join(",") +
    "\n" +
    pullRequestsInDateRange
      .map((pr) =>
        [
          pr.html_url,
          `"${pr.title}"`,
          pr.user,
          pr.created_at.toISOString(),
          pr.merged_at.toISOString(),
        ].join(",")
      )
      .join("\n");

  const repoName = REPO?.split("/")[1] || "";
  const filename = `${repoName} pull requests from ${START_AT.toUTCString()} to ${END_AT.toUTCString()}.csv`;

  fs.writeFileSync(filename, csv);

  console.log(
    `✅ Saved ${pullRequestsInDateRange.length} pull requests to file:\n\n ${filename}\n`
  );
}

void main();
