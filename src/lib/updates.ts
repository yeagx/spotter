import Constants from 'expo-constants';

// Where release APKs are published. Must match the GitHub repo the releases go to.
export const GITHUB_REPO = 'yeagx/spotter';

export const APP_VERSION = Constants.expoConfig?.version ?? '0.0.0';

type Version = [number, number, number];

// Tags are vMAJOR.MINOR.PATCH and match app.json's version.
export function parseVersion(s: string): Version | null {
  const m = s.trim().match(/^v?(\d+)\.(\d+)\.(\d+)$/);
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
}

export function isNewer(candidate: string, current: string): boolean {
  const a = parseVersion(candidate);
  const b = parseVersion(current);
  if (!a || !b) return false;
  for (let i = 0; i < 3; i++) {
    if (a[i] !== b[i]) return a[i] > b[i];
  }
  return false;
}

export type Release = { version: string; notes: string; url: string };

export type UpdateResult = { status: 'latest' } | { status: 'available'; release: Release };

type GitHubRelease = {
  tag_name: string;
  body: string | null;
  html_url: string;
  assets: { name: string; browser_download_url: string }[];
};

// Asks GitHub for the latest release and compares it with this build.
// Throws when GitHub can't be reached, so the screen can say so.
export async function checkForUpdate(): Promise<UpdateResult> {
  const res = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/releases/latest`, {
    headers: { Accept: 'application/vnd.github+json' },
  });
  if (res.status === 404) return { status: 'latest' }; // nothing published yet
  if (!res.ok) throw new Error(`GitHub responded ${res.status}`);
  const latest = (await res.json()) as GitHubRelease;
  if (!isNewer(latest.tag_name, APP_VERSION)) return { status: 'latest' };
  const apk = latest.assets.find((a) => a.name.toLowerCase().endsWith('.apk'));
  return {
    status: 'available',
    release: {
      version: latest.tag_name.replace(/^v?/, 'v'),
      notes: plainNotes(latest.body ?? ''),
      url: apk?.browser_download_url ?? latest.html_url,
    },
  };
}

// Release notes are Markdown; show them as calm plain text.
function plainNotes(md: string) {
  return md
    .replace(/\r/g, '')
    .replace(/^#+\s*/gm, '')
    .replace(/^\s*[-*]\s+/gm, '· ')
    .replace(/\*\*|__|`/g, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .trim();
}
