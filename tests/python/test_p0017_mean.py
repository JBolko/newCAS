"""S100b integer regressions; S100e extends mean to exact rational elements."""
import copy
import unittest
from src.python.evaluator.list_mean import evaluate_mean_request
from src.python.evaluator.selected_gateway_bridge import evaluate_selected_gateway


def integer(n):
    return {'valueVersion': 1, 'kind': 'expression', 'data': {'expr': {'op': 'integer', 'value': str(n)}}}


def container(items, kind='list'):
    return {'valueVersion': 1, 'kind': kind, 'data': {'items': items}}


def spec():
    return {'operationSpecVersion': 1, 'operationId': 'mean', 'evaluatorId': 'probe.statistics.mean',
            'purity': 'pure', 'diagnosticAdapterId': None,
            'signatures': [{'arguments': [{'name': 'data', 'role': 'value'}]}]}


def request(inputs):
    return {'evaluationRequestVersion': 1, 'evaluatorId': 'probe.statistics.mean',
            'instruction': {}, 'options': {}, 'inputs': inputs}


def mismatch(expected, actual):
    return {'diagnosticVersion': 1, 'code': 'type-mismatch', 'parameters': {
        'operationId': 'mean', 'argument': 'data', 'expectedKinds': [expected], 'actualKind': actual}}


class MeanTests(unittest.TestCase):
    def test_exact_results_and_immutable_input(self):
        cases = [(['2', '4', '6', '8'], integer(5)),
                 (['1', '2', '4'], {'valueVersion': 1, 'kind': 'expression', 'data': {
                     'expr': {'op': 'rational', 'numerator': '7', 'denominator': '3'}}}),
                 (['-2', '4', '4'], integer(2)), (['9007199254740993'], integer('9007199254740993')),
                 (['9007199254740993', '9007199254740995'], integer('9007199254740994')),
                 (['-2', '1'], {'valueVersion': 1, 'kind': 'expression', 'data': {
                     'expr': {'op': 'rational', 'numerator': '-1', 'denominator': '2'}}}),
                 (['-4', '4'], integer(0))]
        for numbers, expected in cases:
            with self.subTest(numbers=numbers):
                req = request([container([integer(n) for n in numbers])])
                before = copy.deepcopy(req)
                out = evaluate_mean_request(req, spec())
                self.assertEqual(out, {'evaluationOutcomeVersion': 1, 'status': 'success', 'value': expected})
                self.assertEqual(req, before)

    def test_vector_rejected_without_conversion(self):
        out = evaluate_mean_request(request([container([integer(2)], 'vector')]), spec())
        self.assertEqual(out['diagnostic'], mismatch('list', 'vector'))

    def test_empty_list_rejected(self):
        out = evaluate_mean_request(request([container([])]), spec())
        self.assertEqual(out['diagnostic'], mismatch('nonempty-list-of-exact-rational-expressions', 'list'))

    def test_unsupported_elements_rejected(self):
        bad = [
            container([]),
            {'valueVersion': 1, 'kind': 'expression', 'data': {'expr': {'op': 'approx', 'value': '2.0'}}},
            {'valueVersion': 1, 'kind': 'expression', 'data': {'expr': {'op': 'constant', 'name': 'pi'}}},
        ]
        for item in bad:
            with self.subTest(item=item):
                out = evaluate_mean_request(request([container([integer(2), item])]), spec())
                self.assertEqual(out['diagnostic'], mismatch('nonempty-list-of-exact-rational-expressions', 'list'))

    def test_wrong_arity(self):
        for inputs in [[], [container([integer(1)])] * 2]:
            out = evaluate_mean_request(request(inputs), spec())
            self.assertEqual(out['diagnostic'], {'diagnosticVersion': 1, 'code': 'wrong-arity',
                'parameters': {'operationId': 'mean', 'expected': [1], 'actual': len(inputs)}})

    def test_wrong_capability(self):
        selected = spec(); selected['evaluatorId'] = 'probe.scalar.exp'
        req = request([container([integer(2)])]); req['evaluatorId'] = selected['evaluatorId']
        out = evaluate_mean_request(req, selected)
        self.assertEqual(out['diagnostic'], {'diagnosticVersion': 1, 'code': 'unsupported-operation',
                                             'parameters': {'operationId': 'mean'}})

    def test_invalid_selection_is_integration_error(self):
        for patch in [{'role': 'symbolic'}, {'variadic': True}, {'scopeOver': ['data']}]:
            selected = spec(); selected['signatures'][0]['arguments'][0].update(patch)
            with self.subTest(patch=patch), self.assertRaises(ValueError):
                evaluate_mean_request(request([container([integer(2)])]), selected)
        for field in ['instruction', 'options']:
            req = request([container([integer(2)])]); req[field] = {'unselected': True}
            with self.subTest(field=field), self.assertRaises(ValueError):
                evaluate_mean_request(req, spec())

    def test_malformed_integer_never_coerced_to_a_number(self):
        for raw in [9007199254740993, True, '1.5', '1e3', '01']:
            item = integer(0); item['data']['expr']['value'] = raw
            with self.subTest(raw=raw), self.assertRaises(ValueError):
                evaluate_mean_request(request([container([item])]), spec())

    def test_gateway_preserves_structured_failure_parameters(self):
        env = {'protocol': 'newcas.semantic-evaluation.v1', 'revision': 'r1', 'blockId': 'b',
               'taskScopeId': 'internal', 'source': 'internal Value fixture', 'providers': []}
        selected = {k: env[k] for k in ['revision', 'blockId', 'taskScopeId', 'source']}
        selected.update(providerIds=[], evaluationRequest=request([container([])]), operationSpec=spec())
        out = evaluate_selected_gateway(env, selected, evaluate_mean_request)
        self.assertEqual(out['code'], 'type-mismatch')
        self.assertEqual(out['diagnostic'], mismatch('nonempty-list-of-exact-rational-expressions', 'list'))
