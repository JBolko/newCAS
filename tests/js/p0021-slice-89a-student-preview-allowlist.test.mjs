/** S89a: prove source allowlisting excludes developer artifacts even when present. */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {readFileSync} from 'node:fs';
import {validateStudentPreviewManifest, verifyStudentPreviewInputs,
  stageStudentPreview, assertNotStudentRelease} from '../../tools/release/student-preview.mjs';

const manifest = JSON.parse(readFileSync(new URL('../../tools/release/student-preview-manifest.json',import.meta.url),'utf8'));
const required = ['index.html','LICENSE','src/js/main.js','src/js/parser.mjs','src/js/document-runtime.js'];
const mini = Object.freeze({$schema:manifest.$schema, status:manifest.status,
  releaseReady:false,files:required});
function fixture(callback) {
  const workspace=fs.mkdtempSync(path.join(os.tmpdir(),'newcas-s89a-'));
  try {
    const root=path.join(workspace,'repository');fs.mkdirSync(root);
    for (const file of required) {
      const target=path.join(root,file);fs.mkdirSync(path.dirname(target),{recursive:true});
      fs.writeFileSync(target,`fixture: ${file}`);
    }
    return callback({root,workspace});
  } finally { fs.rmSync(workspace,{recursive:true,force:true}); }
}

test('S89a: production-derived manifest is explicit and never marked release-ready',()=>{
  const entries=validateStudentPreviewManifest(manifest);
  assert.ok(entries.length>60);
  assert.equal(manifest.releaseReady,false);
  assert.equal(manifest.status,'DEVELOPMENT_PREVIEW_ONLY');
  for (const p of entries) assert.ok(!/^(?:tools|tests|docs|node_modules)\//.test(p),p);
  assert.ok(entries.includes('src/js/parser.mjs'));
  assert.ok(entries.includes('lib/katex/katex.min.css'));
  assert.ok(entries.includes('src/python/evaluator/selected_gateway_bridge.py'));
});

test('S89a: strict allowlist rejects zipped test logs, migrations, docs, traversal and collisions',()=>{
  for (const extra of ['tools/reports/slice88a.zip','tools/migrations/run.ps1',
    'tests/js/not-for-students.test.mjs','docs/architecture/spec.md',
    'src/../tools/x.js','src/js/../../secrets.js','src/js/.hidden.js',
    'src/js/any.zip','src/js/any.log','node_modules/peggy/main.js']) {
    assert.throws(()=>validateStudentPreviewManifest({...mini,files:[...required,extra]}),extra);
  }
  assert.throws(()=>validateStudentPreviewManifest({...mini,files:[...required,'src/js/MAIN.js']}));
  assert.throws(()=>validateStudentPreviewManifest({...mini,releaseReady:true}));
});

test('S89a: all inputs validated before stage, no partial destination on missing file',()=>fixture(({root,workspace})=>{
  const output=path.join(workspace,'preview');
  fs.unlinkSync(path.join(root,'src/js/main.js'));
  assert.throws(()=>stageStudentPreview(root,mini,output));
  assert.equal(fs.existsSync(output),false);
}));

test('S89a: explicitly included assets only; previous reports and private files excluded',()=>fixture(({root,workspace})=>{
  const extra=['tools/reports/slice88a-results.zip','tools/migrations/script.ps1',
    'tests/js/sample.test.mjs','repomix-all.md','.env','node_modules/secret.js'];
  for (const file of extra) {
    const p=path.join(root,file);fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,'private');
  }
  assert.equal(verifyStudentPreviewInputs(root,mini).length,required.length);
  const output=path.join(workspace,'preview');
  const staged=stageStudentPreview(root,mini,output);
  assert.deepEqual(staged,required);
  const actual=fs.readdirSync(output,{recursive:true,withFileTypes:true})
    .filter(x=>x.isFile()).map(x=>path.relative(output,path.join(x.parentPath,x.name)).replaceAll('\\','/')).sort();
  assert.deepEqual(actual,required.slice().sort());
  assert.throws(()=>stageStudentPreview(root,mini,output));
}));

// Node's fs mock tests the exact lstat guard without asking Windows for
// Create symbolic links permission. Test both the final file and a parent dir.
test('S89b: symlink guard rejects a linked file or linked parent regardless of OS privileges',t=>fixture(({root})=>{
  const originalLstat=fs.lstatSync;
  for (const relative of ['src/js/parser.mjs','src/js']) {
    const forbidden=path.resolve(root,relative);
    const mocked=t.mock.method(fs,'lstatSync',(candidate,...args)=>{
      if (path.resolve(candidate)===forbidden) return {isSymbolicLink:()=>true};
      return originalLstat(candidate,...args);
    });
    try {
      assert.throws(()=>verifyStudentPreviewInputs(root,mini),
        /Symlink forbidden: src\/js\//,relative);
    } finally {
      mocked.mock.restore();
    }
  }
}));

// Real filesystem coverage is additional evidence. On locked-down Windows,
// creating a symlink itself needs privileges; do not mistake EPERM for a
// failure of our policy, but retain the portable mock guard above.
test('S89b: real symlink is rejected where filesystem permits creating it',t=>fixture(({root})=>{
  const link=path.join(root,'src/js/parser.mjs');
  fs.unlinkSync(link);
  try {
    fs.symlinkSync(path.join(root,'index.html'),link,'file');
  } catch (error) {
    if (['EPERM','EACCES','ENOTSUP','EOPNOTSUPP'].includes(error?.code)) {
      t.skip(`Creating real symlinks is not permitted in this environment (${error.code})`);
      return;
    }
    throw error;
  }
  assert.throws(()=>verifyStudentPreviewInputs(root,mini),/Symlink forbidden/);
}));

test('S89a: explicit student release remains blocked while legacy UI is active',()=>{
  assert.throws(()=>assertNotStudentRelease(manifest),/STUDENT RELEASE BLOCKED/);
});
