/** P0021 S89a: strict development-preview staging. NOT a release builder.
 * A preview can expose the current legacy UI/engine; never ship to pupils.
 * Exports are pure or explicit I/O so they can be tested using mock roots.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const MANIFEST_MARKER='newCAS-student-preview-allowlist/v1';
const ALLOWED_ROOTS = new Set(['src', 'lib']);
const ALLOWED_EXT = new Set(['.html','.css','.js','.mjs','.py','.woff2']);
const REQUIRED = new Set(['index.html','LICENSE','src/js/main.js','src/js/parser.mjs','src/js/document-runtime.js']);

export function validateStudentPreviewManifest(manifest) {
  if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest) ||
      Object.keys(manifest).sort().join(',') !== '$schema,files,releaseReady,status' ||
      manifest.$schema !== MANIFEST_MARKER ||
      manifest.releaseReady !== false || manifest.status !== 'DEVELOPMENT_PREVIEW_ONLY' ||
      !Array.isArray(manifest.files) || !manifest.files.length) {
    throw new Error('S89a requires exact development-only allowlist manifest');
  }
  const seen = new Set();
  for (const entry of manifest.files) {
    if (typeof entry !== 'string' || !entry.length || entry.includes('\\') ||
        entry.startsWith('/') || entry.includes('//') || entry.includes(':') ||
        entry.split('/').some(segment => segment === '.' || segment === '..' || segment.startsWith('.')) ||
        entry.endsWith('/') || !/^[A-Za-z0-9_./-]+$/.test(entry)) {
      throw new Error(`Unsafe allowlist path: ${String(entry)}`);
    }
    const normalized=entry.toLowerCase();
    if (seen.has(normalized)) throw new Error(`Duplicate allowlist path: ${entry}`);
    seen.add(normalized);
    const parts=entry.split('/');
    const root=parts[0];
    const ext=path.posix.extname(entry);
    if ((root !== 'index.html' && root !== 'LICENSE' && !ALLOWED_ROOTS.has(root)) ||
        (root==='src' && !['js','python','css'].includes(parts[1])) ||
        (root==='lib' && parts[1]!=='katex') ||
        (root!=='LICENSE' && !ALLOWED_EXT.has(ext)) ||
        /(?:^|\/)(?:tests?|tools|reports|migrations|node_modules|__pycache__|\.git)(?:\/|$)/i.test(entry) ||
        /(?:\.zip|\.log|\.ps1|\.map|\.md|\.json|\.pyc)$/i.test(entry)) {
      throw new Error(`Non-runtime or developer artifact on allowlist: ${entry}`);
    }
  }
  for (const required of REQUIRED) {
    if (!seen.has(required.toLowerCase())) throw new Error(`Required runtime input missing: ${required}`);
  }
  return Object.freeze([...manifest.files]);
}

function regularFileWithoutSymlink(root, relative) {
  // Refuse symlinks in every path component, including the repository root.
  const base=path.resolve(root);
  if (!fs.statSync(base).isDirectory() || fs.lstatSync(base).isSymbolicLink()) {
    throw new Error(`Not a real repository directory: ${base}`);
  }
  let current=base;
  for (const part of relative.split('/')) {
    current=path.join(current,part);
    const st=fs.lstatSync(current); // Missing inputs must fail closed.
    if (st.isSymbolicLink()) throw new Error(`Symlink forbidden: ${relative}`);
  }
  if (!fs.statSync(current).isFile()) throw new Error(`Not a regular file: ${relative}`);
  return current;
}

export function verifyStudentPreviewInputs(root, manifest) {
  const included=validateStudentPreviewManifest(manifest);
  return included.map(relative=>({relative,source:regularFileWithoutSymlink(root,relative)}));
}

export function stageStudentPreview(root, manifest, destination) {
  const included=verifyStudentPreviewInputs(root,manifest); // No writes before every input is valid.
  const output=path.resolve(destination);
  const base=path.resolve(root);
  if (output===base || output.startsWith(base+path.sep) || base.startsWith(output+path.sep)) {
    throw new Error('Stage outside the repository to prevent recursive/cross-contaminated output');
  }
  if (fs.existsSync(output)) throw new Error('Destination must not exist (never overwrite prior preview)');
  fs.mkdirSync(output,{recursive:true});
  for (const {relative,source} of included) {
    const target=path.join(output,...relative.split('/'));
    fs.mkdirSync(path.dirname(target),{recursive:true});
    fs.copyFileSync(source,target,fs.constants.COPYFILE_EXCL);
  }
  return Object.freeze(included.map(x=>x.relative));
}

export function assertNotStudentRelease(manifest) {
  validateStudentPreviewManifest(manifest);
  throw new Error('STUDENT RELEASE BLOCKED: current UI still uses legacy CASEngine; this is preview-only, no pupil ZIP');
}

const invoked=process.argv[1] && path.resolve(process.argv[1])===fileURLToPath(import.meta.url);
if (invoked) {
  try {
    const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
    const manifest=JSON.parse(fs.readFileSync(new URL('./student-preview-manifest.json',import.meta.url),'utf8'));
    if (process.argv.length===3 && process.argv[2]==='--verify') {
      const entries=verifyStudentPreviewInputs(root,manifest);
      console.log(`S89a: ${entries.length} explicitly allowlisted runtime files verified (preview only).`);
    } else if (process.argv.length===3 && process.argv[2]==='--release') {
      assertNotStudentRelease(manifest);
    } else {
      throw new Error('Usage: node tools/release/student-preview.mjs --verify | --release (blocked)');
    }
  } catch (error) {
    console.error(error.message);
    process.exitCode=1;
  }
}
