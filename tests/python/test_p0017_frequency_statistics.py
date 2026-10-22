import copy
import json
import subprocess
import sys
import unittest
import sympy as sp
from src.python.adapters.sympy_value_adapter import SympyValueAdapter
from src.python.evaluator.list_statistics import (
    evaluate_mean_request, evaluate_variance_request, evaluate_standard_deviation_request,
    evaluate_sample_variance_request, evaluate_sample_standard_deviation_request,
    evaluate_median_request, evaluate_min_request, evaluate_max_request,
    evaluate_quartiles_request, evaluate_five_number_summary_request)
from test_p0017_population_statistics import expr, integer, rational, dataset, spec, request

HANDLERS = dict(zip(['mean','variance','standard_deviation','sample_variance','sample_standard_deviation',
                    'median','min','max','quartiles','five_number_summary'],
                   [evaluate_mean_request,evaluate_variance_request,evaluate_standard_deviation_request,
                    evaluate_sample_variance_request,evaluate_sample_standard_deviation_request,
                    evaluate_median_request,evaluate_min_request,evaluate_max_request,
                    evaluate_quartiles_request,evaluate_five_number_summary_request]))


def table_spec(op):
    selected = spec(op)
    selected['signatures'].append({'arguments': [{'name':'values','role':'value'}, {'name':'counts','role':'value'}]})
    return selected


def backend(value):
    if value['kind'] == 'list': return [backend(x) for x in value['data']['items']]
    return SympyValueAdapter().to_backend(value)


class FrequencyStatisticsTests(unittest.TestCase):
    def evaluate(self, op, values, counts):
        req = request(op, [dataset(values), dataset(counts)]); selected = table_spec(op)
        before = copy.deepcopy((req, selected))
        out = HANDLERS[op](req, selected)
        self.assertEqual((req, selected), before)
        return out

    def test_reference_exact_results(self):
        expected = [sp.Rational(11,3),sp.Rational(17,9),sp.sqrt(17)/3,
                    sp.Rational(34,15),sp.sqrt(sp.Rational(34,15)),4,2,5,[2,4,5],[2,2,4,5,5]]
        for op, result in zip(HANDLERS,expected):
            with self.subTest(op=op):
                out=self.evaluate(op,[integer(x) for x in [2,3,5]],[integer(x) for x in [2,1,3]])
                self.assertEqual(out['status'],'success');self.assertEqual(backend(out['value']),result)

    def test_matches_raw_for_small_tables_and_all_quartile_sizes(self):
        cases=[([7],[n]) for n in range(1,10)] + [([3,1,3,2],[1,2,0,3]),([99,2,1,2],[0,2,1,3]),
            ([10,2,3],[1,1,1]),([-2,0,4],[2,1,4]),([1,3],[1,1]),([3,1,2],[1,1,1])]
        for values, counts in cases:
            raw=[integer(v) for v,h in zip(values,counts) for _ in range(h)] # Small test oracle only.
            for op,handler in HANDLERS.items():
                with self.subTest(op=op,values=values,counts=counts):
                    actual=self.evaluate(op,[integer(x) for x in values],[integer(x) for x in counts])
                    expected=handler(request(op,[dataset(raw)]),table_spec(op))
                    self.assertEqual(actual['status'],expected['status'])
                    if actual['status']=='success':
                        self.assertEqual(actual['value'],expected['value'])
                    else:
                        self.assertEqual(expected['diagnostic']['parameters'],{'operationId':op,'argument':'data',
                            'expectedKinds':['list-of-at-least-two-exact-rational-expressions'],'actualKind':'list'})
                        self.assertEqual(actual['diagnostic'],{'diagnosticVersion':1,'code':'type-mismatch','parameters':{
                            'operationId':op,'argument':'counts','expectedKinds':['absolute-frequencies-with-total-at-least-two'],'actualKind':'list'}})

    def test_rational_decimal_and_zero_count_extrema(self):
        for op,result in [('mean',sp.Rational(3,20)),('variance',sp.Rational(1,400)),
                          ('standard_deviation',sp.Rational(1,20)),('sample_variance',sp.Rational(1,200)),
                          ('sample_standard_deviation',sp.sqrt(2)/20),('median',sp.Rational(3,20)),
                          ('min',sp.Rational(1,10)),('max',sp.Rational(1,5)),
                          ('quartiles',[sp.Rational(1,10),sp.Rational(3,20),sp.Rational(1,5)]),
                          ('five_number_summary',[sp.Rational(1,10),sp.Rational(1,10),sp.Rational(3,20),sp.Rational(1,5),sp.Rational(1,5)])]:
            out=self.evaluate(op,[integer(-999),rational(1,10),rational(1,5),integer(999)],
                              [integer(0),integer(1),integer(1),integer(0)])
            self.assertEqual(backend(out['value']),result)

    def test_singleton_convention_uses_total_not_row_count(self):
        for op,result in [('quartiles',[sp.Rational(-5,7)]*3),('five_number_summary',[sp.Rational(-5,7)]*5),
                          ('variance',0),('standard_deviation',0),('mean',sp.Rational(-5,7))]:
            out=self.evaluate(op,[integer(999),rational(-5,7)],[integer(0),integer(1)])
            self.assertEqual(backend(out['value']),result)
        for op in ['sample_variance','sample_standard_deviation']:
            out=self.evaluate(op,[integer(999),rational(-5,7)],[integer(0),integer(1)])
            self.assertEqual(out['diagnostic']['parameters'],{'operationId':op,'argument':'counts',
                'expectedKinds':['absolute-frequencies-with-total-at-least-two'],'actualKind':'list'})

    def test_huge_counts_exact_without_expansion_with_process_limit(self):
        # Guard against an implementation allocating sum(H) elements or looping sum(H) times.
        code=r'''
import json,sys
sys.path.insert(0,'tests/python')
from test_p0017_frequency_statistics import HANDLERS,table_spec
from test_p0017_population_statistics import integer,dataset,request
h=9007199254740993
outputs={}
for op,handler in HANDLERS.items():
    out=handler(request(op,[dataset([integer(0),integer(2)]),dataset([integer(h),integer(h)])]),table_spec(op))
    assert out['status']=='success',out
    outputs[op]=out['value']
print(json.dumps(outputs))
'''
        child=subprocess.run([sys.executable,'-c',code],capture_output=True,text=True,timeout=8)
        self.assertEqual(child.returncode,0,child.stderr)
        outputs=json.loads(child.stdout);h=sp.Integer('9007199254740993')
        expected=[1,1,1,2*h/(2*h-1),sp.sqrt(2*h/(2*h-1)),1,0,2,[0,1,2],[0,0,1,2,2]]
        for op,value in zip(HANDLERS,expected): self.assertEqual(backend(outputs[op]),value)

    def test_large_odd_total_rank_boundaries(self):
        h=9007199254740993
        for op,result in [('median',10),('quartiles',[0,10,20]),('five_number_summary',[0,0,10,20,20])]:
            out=self.evaluate(op,[integer(20),integer(10),integer(0)],[integer(h),integer(1),integer(h)])
            self.assertEqual(backend(out['value']),result)
        # Huge n divisible by four: Q1 and Q2 straddle exact cumulative boundaries.
        for op,result in [('median',3),('quartiles',[1,3,4]),('five_number_summary',[0,1,3,4,4])]:
            out=self.evaluate(op,[integer(0),integer(2),integer(4)],[integer(h),integer(h),integer(2*h)])
            self.assertEqual(backend(out['value']),result)

    def test_dimension_mismatch_is_structured(self):
        out=self.evaluate('mean',[integer(1),integer(2)],[integer(1)])
        self.assertEqual(out['diagnostic'],{'diagnosticVersion':1,'code':'dimension-mismatch','parameters':{
            'operationId':'mean','expectedDimension':{'items':2},'actualDimension':{'items':1}}})

    def test_invalid_frequency_and_observation_domains(self):
        for op in HANDLERS:
            for counts,descriptor in [([integer(-1)],'list-of-exact-nonnegative-integers'),
                ([rational(1,2)],'list-of-exact-nonnegative-integers'),
                ([expr({'op':'approx','value':'1'})],'list-of-exact-nonnegative-integers'),
                ([dataset([])],'list-of-exact-nonnegative-integers'),
                ([integer(0)],'absolute-frequencies-with-positive-total')]:
                out=self.evaluate(op,[integer(1)],counts)
                self.assertEqual(out['diagnostic'],{'diagnosticVersion':1,'code':'type-mismatch','parameters':{
                    'operationId':op,'argument':'counts','expectedKinds':[descriptor],'actualKind':'list'}})
            out=self.evaluate(op,[expr({'op':'approx','value':'2'})],[integer(0)])
            self.assertEqual(out['diagnostic']['parameters']['argument'],'values')
        out=self.evaluate('mean',[],[])
        self.assertEqual(out['diagnostic']['parameters']['expectedKinds'],['absolute-frequencies-with-positive-total'])

    def test_outer_kinds_arity_and_contract(self):
        for op,handler in HANDLERS.items():
            for index,name in [(0,'values'),(1,'counts')]:
                inputs=[dataset([integer(1)]),dataset([integer(2)])];inputs[index]['kind']='vector'
                self.assertEqual(handler(request(op,inputs),table_spec(op))['diagnostic']['parameters'],{
                    'operationId':op,'argument':name,'expectedKinds':['list'],'actualKind':'vector'})
            for inputs in [[],[dataset([integer(1)])]*3]:
                self.assertEqual(handler(request(op,inputs),table_spec(op))['diagnostic'],{
                    'diagnosticVersion':1,'code':'wrong-arity','parameters':{'operationId':op,'expected':[1,2],'actual':len(inputs)}})
