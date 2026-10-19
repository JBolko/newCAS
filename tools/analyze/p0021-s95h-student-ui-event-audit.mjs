/** P0021 S95h — bounded read-only event/authority audit for the legacy student UI.
 * This is a textual/static inventory, NOT a JavaScript parser or a runtime proof.
 * No UI initialization, document mutation or evaluator creation is performed.
 */
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {traceStaticGraph} from './p0021-s95a-legacy-route-audit.mjs';

function has(source, pattern) {
  return pattern.test(source);
}

/** A false claim of readiness is worse than declining to migrate. */
export function inspectStudentUiSources({main, action, renderer, frozen}) {
  for (const part of [main, action, renderer, frozen]) {
    if (typeof part !== 'string' || !part) throw new TypeError('S95H_SOURCE_REQUIRED');
  }
  const findings = Object.freeze({
    legacyConstruction: has(main,/new\s+CASEngine\s*\(/) && has(main,/new\s+Transformer\s*\(/),
    directLegacyEvaluation: has(main,/\bengine\.calculate\s*\(\s*ast\s*,\s*taskId\s*\)/),
    delegatedEnter: has(main,/addEventListener\s*\(\s*['"]keydown['"]/) && has(main,/e\.key\s*!==\s*['"]Enter['"]/) && has(main,/evaluateCell\s*\(\s*e\.target\.closest\s*\(\s*['"]\.cell['"]\s*\)\s*\)/),
    domDerivedTaskIdentity: has(main,/\.closest\s*\(\s*['"]\.assignment['"]\s*\)/) && has(main,/assignment\?\.id\s*\?\?\s*['"]default['"]/),
    countDerivedCellIdentity: has(main,/querySelectorAll\s*\(\s*['"]\.cell['"]\s*\)\.length\s*\+\s*1/),
    domBufferIsReadOnEnter: has(main,/inputField\.value\.trim\s*\(\s*\)/),
    noSemanticUiActionInMain: !has(main,/\bcreateSemanticCalculateAction\b/),
    legacyErrorHtmlInterpolation: has(main,/banner\.innerHTML\s*=/) && main.includes('${err.message}'),
    existingSemanticAction: has(action,/export\s+function\s+createSemanticCalculateAction\s*\(/) && action.includes('runtime.setBlockSource(') && action.includes('advanceRevision()'),
    existingSemanticRenderer: has(renderer,/export\s+function\s+renderSemanticCalculation\s*\(/),
    frozenSeparatesEditorBuffer: frozen.includes('Keystrokes in an active editor modify an EditingSession-owned buffer.'),
    frozenRequiresPersistentIds: frozen.includes('persistent block IDs;') && frozen.includes('persistent task/scope IDs;'),
  });
  const blockers=[];
  if(findings.directLegacyEvaluation || findings.legacyConstruction || findings.noSemanticUiActionInMain)
    blockers.push('Student Enter still dispatches legacy CASEngine; semantic action is not wired.');
  if(findings.countDerivedCellIdentity)
    blockers.push('DOM cell count is not a persistent, collision-safe block identity.');
  if(findings.domDerivedTaskIdentity)
    blockers.push('HTML assignment id/default is not established as authoritative task/scope identity.');
  if(findings.domBufferIsReadOnEnter && findings.noSemanticUiActionInMain)
    blockers.push('No evidenced EditingSession-owned draft → authoritative source commit on student Enter.');
  if(findings.delegatedEnter && findings.directLegacyEvaluation)
    blockers.push('Per-cell Enter calculation has not been reconciled with task-level dependency/revision dispatch.');
  if(!findings.existingSemanticAction || !findings.existingSemanticRenderer)
    blockers.push('Selected new-pipeline UI contracts are absent or changed.');
  if(!findings.frozenSeparatesEditorBuffer || !findings.frozenRequiresPersistentIds)
    blockers.push('Expected frozen authority/identity text not found: re-audit contracts before migration.');
  if(findings.legacyErrorHtmlInterpolation)
    blockers.push('Legacy crash display interpolates error.message into innerHTML; separate presentation security hardening needed.');
  return Object.freeze({findings,blockers:Object.freeze(blockers),
    directStudentUiCutoverReady:blockers.length===0});
}

export function buildStudentUiEventAudit(root) {
  const base=path.resolve(root);
  const read=file=>fs.readFileSync(path.join(base,file),'utf8');
  const baseAudit=inspectStudentUiSources({
    main:read('src/js/main.js'),
    action:read('src/js/ui/create-semantic-calculate-action.js'),
    renderer:read('src/js/renderer.js'),
    frozen:read('docs/architecture/v1.0/ARCHITECTURE_SPECIFICATION_FROZEN_v1.0.md'),
  });
  const graph=traceStaticGraph(base,'src/js/main.js');
  const index=path.join(base,'index.html');
  const htmlEntry=fs.existsSync(index) ?
    (/<script\b[^>]+src\s*=\s*['"][^'"]*src\/js\/main\.js['"]/i.test(read('index.html')) ? 'main.js script seen in index.html' : 'index.html present; main.js entry needs manual inspection') :
    'index.html not in reconstructed audit tree; verify HTML entry manually';
  const blockers=[...baseAudit.blockers];
  if(graph.unresolved.length) blockers.push('Unresolved static imports in student main.js graph.');
  return Object.freeze({
    schema:'newCAS/p0021-s95h-student-event-boundary/v1',
    method:'bounded textual probes + S95a static import graph; not DOM/browser observation',
    source:'src/js/main.js',htmlEntry,
    ...baseAudit,
    directStudentUiCutoverReady:blockers.length===0,
    blockers:Object.freeze(blockers),
    legacyReachable:graph.modules.filter(p=>/^(src\/js\/(?:cas-engine|transformer|python-files)|src\/js\/legacy\/)/.test(p)),
    unresolvedStaticImports:graph.unresolved,
    nextContract:'S95i must first establish stable model-owned block/task identity, editor commit semantics, and revision-safe per-cell Enter behavior. NO active student cutover before those are proven.',
  });
}
export function formatStudentUiEventAudit(a) {
  return [
    '# P0021 S95h — student UI event/authority boundary audit','',
    `Method: ${a.method}`,'',`HTML entry evidence: ${a.htmlEntry}`,'',
    `Direct legacy → semantic cutover ready: **${a.directStudentUiCutoverReady ? 'YES' : 'NO'}**`,'',
    '| Static source observation | Present |','|---|---|',
    ...Object.entries(a.findings).map(([k,v])=>`| ${k} | ${v?'yes':'no'} |`),'',
    '## Blocking gaps (not a proof of runtime breakage)','',
    ...a.blockers.map(s=>`- ${s}`),'',
    '## Currently statically reachable legacy JS','',
    ...(a.legacyReachable.length?a.legacyReachable.map(p=>`- \`${p}\``):['- None in bounded graph']),'',
    '## Next contract','',a.nextContract,'',
    '## Limits','',
    '- Textual probes are intentionally narrow; renamed handlers or different syntax require re-audit.',
    '- Audit does not inspect an actually rendered DOM or execute handlers.',
    '- This is NOT permission to change the frozen architecture, ship a student release, or retire legacy.',
    '- Browser pilot (S95f/g) is independently green but is not the live student UI.','',
  ].join('\n');
}
const invoked=process.argv[1] && path.resolve(process.argv[1])===fileURLToPath(import.meta.url);
if(invoked){
  const args=process.argv.slice(2);
  const useJson=args.includes('--json');
  if(args.some(a=>a!=='--json')){
    console.error('Usage: node tools/analyze/p0021-s95h-student-ui-event-audit.mjs [--json]');process.exitCode=2;
  }else{
    try{
      const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
      const audit=buildStudentUiEventAudit(root);
      console.log(useJson?JSON.stringify(audit,null,2):formatStudentUiEventAudit(audit));
      if(audit.unresolvedStaticImports.length)process.exitCode=1;
    }catch(e){console.error(`S95h audit failed: ${e.message}`);process.exitCode=1;}
  }
}
