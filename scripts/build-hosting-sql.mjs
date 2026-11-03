/**
 * Builds deploy/guinhawa_db.hosting.sql from guinhawa_db.sql for shared hosts.
 *
 * Shared hosting usually gives you an already-created database, so the dump
 * must not contain `CREATE DATABASE` / `USE`. The `DROP TABLE` statements are
 * removed too, so importing into a database that already has tables fails
 * loudly instead of silently deleting data.
 *
 * Run: npm run sql:hosting
 */

import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));

const source = await readFile(`${root}guinhawa_db.sql`, 'utf8');

const withoutCreate = source.replace(/CREATE DATABASE[\s\S]*?;\s*/i, '');
const withoutUse = withoutCreate.replace(/^[ \t]*USE\s+`?\w+`?\s*;\s*$/gim, '');
const withoutDrops = withoutUse
    .replace(/^[ \t]*DROP TABLE IF EXISTS[^\n]*\n/gim, '')
    .replace(/\n{3,}/g, '\n\n');

const header = `-- =====================================================================
-- Guinhawa Poultry Supply — hosted database import
--
-- Generated from guinhawa_db.sql by "npm run sql:hosting".
--
-- Import this file into an EMPTY database (phpMyAdmin -> Import). It has no
-- CREATE DATABASE / USE / DROP statements, so it cannot wipe existing data.
--
-- After import, either:
--   * import a phpMyAdmin export of your local guinhawa_db (keeps your admin,
--     employees and sales), or
--   * insert the Admin row from deploy/create-admin.sql once.
-- =====================================================================

`;

await writeFile(`${root}deploy/guinhawa_db.hosting.sql`, header + withoutDrops.trimStart(), 'utf8');

console.log('deploy/guinhawa_db.hosting.sql written.');
