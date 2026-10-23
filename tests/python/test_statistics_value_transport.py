"""S100m2: real selected gateway/list handler, not a statistics implementation."""
import copy
import json
from pathlib import Path
import unittest
from src.python.adapters import statistics_value_adapter as codec
from src.python.evaluator.container_list import evaluate_list_request
from src.python.evaluator.selected_gateway_bridge import evaluate_selected_gateway, GatewayContractError

FIXTURES = json.loads((Path(__file__).parents[1] / 'fixtures/statistics-value-v2.json').read_text(encoding='utf-8'))


def payload(inputs, providers=None):
    envelope = {'protocol': 'newcas.semantic-evaluation.v1', 'revision': 'm2-r1', 'blockId': 'b',
                'taskScopeId': 'T', 'source': 'list(materialized)', 'providers': providers or []}
    selection = {'revision': 'm2-r1', 'blockId': 'b', 'taskScopeId': 'T', 'source': envelope['source'],
                 'providerIds': [{'name': p['name'], 'providerId': p['providerId']} for p in envelope['providers']],
                 'operationSpec': {'operationSpecVersion': 1, 'operationId': 'list', 'evaluatorId': 'probe.container.list',
                                   'signatures': [{'arguments': [{'name': 'item', 'role': 'value', 'variadic': True}]}]},
                 'evaluationRequest': {'evaluationRequestVersion': 1, 'evaluatorId': 'probe.container.list',
                                       'inputs': inputs, 'instruction': {}, 'options': {}}}
    return envelope, selection


def integer(n):
    return {'valueVersion': 1, 'kind': 'expression', 'data': {'expr': {'op': 'integer', 'value': str(n)}}}


class StatisticsValueTransportTests(unittest.TestCase):
    def run_list(self, inputs, providers=None):
        return evaluate_selected_gateway(*payload(inputs, providers), evaluate_list_request)

    def test_v1_output_and_returned_v1_inputs_remain_v1(self):
        out = self.run_list([integer(1), integer(2)])
        self.assertEqual(out['value'], {'valueVersion': 1, 'kind': 'list', 'data': {'items': [integer(1), integer(2)]}})
        self.assertEqual(self.run_list([out['value']])['value']['valueVersion'], 1)
        self.assertEqual(self.run_list([])['value']['valueVersion'], 1)

    def test_invalid_typed_inputs_never_reach_selected_handler(self):
        for location in ('input', 'provider'):
            raw = copy.deepcopy(FIXTURES[0]['value'])
            raw['data']['classes'][0]['count']['data']['expr']['value'] = '-1'
            env, selected = payload([raw] if location == 'input' else [],
                                    [{'name': 'A', 'providerId': 'a', 'value': raw}] if location == 'provider' else [])
            called = []
            out = evaluate_selected_gateway(env, selected, lambda *_: called.append(True))
            self.assertEqual(called, [])
            self.assertEqual(out['code'], 'invalid-value-encoding')
            self.assertEqual(out['diagnostic']['diagnosticVersion'], 1)
            self.assertEqual(out['diagnostic']['code'], out['code'])

    def test_unknown_version_is_structured_input_failure(self):
        raw = copy.deepcopy(FIXTURES[0]['value'])
        raw['valueVersion'] = 77
        out = self.run_list([raw])
        self.assertEqual(out['code'], 'unsupported-value-encoding')
        self.assertEqual(out['diagnostic']['parameters']['actual'], '77')

    def test_resource_input_is_checked_before_whole_payload_json_copy(self):
        raw = copy.deepcopy(FIXTURES[0]['value'])
        for _ in range(1500):
            raw = {'valueVersion': 2, 'kind': 'list', 'data': {'items': [raw]}}
        out = self.run_list([raw])
        self.assertEqual(out['code'], 'value-codec-resource-limit')
        self.assertEqual(out['diagnostic']['parameters']['resource'], 'depth')

    def test_options_are_not_recursively_interpreted_as_values(self):
        env, selected = payload([])
        selected['evaluationRequest']['options'] = {'opaque': {'valueVersion': 99, 'kind': 'future'}}
        def handler(request, _):
            self.assertEqual(request['options'], selected['evaluationRequest']['options'])
            return {'evaluationOutcomeVersion': 1, 'status': 'success', 'value': integer(5)}
        self.assertEqual(evaluate_selected_gateway(env, selected, handler)['value'], integer(5))

    def test_invalid_handler_output_is_not_reclassified_as_input_failure(self):
        env, selected = payload([])
        with self.assertRaises(GatewayContractError):
            evaluate_selected_gateway(env, selected, lambda *_: {
                'evaluationOutcomeVersion': 1, 'status': 'success', 'value': {'valueVersion': 99, 'kind': 'list', 'data': {'items': []}}})

    def test_immutable_python_value_is_encoded_explicitly_at_output(self):
        env, selected = payload([])
        immutable = codec.statistics_value(FIXTURES[0]['value']['data'])
        out = evaluate_selected_gateway(env, selected, lambda *_: {'evaluationOutcomeVersion': 1, 'status': 'success', 'value': immutable})
        self.assertIs(type(out['value']), dict)
        self.assertEqual(out['value'], FIXTURES[0]['value'])
        json.dumps(out)

    def test_plain_handler_exceptions_are_not_classified_by_message(self):
        env, selected = payload([])
        def handler(*_):
            raise ValueError('value-codec-resource-limit')
        with self.assertRaisesRegex(ValueError, '^value-codec-resource-limit$'):
            evaluate_selected_gateway(env, selected, handler)

    def test_statistics_reject_wrappers_and_lists_of_wrappers_without_unwrapping(self):
        from src.python.evaluator.list_statistics import evaluate_variance_request, evaluate_median_request
        for name, handler in [('variance', evaluate_variance_request), ('median', evaluate_median_request)]:
            for raw in [FIXTURES[0]['value'], FIXTURES[1]['value'], {'valueVersion': 2, 'kind': 'list', 'data': {'items': [FIXTURES[1]['value']]}}]:
                env, selected = payload([copy.deepcopy(raw)])
                selected['evaluationRequest']['evaluatorId'] = 'probe.statistics.' + name
                selected['operationSpec'].update(operationId=name, evaluatorId='probe.statistics.' + name,
                                                  signatures=[{'arguments': [{'name': 'data', 'role': 'value'}]}])
                out = evaluate_selected_gateway(env, selected, handler)
                self.assertEqual(out['code'], 'type-mismatch')
                self.assertEqual(out['diagnostic']['parameters']['actualKind'], raw['kind'])

    def test_v2_list_of_existing_exact_scalars_preserves_the_old_mathematical_domain(self):
        from src.python.evaluator.list_mean import evaluate_mean_request
        value = {'valueVersion': 2, 'kind': 'list', 'data': {'items': [integer(1), integer(3)]}}
        env, selected = payload([value])
        selected['evaluationRequest']['evaluatorId'] = 'probe.statistics.mean'
        selected['operationSpec'].update(operationId='mean', evaluatorId='probe.statistics.mean', signatures=[{'arguments': [{'name': 'data', 'role': 'value'}]}])
        self.assertEqual(evaluate_selected_gateway(env, selected, evaluate_mean_request)['value'], integer(2))

    def test_v2_cannot_hide_inside_a_v1_container(self):
        out = self.run_list([{'valueVersion': 1, 'kind': 'list', 'data': {'items': [FIXTURES[0]['value']]}}])
        self.assertEqual(out['code'], 'invalid-value-encoding')

    def test_combined_list_output_remains_subject_to_the_same_v2_budget(self):
        child = copy.deepcopy(FIXTURES[1]['value'])
        child['data']['value'] = {'valueVersion': 1, 'kind': 'expression', 'data': {'expr': {'op': 'constant', 'name': 'x' * (4 * 1024 * 1024)}}}
        out = self.run_list([child, child])
        self.assertEqual(out['code'], 'value-codec-resource-limit')
        self.assertEqual(out['diagnostic']['parameters']['resource'], 'encoded-bytes')


def fixture_test(f):
    def test(self):
        raw = copy.deepcopy(f['value'])
        before = json.dumps(raw)
        first = self.run_list([raw])
        self.assertEqual(first['status'], 'success')
        self.assertEqual(first['value']['valueVersion'], 2)
        returned = first['value']['data']['items'][0]
        self.assertEqual(codec.encode_value(codec.decode_value(json.dumps(returned))), f['canonical'])
        second = self.run_list([first['value']])
        self.assertEqual(second['value']['data']['items'][0], first['value'])
        self.assertEqual(json.dumps(raw), before)
    return test


for _f in FIXTURES:
    setattr(StatisticsValueTransportTests, 'test_roundtrip_' + _f['name'].replace('-', '_'), fixture_test(_f))
