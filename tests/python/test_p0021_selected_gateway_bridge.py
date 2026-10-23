import copy
import unittest
from src.python.evaluator.selected_gateway_bridge import evaluate_selected_gateway, GatewayContractError


def integer(n):
    return {'valueVersion': 1, 'kind': 'expression', 'data': {'expr': {'op': 'integer', 'value': str(n)}}}


def envelope():
    return {'protocol': 'newcas.semantic-evaluation.v1', 'revision': 'r1', 'blockId': 'b',
            'taskScopeId': 'T', 'source': 'b := a+2', 'providers': [
                {'name': 'a', 'providerId': 'writer-A', 'value': integer(3)}]}


def selection():
    return {'revision': 'r1', 'blockId': 'b', 'taskScopeId': 'T', 'source': 'b := a+2',
            'providerIds': [{'name': 'a', 'providerId': 'writer-A'}],
            'evaluationRequest': {'evaluationRequestVersion': 1, 'evaluatorId': 'probe.scalar.add', 'inputs': [], 'instruction': {}, 'options': {}},
            'operationSpec': {'operationSpecVersion': 1, 'evaluatorId': 'probe.scalar.add', 'operationId': 'add', 'signatures': []}}


def ok_handler(request, spec):
    return {'evaluationOutcomeVersion': 1, 'status': 'success', 'value': integer(5)}


class SelectedGatewayTests(unittest.TestCase):
    def test_success_maps_outcome(self):
        self.assertEqual(evaluate_selected_gateway(envelope(), selection(), ok_handler),
                         {'blockId': 'b', 'status': 'success', 'value': integer(5)})

    def test_failure_maps_diagnostic(self):
        def fail(*_):
            return {'evaluationOutcomeVersion': 1, 'status': 'failure', 'diagnostic': {'code': 'wrong-arity', 'diagnosticVersion': 1, 'parameters': {}}}
        self.assertEqual(evaluate_selected_gateway(envelope(), selection(), fail)['code'], 'wrong-arity')

    def test_revision_mismatch_rejected_without_execution(self):
        s = selection(); s['revision'] = 'r0'
        self.assertRaises(GatewayContractError, evaluate_selected_gateway, envelope(), s, ok_handler)

    def test_block_mismatch_rejected(self):
        s = selection(); s['blockId'] = 'other'
        self.assertRaises(GatewayContractError, evaluate_selected_gateway, envelope(), s, ok_handler)

    def test_source_mismatch_rejected(self):
        s = selection(); s['source'] = 'b := 7'
        self.assertRaises(GatewayContractError, evaluate_selected_gateway, envelope(), s, ok_handler)

    def test_provider_identity_mismatch_rejected(self):
        s = selection(); s['providerIds'][0]['providerId'] = 'writer-B'
        self.assertRaises(GatewayContractError, evaluate_selected_gateway, envelope(), s, ok_handler)

    def test_provider_name_mismatch_rejected(self):
        s = selection(); s['providerIds'][0]['name'] = 'x'
        self.assertRaises(GatewayContractError, evaluate_selected_gateway, envelope(), s, ok_handler)

    def test_requires_explicit_selection(self):
        self.assertRaises(GatewayContractError, evaluate_selected_gateway, envelope(), None, ok_handler)

    def test_requires_selected_handler(self):
        self.assertRaises(GatewayContractError, evaluate_selected_gateway, envelope(), selection(), None)

    def test_selected_evaluator_mismatch_rejected(self):
        s = selection(); s['evaluationRequest']['evaluatorId'] = 'unrelated'
        self.assertRaises(GatewayContractError, evaluate_selected_gateway, envelope(), s, ok_handler)

    def test_nonportable_provider_rejected(self):
        e = envelope(); e['providers'][0]['value'] = object()
        called = []
        out = evaluate_selected_gateway(e, selection(), lambda *_: called.append(True))
        self.assertEqual(called, [])
        self.assertEqual(out['status'], 'failure')
        self.assertEqual(out['code'], 'invalid-value-encoding')

    def test_rejects_invalid_handler_outcome(self):
        self.assertRaises(GatewayContractError, evaluate_selected_gateway, envelope(), selection(), lambda *_: {'status':'success'})

    def test_actual_p0012_selected_addition_handler(self):
        # Uses the existing P0012 selected handler and P0011 SymPy adapter.
        from src.python.evaluator.scalar_operations import evaluate_scalar_request
        def integer(n):
            return {'valueVersion': 1, 'kind': 'expression', 'data': {'expr': {'op': 'integer', 'value': str(n)}}}
        s = selection()
        s['evaluationRequest']['inputs'] = [integer(2), integer(3)]
        s['operationSpec']['operationId'] = 'probe-add'
        s['operationSpec']['signatures'] = [{'arguments': [{'name':'lhs','role':'value'}, {'name':'rhs','role':'value'}]}]
        out = evaluate_selected_gateway(envelope(), s, evaluate_scalar_request)
        self.assertEqual(out, {'blockId':'b', 'status':'success', 'value':integer(5)})

    def test_preselected_handler_receives_unmodified_values(self):
        observed = {}
        def handler(request, spec):
            observed['request'] = request
            return ok_handler(request, spec)
        s = selection(); s['evaluationRequest']['inputs'] = [envelope()['providers'][0]['value']]
        evaluate_selected_gateway(envelope(), s, handler)
        self.assertEqual(observed['request']['inputs'], s['evaluationRequest']['inputs'])

if __name__ == '__main__':
    unittest.main()
