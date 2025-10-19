#!/usr/bin/env node

import { writeFile } from 'node:fs/promises';

const repository = process.env.GITHUB_REPOSITORY;
if (!repository) {
  console.error('generate-changelog: GITHUB_REPOSITORY is not defined.');
  process.exit(1);
}

const githubToken = process.env.GITHUB_TOKEN;
if (!githubToken) {
  console.error('generate-changelog: GITHUB_TOKEN is required to query release notes.');
  process.exit(1);
}

const releases = [];
const perPage = 100;

for (let page = 1; page < 100; page += 1) {
  const apiUrl = `https://api.github.com/repos/${repository}/releases?per_page=${perPage}&page=${page}`;
  const response = await fetch(apiUrl, {
    headers: {
      Accept: 'application/vnd.github+json',
      'User-Agent': 'vscode-asn1-release-workflow',
      Authorization: `Bearer ${githubToken}`
    }
  });

  if (!response.ok) {
    console.error(`generate-changelog: Failed to fetch releases (${response.status} ${response.statusText}).`);
    const details = await response.text();
    console.error(details);
    process.exit(1);
  }

  const pageData = await response.json();
  if (!Array.isArray(pageData) || pageData.length === 0) {
    break;
  }

  releases.push(...pageData);

  if (pageData.length < perPage) {
    break;
  }
}

if (releases.length === 0) {
  console.warn('generate-changelog: No releases found; writing placeholder changelog.');
}

const lines = ['# Changelog', ''];

for (const release of releases) {
  if (release.draft) {
    continue;
  }

  const title = release.name || release.tag_name || 'Untitled release';
  const publishedAt = release.published_at ? new Date(release.published_at).toISOString().split('T')[0] : 'Unpublished';
  const body = (release.body || '').trim();

  lines.push(`## ${title} (${publishedAt})`);
  lines.push('');
  lines.push(body.length > 0 ? body : '_No release notes provided._');
  lines.push('');
}

const changelogContents = lines.join('\n').trimEnd() + '\n';
await writeFile('CHANGELOG.md', changelogContents, { encoding: 'utf8' });
console.log('generate-changelog: Wrote aggregated release notes to CHANGELOG.md');
