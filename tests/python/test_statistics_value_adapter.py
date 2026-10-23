"""S100m1 structural codec: no SymPy/grouped calculation or Worker claims."""
import copy
import importlib
import json
from pathlib import Path
import unittest


FIXTURES = json.loads((Path(__file__).parents[1] / 'fixtures/statistics-value-v2.json').read_text(encoding='utf-8'))


def fixture(name):
    return copy.deepcopy(next(f['value'] for f in FIXTURES if f['name'] == name))


class StatisticsValueCodecTests(unittest.TestCase):
    def setUp(self):
        # Fail once per test when the implementation is absent, rather than
        # recording the same missing module once per rejection subcase.
        self.codec()

    def codec(self):
        try:
            return importlib.import_module('src.python.adapters.statistics_value_adapter')
        except ModuleNotFoundError:
            self.fail('S100m1 Python structural codec not implemented')

    def make(self, value):
        codec = self.codec()
        return codec.list_v2(value['data']['items']) if value['kind'] == 'list' else codec.statistics_value(value['data'])

    def rejected(self, value, expected='invalid-value-encoding'):
        with self.assertRaises(ValueError) as caught:
            self.make(value)
        diagnostic = caught.exception.diagnostic
        self.assertEqual(diagnostic['diagnosticVersion'], 1)
        self.assertEqual(diagnostic['code'], expected)
        self.assertIsInstance(diagnostic['parameters']['path'], str)

    def test_metadata_and_basis_affect_representation_equality(self):
        codec = self.codec()
        a = self.make(fixture('symbolic-result'))
        self.assertTrue(codec.same_value(a, codec.decode_value(codec.encode_value(a))))
        for field, value in [('methodId', 'other/v1'), ('estimateStatus', 'known'), ('arithmetic', 'approximate')]:
            changed = fixture('symbolic-result')
            changed['data'][field] = value
            self.assertFalse(codec.same_value(a, self.make(changed)))
        changed = fixture('symbolic-result')
        changed['data']['provenance']['inputs'][0]['value']['data']['classes'][0]['upperClosed'] = False
        self.assertFalse(codec.same_value(a, self.make(changed)))

    def test_detachment_and_deep_returned_immutability(self):
        codec = self.codec()
        raw = fixture('derived-result')
        value = self.make(raw)
        before = codec.encode_value(value)
        raw['data']['provenance']['inputs'][0]['value']['data']['methodId'] = 'changed/v1'
        self.assertEqual(codec.encode_value(value), before)
        with self.assertRaises(TypeError):
            value['data']['provenance']['inputs'][0]['value']['data']['methodId'] = 'changed/v1'
        with self.assertRaises((TypeError, AttributeError)):
            value['data']['assumptions'].append('extra/v1')

    def test_shape_valid_invalid_mathematics_is_not_certified(self):
        codec = self.codec()
        raw = fixture('grouped')
        raw['data']['classes'] = [raw['data']['classes'][0]]
        raw['data']['classes'][0]['upper'] = copy.deepcopy(raw['data']['classes'][0]['lower'])
        raw['data']['classes'][0]['count']['data']['expr']['value'] = '0'
        value = self.make(raw)
        self.assertTrue(codec.is_value(value))
        self.assertNotIn('validated', value['data'])

    def test_canonical_order_is_structural(self):
        raw = fixture('symbolic-result')
        raw['data']['assumptions'] = ['z-model/v2', 'a-model/v1']
        raw['data'] = dict(reversed(list(raw['data'].items())))
        value = self.make(raw)
        self.assertEqual(list(value['data']['assumptions']), ['a-model/v1', 'z-model/v2'])
        self.assertEqual(list(value['data']), ['variant', 'statisticId', 'methodId', 'estimand', 'arithmetic', 'estimateStatus', 'assumptions', 'provenance', 'value'])

    def test_strict_record_role_method_and_payload_rejection(self):
        changes = [
            lambda x: x['data'].pop('estimand'),
            lambda x: x['data'].update(schemaVersion=1),
            lambda x: x['data'].update(methodId='median'),
            lambda x: x['data'].update(statisticId='Median'),
            lambda x: x['data'].update(estimateStatus='model-estimate'),
            lambda x: x['data']['assumptions'].append(x['data']['assumptions'][0]),
            lambda x: x['data']['provenance']['inputs'].append(copy.deepcopy(x['data']['provenance']['inputs'][0])),
            lambda x: x['data']['provenance']['inputs'][0].update(role='Data role'),
            lambda x: x['data']['provenance'].update(inputs=[]),
            lambda x: x['data'].update(value=fixture('grouped')),
            lambda x: x['data']['value']['data'].update(expr={'op': 'unknown'}),
            lambda x: x['data'].update(value={'valueVersion': 1, 'kind': 'list', 'data': {'items': [fixture('grouped')]}}),
        ]
        for change in changes:
            with self.subTest(change=changes.index(change)):
                raw = fixture('symbolic-result')
                change(raw)
                self.rejected(raw)

    def test_counts_flags_and_exact_boundary_structure(self):
        for change in [
            lambda c: c['count']['data']['expr'].update(value='-1'),
            lambda c: c['count']['data']['expr'].update(value='01'),
            lambda c: c.update(lowerClosed='false'),
            lambda c: c['lower']['data'].update(expr={'op': 'approx', 'value': '0.1'}),
        ]:
            raw = fixture('grouped')
            change(raw['data']['classes'][0])
            self.rejected(raw)

    def test_unknown_encoding_rejects_but_method_stays_opaque(self):
        codec = self.codec()
        for change in [lambda x: x.update(valueVersion=3), lambda x: x.update(kind='future'), lambda x: x['data'].update(variant='future')]:
            raw = fixture('grouped')
            change(raw)
            with self.assertRaises(ValueError) as caught:
                codec.decode_value(json.dumps(raw))
            self.assertEqual(caught.exception.diagnostic['code'], 'unsupported-value-encoding')
        value = self.make(fixture('symbolic-result'))
        self.assertEqual(value['data']['methodId'], 'future-moments/v999999999999999999999999')

    def test_cycles_exotic_objects_and_nan_reject(self):
        raw = fixture('symbolic-result')
        raw['data']['provenance']['inputs'][0]['value'] = raw
        self.rejected(raw)
        for bad in [object(), float('nan'), float('inf')]:
            raw = fixture('symbolic-result')
            raw['data']['value'] = bad
            self.rejected(raw)

    def test_unicode_and_v1_insertion_order_are_preserved(self):
        codec = self.codec()
        raw = fixture('symbolic-result')
        raw['data']['value'] = {'kind': 'expression', 'data': {'expr': {'name': 'π', 'op': 'constant'}}, 'valueVersion': 1}
        encoded = codec.encode_value(self.make(raw))
        self.assertTrue(encoded.endswith('"value":{"kind":"expression","data":{"expr":{"name":"π","op":"constant"}},"valueVersion":1}}}'))

    def resource_failure(self, action, resource):
        limits = {'depth': 128, 'nodes': 100000, 'encoded-bytes': 8 * 1024 * 1024}
        with self.assertRaises(ValueError) as caught:
            action()
        diagnostic = caught.exception.diagnostic
        self.assertEqual(diagnostic['code'], 'value-codec-resource-limit')
        self.assertEqual(diagnostic['parameters']['resource'], resource)
        self.assertEqual(diagnostic['parameters']['limit'], limits[resource])

    def test_resource_deep_objects_and_serialized_ingress(self):
        codec = self.codec()
        deep = fixture('grouped')
        for _ in range(1000):
            deep = {'valueVersion': 2, 'kind': 'list', 'data': {'items': [deep]}}
        self.resource_failure(lambda: self.make(deep), 'depth')
        prefix = '{"valueVersion":2,"kind":"list","data":{"items":['
        self.resource_failure(lambda: codec.decode_value(prefix * 1000 + '0' + ']}}' * 1000), 'depth')

    def test_resource_exact_depth_boundary(self):
        raw = fixture('symbolic-result')
        expr = {'op': 'integer', 'value': '1'}
        for _ in range(123):
            expr = {'op': 'pow', 'base': expr, 'exponent': {'op': 'integer', 'value': '1'}}
        raw['data']['value'] = {'valueVersion': 1, 'kind': 'expression', 'data': {'expr': expr}}
        self.assertTrue(self.codec().is_value(self.make(raw)))
        raw['data']['value']['data']['expr'] = {'op': 'pow', 'base': expr, 'exponent': {'op': 'integer', 'value': '1'}}
        self.resource_failure(lambda: self.make(raw), 'depth')

    def test_resource_wide_arrays_and_expanded_shared_provenance(self):
        self.resource_failure(lambda: self.codec().list_v2([None] * 100001), 'nodes')
        shared = fixture('grouped')
        for _ in range(16):
            shared = {'valueVersion': 2, 'kind': 'list', 'data': {'items': [shared, shared]}}
        self.resource_failure(lambda: self.make(shared), 'nodes')

    def test_resource_exact_node_boundary(self):
        one = {'valueVersion': 1, 'kind': 'expression', 'data': {'expr': {'op': 'integer', 'value': '1'}}}
        items = [one] * 14285  # 5 + 14285*7 = 100000 nodes.
        codec = self.codec()
        value = codec.list_v2(items)
        self.assertTrue(codec.is_value(codec.decode_value(codec.encode_value(value))))
        self.resource_failure(lambda: codec.list_v2(items + [one]), 'nodes')

    def test_large_count_and_version_key_normalization(self):
        codec = self.codec()
        raw = fixture('grouped')
        raw['data']['classes'][0]['count']['data']['expr']['value'] = '9' * 10000
        self.assertEqual(len(self.make(raw)['data']['classes'][0]['count']['data']['expr']['value']), 10000)
        text = next(f['canonical'] for f in FIXTURES if f['name'] == 'grouped')
        self.assertEqual(codec.encode_value(codec.decode_value(text.replace('"valueVersion":2', '"valueVersion":1,"valueVersion":2', 1))), text)
        self.assertEqual(codec.encode_value(codec.decode_value(text.replace('valueVersion', 'value\\u0056ersion', 1))), text)
        for bad in ['{"valueVersion":2,', '{"valueVersion":2,"kind":"list","data":{"items":[NaN]}}']:
            with self.assertRaises(ValueError) as caught:
                codec.decode_value(bad)
            self.assertEqual(caught.exception.diagnostic['code'], 'invalid-value-encoding')

    def test_resource_canonical_bytes_exact_boundary(self):
        codec = self.codec()
        raw = fixture('symbolic-result')
        raw['data']['value'] = {'valueVersion': 1, 'kind': 'expression', 'data': {'expr': {'op': 'constant', 'name': 'x'}}}
        base = len(json.dumps(raw, ensure_ascii=False, separators=(',', ':')).encode('utf-8'))
        raw['data']['value']['data']['expr']['name'] = 'x' * (8 * 1024 * 1024 - base + 1)
        self.assertEqual(len(codec.encode_value(self.make(raw)).encode('utf-8')), 8 * 1024 * 1024)
        raw['data']['value']['data']['expr']['name'] += 'x'
        self.resource_failure(lambda: self.make(raw), 'encoded-bytes')
        for text in ['π' * (4 * 1024 * 1024), '\x00' * (2 * 1024 * 1024)]:
            raw['data']['value']['data']['expr']['name'] = text
            self.resource_failure(lambda: self.make(raw), 'encoded-bytes')

    def test_resource_ingress_preflights_before_json_tree_allocation(self):
        codec = self.codec()
        self.assertTrue(codec.is_value(codec.decode_value(' ' * 10000 + json.dumps(fixture('grouped')))))
        text = '{"valueVersion":2,"kind":"list","data":{"items":[' + 'null,' * 100001 + 'null]}}'
        self.resource_failure(lambda: codec.decode_value(text), 'nodes')
        raw = fixture('symbolic-result')
        raw['data']['value']['data']['expr'] = {'op': 'constant', 'name': 'x' * (8 * 1024 * 1024)}
        self.resource_failure(lambda: codec.decode_value(json.dumps(raw)), 'encoded-bytes')


def fixture_test(f):
    def test(self):
        codec = self.codec()
        value = codec.decode_value(json.dumps(f['value']))
        self.assertTrue(codec.is_value(value))
        self.assertEqual(codec.encode_value(value), f['canonical'])
        self.assertEqual(codec.encode_value(self.make(f['value'])), f['canonical'])
    return test


for _fixture in FIXTURES:
    setattr(StatisticsValueCodecTests, 'test_canonical_' + _fixture['name'].replace('-', '_'), fixture_test(_fixture))


if __name__ == '__main__':
    unittest.main()
