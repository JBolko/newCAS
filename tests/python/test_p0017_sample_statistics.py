import copy
import unittest
import sympy as sp
from src.python.adapters.sympy_value_adapter import SympyValueAdapter
from src.python.evaluator.list_statistics import evaluate_sample_variance_request, evaluate_sample_standard_deviation_request
from test_p0017_population_statistics import integer, rational, expr, dataset, spec, request, HANDLERS as POPULATION

HANDLERS={'sample_variance':evaluate_sample_variance_request,
          'sample_standard_deviation':evaluate_sample_standard_deviation_request}


class SampleStatisticsTests(unittest.TestCase):
    def success(self,op,data,expected):
        req=request(op,[dataset(data)]); selected=spec(op); before=copy.deepcopy((req,selected))
        out=HANDLERS[op](req,selected)
        self.assertEqual(out['status'],'success')
        actual=SympyValueAdapter().to_backend(out['value'])
        self.assertEqual(sp.simplify(actual-expected),0)
        self.assertFalse(actual.has(sp.Float))
        self.assertEqual((req,selected),before)
        if op=='sample_standard_deviation':self.assertIs(actual.is_nonnegative,True)

    def test_integer_sample_uses_n_minus_one(self):
        for op in HANDLERS:
            self.success(op,[integer(1),integer(2),integer(3)],sp.Integer(1))

    def test_two_rational_observations(self):
        data=[rational(1,10),rational(1,5)]
        self.success('sample_variance',data,sp.Rational(1,200))
        self.success('sample_standard_deviation',data,sp.sqrt(2)/20)

    def test_repeats_negative_large_and_constant(self):
        for data in [[integer(-2),integer(4),integer(4)],
                     [integer('9007199254740993'),integer('9007199254740999'),integer('9007199254740999')]]:
            self.success('sample_variance',data,sp.Integer(12))
            self.success('sample_standard_deviation',data,sp.sqrt(12))
        for op in HANDLERS:self.success(op,[rational(-2,3),rational(-2,3)],sp.Integer(0))

    def test_short_and_invalid_datasets_have_structured_diagnostics(self):
        for op,handler in HANDLERS.items():
            for value in [dataset([]),dataset([integer(1)]),dataset([rational(5,7)]),
                          dataset([dataset([]),integer(1)]),
                          dataset([integer(1),expr({'op':'approx','value':'0.2'})]),
                          dataset([integer(1),integer(2)],'vector')]:
                with self.subTest(op=op,value=value):
                    out=handler(request(op,[value]),spec(op))
                    expected='list' if value['kind']=='vector' else 'list-of-at-least-two-exact-rational-expressions'
                    self.assertEqual(out['diagnostic'],{'diagnosticVersion':1,'code':'type-mismatch','parameters':{
                        'operationId':op,'argument':'data','expectedKinds':[expected],'actualKind':value['kind']}})

    def test_wrong_arity_capability_and_options(self):
        for op,handler in HANDLERS.items():
            for inputs in [[],[dataset([integer(1),integer(2)])]*2]:
                self.assertEqual(handler(request(op,inputs),spec(op))['diagnostic']['code'],'wrong-arity')
            req=request(op,[dataset([integer(1),integer(2)])]);req['options']={'correction':0}
            with self.assertRaises(ValueError):handler(req,spec(op))
            wrong=spec(op);wrong['evaluatorId']='probe.statistics.variance'
            req=request(op,[dataset([integer(1),integer(2)])]);req['evaluatorId']=wrong['evaluatorId']
            self.assertEqual(handler(req,wrong)['diagnostic']['code'],'unsupported-operation')

    def test_population_operations_remain_distinct(self):
        data=dataset([integer(1),integer(2),integer(3)])
        for op,expected in [('variance',sp.Rational(2,3)),('standard_deviation',sp.sqrt(sp.Rational(2,3)))]:
            out=POPULATION[op](request(op,[data]),spec(op))
            self.assertEqual(sp.simplify(SympyValueAdapter().to_backend(out['value'])-expected),0)
