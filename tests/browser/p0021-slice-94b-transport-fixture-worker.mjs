/** S94b browser-only transport failure fixture. Never imports a math evaluator. */
const PROTOCOL = 'newcas.selected-worker.v1';
self.addEventListener('message', event => {
  const msg = event.data;
  if (!msg || msg.protocol !== PROTOCOL || msg.kind !== 'evaluate') return;
  // Only this fixture interprets the *test-source* strings, not production Worker.
  if (msg.envelope?.source === 'hang') return; // intentionally no reply
  if (msg.envelope?.source === 'crash') throw new Error('S94b deliberate Worker crash');
  if (msg.envelope?.source === 'failure') {
    self.postMessage({
      protocol:PROTOCOL,kind:'result',requestId:msg.requestId,
      revision:msg.revision,blockId:msg.blockId,
      outcome:{blockId:msg.blockId,status:'failure',code:'EXPECTED_TEST_FAILURE'},
    });
  }
});
