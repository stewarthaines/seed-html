/**
 * The release feed: an Atom feed of the newest SEED.html versions, generated
 * from CHANGELOG.md on every docs build (design: process/RELEASE_FEED.md).
 *
 * The feed keeps no state of its own; it is rebuilt whole from the changelog,
 * and each entry's id is keyed on its version, so a re-cut release updates its
 * entry rather than adding another. A changelog the feed cannot read
 * faithfully throws, failing the docs build and so the deploy.
 */

import { readFileSync } from 'node:fs';
import { plainMarkdown } from './markdown.js';

export const FEED_URL = 'https://readitinabook.com/releases.xml';
const SITE_URL = 'https://readitinabook.com/';
const CHANGELOG_URL = 'https://github.com/stewarthaines/seed-html/blob/main/CHANGELOG.md';
// The year the id scheme was set, not a release year. Never change it: every
// published id would change and readers would show old releases as new.
const TAG_PREFIX = 'tag:readitinabook.com,2026:seed-html';
export const ENTRY_COUNT = 8;

const UNRELEASED = '[Unreleased]';
const VERSION_HEADING = /^\[(\d+\.\d+\.\d+)\] - (\d{4}-\d{2}-\d{2})$/;

/**
 * @typedef {{ heading: string | null, body: string, hasItems: boolean }} Subsection
 * @typedef {{ version: string, date: string, subsections: Subsection[] }} Release
 */

/**
 * Split a Keep a Changelog source into its dated releases, newest first as
 * written. Headings come from markdown-it's token stream, so a `## ` inside a
 * code block is never mistaken for a section. Subsections with nothing under
 * them are dropped.
 *
 * @param {string} source CHANGELOG.md text
 * @param {import('markdown-it')} md a plain markdown-it instance
 * @returns {Release[]}
 * @throws when a `## ` heading is neither `[Unreleased]` nor `[x.y.z] - YYYY-MM-DD`,
 *   a date is not a real date, or a version appears twice
 */
export function parseChangelog(source, md) {
  const lines = source.split('\n');
  const tokens = md.parse(source, {});
  const headings = [];
  tokens.forEach((token, i) => {
    if (token.type === 'heading_open' && (token.tag === 'h2' || token.tag === 'h3')) {
      headings.push({
        level: token.tag === 'h2' ? 2 : 3,
        start: token.map[0],
        end: token.map[1],
        text: tokens[i + 1].content.trim(),
      });
    }
  });

  const slice = (from, to) => lines.slice(from, to).join('\n').trim();
  const releases = [];
  const seen = new Set();
  let current = null;

  headings.forEach((heading, i) => {
    const next = headings[i + 1]?.start ?? lines.length;
    if (heading.level === 2) {
      current = null;
      if (heading.text === UNRELEASED) return;
      const match = VERSION_HEADING.exec(heading.text);
      if (!match) {
        throw new Error(
          `CHANGELOG.md line ${heading.start + 1}: "## ${heading.text}" is neither ${UNRELEASED} nor [x.y.z] - YYYY-MM-DD`
        );
      }
      const [, version, date] = match;
      if (new Date(`${date}T00:00:00Z`).toISOString().slice(0, 10) !== date) {
        throw new Error(`CHANGELOG.md line ${heading.start + 1}: ${date} is not a real date`);
      }
      if (seen.has(version)) {
        throw new Error(`CHANGELOG.md line ${heading.start + 1}: ${version} appears twice`);
      }
      seen.add(version);
      current = { version, date, subsections: [] };
      releases.push(current);
      // Anything between the version heading and its first subheading.
      addSubsection(current, null, slice(heading.end, next), md);
    } else if (current) {
      addSubsection(current, heading.text, slice(heading.end, next), md);
    }
  });
  return releases;
}

function addSubsection(release, heading, body, md) {
  if (!body) return;
  const hasItems = md.parse(body, {}).some(token => token.type === 'list_item_open');
  release.subsections.push({ heading, body, hasItems });
}

/**
 * Check the releases the feed will publish.
 *
 * @param {Release[]} releases from parseChangelog
 * @param {string} packageVersion package.json's version
 * @param {number} count how many releases the feed carries
 * @throws when there are no releases, the newest is not the package version,
 *   or a published release has no list items
 */
export function checkReleases(releases, packageVersion, count = ENTRY_COUNT) {
  if (releases.length === 0) throw new Error('CHANGELOG.md has no dated releases');
  if (releases[0].version !== packageVersion) {
    throw new Error(
      `CHANGELOG.md's newest release is ${releases[0].version} but package.json is ${packageVersion}: cut the changelog section when bumping the version`
    );
  }
  for (const release of releases.slice(0, count)) {
    if (!release.subsections.some(s => s.hasItems)) {
      throw new Error(`CHANGELOG.md: ${release.version} has no list items`);
    }
  }
}

/** Escape text for XML element content and attribute values. */
export function escapeXml(text) {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

/**
 * The Atom feed for the newest `count` releases.
 *
 * @param {Release[]} releases from parseChangelog, already checked
 * @param {(markdown: string) => string} render Markdown → HTML
 * @param {number} count how many releases to include
 * @returns {string} the feed document
 */
export function buildFeed(releases, render, count = ENTRY_COUNT) {
  const published = releases.slice(0, count);
  const timestamp = date => `${date}T00:00:00Z`;
  const entries = published.map(({ version, date, subsections }) => {
    const html = subsections
      .map(
        ({ heading, body }) =>
          (heading ? `<h3>${escapeXml(heading)}</h3>\n` : '') + render(body).trim()
      )
      .join('\n');
    return `  <entry>
    <title>SEED.html ${escapeXml(version)}</title>
    <id>${TAG_PREFIX}/${escapeXml(version)}</id>
    <updated>${timestamp(date)}</updated>
    <link rel="alternate" type="text/html" href="${CHANGELOG_URL}"/>
    <content type="html">${escapeXml(html)}</content>
  </entry>`;
  });

  return `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>SEED.html releases</title>
  <subtitle>New versions of SEED.html, the Simple EPUB Editor.</subtitle>
  <id>${TAG_PREFIX}/releases</id>
  <link rel="self" type="application/atom+xml" href="${FEED_URL}"/>
  <link rel="alternate" type="text/html" href="${SITE_URL}"/>
  <updated>${timestamp(published[0].date)}</updated>
  <author><name>Stewart Haines</name></author>
${entries.join('\n')}
</feed>
`;
}

/** The feed for the repository's CHANGELOG.md and package.json version. */
export function releaseFeed() {
  const changelog = readFileSync('CHANGELOG.md', 'utf8');
  const { version } = JSON.parse(readFileSync('package.json', 'utf8'));
  const releases = parseChangelog(changelog, plainMarkdown);
  checkReleases(releases, version);
  return buildFeed(releases, source => plainMarkdown.render(source));
}
