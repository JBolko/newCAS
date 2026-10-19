import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {inspectStudentUiSources,buildStudentUiEventAudit,formatStudentUiEventAudit} from '../../tools/analyze/p0021-s95h-student-ui-event-audit.mjs';
const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const read=p=>fs.readFileSync(path.join(ROOT,p),'utf8');
const input={main:read('src/js/main.js'),action:read('src/js/ui/create-semantic-calculate-action.js'),
  renderer:read('src/js/renderer.js'), frozen:read('docs/architecture/v1.0/ARCHITECTURE_SPECIFICATION_FROZEN_v1.0.md')};
const baseline=buildStudentUiEventAudit(ROOT);

test('S95h captures actual main.js legacy CASEngine path, NOT an alleged completed cutover',()=>{
  assert.equal(baseline.findings.legacyConstruction,true);
  assert.equal(baseline.findings.directLegacyEvaluation,true);
  assert.equal(baseline.findings.noSemanticUiActionInMain,true);
  assert.equal(baseline.directStudentUiCutoverReady,false);
});
test('S95h observes delegated Enter and one-cell calculation, not task-wide action',()=>{
  assert.equal(baseline.findings.delegatedEnter,true);
  assert.equal(baseline.findings.domBufferIsReadOnEnter,true);
  assert.ok(baseline.blockers.some(x=>x.includes('Per-cell Enter')));
});
test('S95h detects count-derived DOM IDs as unresolved stable identity risk',()=>{
  assert.equal(baseline.findings.countDerivedCellIdentity,true);
  assert.ok(baseline.blockers.some(x=>x.includes('persistent, collision-safe block identity')));
});
test('S95h detects DOM assignment id/default instead of persistent task authority',()=>{
  assert.equal(baseline.findings.domDerivedTaskIdentity,true);
  assert.ok(baseline.blockers.some(x=>x.includes('task/scope identity')));
});
test('S95h reads frozen EditingSession and persistent identity requirements without modifying them',()=>{
  assert.equal(baseline.findings.frozenSeparatesEditorBuffer,true);
  assert.equal(baseline.findings.frozenRequiresPersistentIds,true);
});
test('S95h confirms selected semantic UI action and shared renderer exist separately',()=>{
  assert.equal(baseline.findings.existingSemanticAction,true);
  assert.equal(baseline.findings.existingSemanticRenderer,true);
});
test('S95h does not mistake renderer migration for math engine cutover',()=>{
  assert.equal(baseline.findings.existingSemanticRenderer,true);
  assert.equal(baseline.findings.directLegacyEvaluation,true);
  assert.equal(baseline.directStudentUiCutoverReady,false);
});
test('S95h inventories legacy crash innerHTML as presentation hardening, not new evaluator',()=>{
  assert.equal(baseline.findings.legacyErrorHtmlInterpolation,true);
  assert.ok(baseline.blockers.some(x=>x.includes('error.message')));
});
test('S95h warns on absent source evidence rather than guessing a completed migration',()=>{
  assert.throws(()=>inspectStudentUiSources({...input,main:null}),/S95H_SOURCE_REQUIRED/);
  const changed=inspectStudentUiSources({...input,action:'/** no action */'});
  assert.equal(changed.directStudentUiCutoverReady,false);
  assert.ok(changed.blockers.some(x=>x.includes('contracts are absent')));
});
test('S95h audit is read-only and cites bounded import reachability',()=>{
  assert.deepEqual(baseline.unresolvedStaticImports,[]);
  assert.ok(baseline.legacyReachable.includes('src/js/cas-engine.js'));
  assert.ok(baseline.legacyReachable.includes('src/js/transformer.js'));
  assert.match(baseline.method,/bounded textual probes/);
});
test('S95h markdown clearly blocks active cutover, permits future contract-first 95i',()=>{
  const output=formatStudentUiEventAudit(baseline);
  assert.match(output,/cutover ready: \*\*NO\*\*/);
  assert.match(output,/S95i must first establish stable model-owned block\/task identity/);
  assert.match(output,/NOT permission to change/);
});
test('S95h cannot treat a renamed Enter handler as proof it is safely migrated',()=>{
  const changed=inspectStudentUiSources({...input,main:input.main.replaceAll('evaluateCell','evaluateAnotherCell')});
  assert.equal(changed.findings.delegatedEnter,false);
  assert.equal(changed.directStudentUiCutoverReady,false);
});
