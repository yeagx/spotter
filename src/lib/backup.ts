import { File, FileMode, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import type { SQLiteDatabase } from 'expo-sqlite';

import { localDate } from '@/lib/dates';
import { APP_VERSION } from '@/lib/updates';

// Moving Spotter to another phone: everything (profile, plan, every session and set,
// check-ins, progress photos, your own exercises and their clips) in one .spotter file.
// Back up on the old phone, send the file anywhere (Drive, yourself on WhatsApp, a cable),
// then restore it on the new one, from Profile or the first onboarding step.
//
// The file is a small archive, so a long clip never has to sit in memory as text:
//   "SPOTTER-BACKUP-1" (16 bytes) · header length (4 bytes, big-endian) · header (UTF-8
//   JSON: every table's rows, and the list of files) · each file's bytes, in that order.

const MAGIC = 'SPOTTER-BACKUP-1';
const CHUNK = 1024 * 1024;

type Row = Record<string, unknown>;
type Header = {
  app: string; // version that made it
  schema: number; // PRAGMA user_version at the time
  createdAt: number;
  docUri: string; // the documents folder on that phone, for rewriting photo paths
  tables: Record<string, Row[]>;
  files: { name: string; size: number }[];
};

export type RestoreProblem = 'not-a-backup' | 'newer' | 'failed';

// ---------- Back up ----------

// Builds the file and opens the share sheet to put it somewhere safe. Throws on failure.
export async function shareBackup(db: SQLiteDatabase): Promise<void> {
  const file = await writeBackup(db);
  await Sharing.shareAsync(file.uri, {
    mimeType: 'application/octet-stream',
    dialogTitle: 'Save your Spotter backup',
  });
}

async function writeBackup(db: SQLiteDatabase): Promise<File> {
  const tables: Record<string, Row[]> = {};
  for (const name of await tableNames(db)) {
    tables[name] = await db.getAllAsync<Row>(`SELECT * FROM "${name}"`);
  }
  const files = appFiles(tables).flatMap((name) => {
    const f = new File(Paths.document, name);
    return f.exists ? [{ name, size: f.size ?? 0 }] : [];
  });
  const schema = (await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version'))?.user_version ?? 0;
  const header: Header = {
    app: APP_VERSION,
    schema,
    createdAt: Date.now(),
    docUri: Paths.document.uri,
    tables,
    files,
  };

  const out = new File(Paths.cache, `spotter-backup-${localDate(new Date())}.spotter`);
  if (out.exists) out.delete();
  out.create();
  const h = out.open(FileMode.Truncate);
  try {
    const json = utf8Encode(JSON.stringify(header));
    await h.writeBytes(utf8Encode(MAGIC));
    await h.writeBytes(uint32(json.length));
    await h.writeBytes(json);
    for (const f of files) {
      const src = new File(Paths.document, f.name).open(FileMode.ReadOnly);
      try {
        let left = f.size;
        while (left > 0) {
          const bytes = await src.readBytes(Math.min(CHUNK, left));
          if (bytes.length === 0) throw new Error(`Short read: ${f.name}`);
          await h.writeBytes(bytes);
          left -= bytes.length;
        }
      } finally {
        src.close();
      }
    }
  } finally {
    h.close();
  }
  return out;
}

// Files in the documents folder that rows point at: the profile photo, progress photos,
// and photos or clips attached to your own exercises.
function appFiles(tables: Record<string, Row[]>): string[] {
  const doc = Paths.document.uri;
  const names = new Set<string>();
  const fromUri = (uri: unknown) => {
    if (typeof uri === 'string' && uri.startsWith(doc)) names.add(uri.slice(doc.length).replace(/^\//, ''));
  };
  tables.profile?.forEach((r) => fromUri(r.photo_uri));
  tables.checkin_photo?.forEach((r) => fromUri(r.uri));
  tables.exercise?.forEach((r) => {
    try {
      const media = JSON.parse(String(r.media_json ?? 'null'));
      if (media?.type === 'file' && typeof media.name === 'string') names.add(media.name);
    } catch {
      // not ours to fix here
    }
  });
  // Only plain names in the folder itself, never a path that climbs out of it.
  return [...names].filter((n) => n && !n.includes('/') && !n.includes('..'));
}

// ---------- Restore ----------

// Lets the user pick a backup file. Null if they backed out.
export async function pickBackup(): Promise<File | null> {
  const picked = await File.pickFileAsync({ mimeTypes: '*/*' });
  return picked.canceled ? null : picked.result;
}

// Reads just enough of a picked file to say what's in it, for the "replace everything?"
// question. Null if it isn't a Spotter backup.
export async function describeBackup(file: File): Promise<{ createdAt: number; sessions: number } | null> {
  try {
    const { header } = await readHeader(file);
    return { createdAt: header.createdAt, sessions: header.tables.session?.length ?? 0 };
  } catch {
    return null;
  }
}

// Replaces everything on this phone with the backup. Returns a problem, or null when done.
export async function restoreBackup(db: SQLiteDatabase, file: File): Promise<RestoreProblem | null> {
  let read: Awaited<ReturnType<typeof readHeader>>;
  try {
    read = await readHeader(file);
  } catch {
    return 'not-a-backup';
  }
  const { header, h } = read;
  try {
    const schema = (await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version'))?.user_version ?? 0;
    // Made by a newer Spotter: its tables may have columns this one doesn't know.
    if (header.schema > schema) return 'newer';

    // Files first: if one fails, the database is still untouched.
    for (const f of header.files) {
      if (f.name.includes('/') || f.name.includes('..')) throw new Error('Bad file name');
      const dest = new File(Paths.document, f.name);
      if (dest.exists) dest.delete();
      dest.create();
      const out = dest.open(FileMode.Truncate);
      try {
        let left = f.size;
        while (left > 0) {
          const bytes = await h.readBytes(Math.min(CHUNK, left));
          if (bytes.length === 0) throw new Error('Backup ends early');
          await out.writeBytes(bytes);
          left -= bytes.length;
        }
      } finally {
        out.close();
      }
    }

    // Rows go in with foreign keys off (tables are filled in any order), and only the
    // columns this version has. A column added since the backup takes its default.
    await db.execAsync('PRAGMA foreign_keys = OFF');
    try {
      const current = await tableNames(db);
      await db.withTransactionAsync(async () => {
        for (const t of current) await db.runAsync(`DELETE FROM "${t}"`);
        for (const t of current) {
          const rows = header.tables[t];
          if (!rows?.length) continue;
          const cols = new Set(
            (await db.getAllAsync<{ name: string }>(`PRAGMA table_info("${t}")`)).map((c) => c.name),
          );
          for (const row of rows) {
            const keys = Object.keys(row).filter((k) => cols.has(k));
            if (!keys.length) continue;
            await db.runAsync(
              `INSERT INTO "${t}" (${keys.map((k) => `"${k}"`).join(', ')}) VALUES (${keys.map(() => '?').join(', ')})`,
              keys.map((k) => row[k] as string | number | null),
            );
          }
        }
        // Photos point at the documents folder of the phone that made the backup.
        const from = header.docUri;
        const to = Paths.document.uri;
        if (from && from !== to) {
          await db.runAsync('UPDATE profile SET photo_uri = REPLACE(photo_uri, ?, ?) WHERE photo_uri LIKE ?', from, to, `${from}%`);
          await db.runAsync('UPDATE checkin_photo SET uri = REPLACE(uri, ?, ?) WHERE uri LIKE ?', from, to, `${from}%`);
        }
      });
    } finally {
      await db.execAsync('PRAGMA foreign_keys = ON');
    }
    return null;
  } catch (e) {
    if (__DEV__) console.warn('Restore failed', e);
    return 'failed';
  } finally {
    h.close();
  }
}

async function readHeader(file: File) {
  const h = file.open(FileMode.ReadOnly);
  try {
    const magic = utf8Decode(await h.readBytes(MAGIC.length));
    if (magic !== MAGIC) throw new Error('Not a backup');
    const len = readUint32(await h.readBytes(4));
    const header = JSON.parse(utf8Decode(await h.readBytes(len))) as Header;
    if (!header?.tables || !Array.isArray(header.files)) throw new Error('Not a backup');
    return { header, h };
  } catch (e) {
    h.close();
    throw e;
  }
}

async function tableNames(db: SQLiteDatabase): Promise<string[]> {
  const rows = await db.getAllAsync<{ name: string }>(
    "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'",
  );
  return rows.map((r) => r.name);
}

// ---------- Bytes ----------

function uint32(n: number) {
  return new Uint8Array([(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255]);
}

function readUint32(b: Uint8Array) {
  if (b.length < 4) throw new Error('Short header');
  return ((b[0] << 24) | (b[1] << 16) | (b[2] << 8) | b[3]) >>> 0;
}

// UTF-8 by hand: TextEncoder/TextDecoder aren't on every Hermes build.
function utf8Encode(s: string): Uint8Array {
  const out: number[] = [];
  for (let i = 0; i < s.length; i++) {
    let c = s.charCodeAt(i);
    if (c >= 0xd800 && c < 0xdc00 && i + 1 < s.length) {
      const d = s.charCodeAt(i + 1);
      if (d >= 0xdc00 && d < 0xe000) {
        c = 0x10000 + ((c - 0xd800) << 10) + (d - 0xdc00);
        i++;
      }
    }
    if (c < 0x80) out.push(c);
    else if (c < 0x800) out.push(0xc0 | (c >> 6), 0x80 | (c & 63));
    else if (c < 0x10000) out.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
    else out.push(0xf0 | (c >> 18), 0x80 | ((c >> 12) & 63), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
  }
  return new Uint8Array(out);
}

function utf8Decode(b: Uint8Array): string {
  let s = '';
  let chunk: number[] = [];
  const flush = () => {
    s += String.fromCharCode(...chunk);
    chunk = [];
  };
  for (let i = 0; i < b.length; ) {
    const c = b[i++];
    let cp: number;
    if (c < 0x80) cp = c;
    else if (c < 0xe0) cp = ((c & 31) << 6) | (b[i++] & 63);
    else if (c < 0xf0) cp = ((c & 15) << 12) | ((b[i++] & 63) << 6) | (b[i++] & 63);
    else cp = ((c & 7) << 18) | ((b[i++] & 63) << 12) | ((b[i++] & 63) << 6) | (b[i++] & 63);
    if (cp >= 0x10000) {
      cp -= 0x10000;
      chunk.push(0xd800 + (cp >> 10), 0xdc00 + (cp & 1023));
    } else chunk.push(cp);
    if (chunk.length > 8000) flush();
  }
  flush();
  return s;
}
