import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

if (process.platform !== 'win32') throw new Error('OGP regeneration uses Windows System.Drawing. The generated PNG is already included.');
const root = resolve(import.meta.dirname, '..');
let source = (await readFile(resolve(root, 'scripts/create-ogp.ps1'), 'utf8')).replace(/^\uFEFF/, '');
source = "$ProgressPreference = 'SilentlyContinue'\n" + source;
source = source.replace('$projectRoot = Split-Path -Parent $PSScriptRoot', '$projectRoot = (Get-Location).Path');
const result = spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-EncodedCommand', Buffer.from(source, 'utf16le').toString('base64')], { cwd: root, encoding: 'utf8', windowsHide: true });
if (result.stdout) process.stdout.write(result.stdout);
if (result.stderr) process.stderr.write(result.stderr);
process.exitCode = result.status ?? 1;
