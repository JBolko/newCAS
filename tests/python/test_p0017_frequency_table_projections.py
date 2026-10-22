import copy
import json
import subprocess
import sys
import unittest
import sympy as sp
from test_p0017_frequencies import HANDLERS
from test_p0017_frequency_statistics import table_spec, backend
from test_p0017_population_statistics import expr, integer, rational, dataset, spec, request


class FrequencyTableProjectionTests(unittest.TestCase):
    def evaluate(self, op, values, counts):
        req=request(op,[dataset(values),dataset(counts)]);selected=table_spec(op)
        before=copy.deepcopy((req,selected))
        out=HANDLERS[op](req,selected)
        self.assertEqual((req,selected),before)
        return out

    def test_reference_merges_repeats_and_omits_zero(self):
        expected=[[2,5],[2,3],[sp.Rational(2,5),sp.Rational(3,5)],[2,5],[sp.Rational(2,5),1]]
        for op,values in zip(HANDLERS,expected):
            out=self.evaluate(op,[integer(x) for x in [5,2,3,2]],[integer(h) for h in [3,1,0,1]])
            self.assertEqual(out['status'],'success');self.assertEqual(out['value']['kind'],'list')
            self.assertEqual(backend(out['value']),values)

    def test_matches_small_expanded_raw_oracles(self):
        for values,counts in [([7],[1]),([3,1,3,2],[1,2,0,3]),([10,2,3],[1,1,1]),
                              ([-2,0,4],[2,1,4]),([99,2,1,2],[0,2,1,3])]:
            raw=[integer(x) for x,h in zip(values,counts) for _ in range(h)] # Bounded test oracle only.
            for op,handler in HANDLERS.items():
                actual=self.evaluate(op,[integer(x) for x in values],[integer(h) for h in counts])
                self.assertEqual(actual,handler(request(op,[dataset(raw)]),table_spec(op)))

    def test_rationals_decimals_and_numeric_sorting(self):
        values=[rational(1,5),rational(-1,3),rational(-2,6),rational(1,10)]
        expected=[[sp.Rational(-1,3),sp.Rational(1,10),sp.Rational(1,5)], [3,1,2],
                  [sp.Rational(1,2),sp.Rational(1,6),sp.Rational(1,3)], [3,4,6],
                  [sp.Rational(1,2),sp.Rational(2,3),1]]
        for op,want in zip(HANDLERS,expected):
            out=self.evaluate(op,values,[integer(x) for x in [2,1,2,1]])
            actual=backend(out['value']);self.assertEqual(actual,want)
            self.assertFalse(any(x.has(sp.Float) for x in actual))
            if op=='relative_frequencies':self.assertEqual(sum(actual),1)

    def test_huge_values_and_counts_without_expansion_in_bounded_process(self):
        code=r'''
import json,sys
sys.path.insert(0,'tests/python')
from test_p0017_frequencies import HANDLERS
from test_p0017_frequency_statistics import table_spec
from test_p0017_population_statistics import integer,dataset,request
h=9007199254740993
outputs={}
for op,handler in HANDLERS.items():
    outputs[op]=handler(request(op,[dataset([integer(h),integer(-h),integer(0),integer(-h)]),
                                  dataset([integer(3*h),integer(h),integer(0),integer(h)])]),table_spec(op))
print(json.dumps(outputs))
'''
        child=subprocess.run([sys.executable,'-c',code],capture_output=True,text=True,timeout=8)
        self.assertEqual(child.returncode,0,child.stderr)
        h=sp.Integer('9007199254740993')
        expected=[[-h,h],[2*h,3*h],[sp.Rational(2,5),sp.Rational(3,5)],[2*h,5*h],[sp.Rational(2,5),1]]
        for op,want in zip(HANDLERS,expected):
            out=json.loads(child.stdout)[op];self.assertEqual(out['status'],'success')
            self.assertEqual(backend(out['value']),want)

    def test_invalid_elements_even_at_zero_frequency(self):
        for op in HANDLERS:
            for value in [expr({'op':'approx','value':'1'}),dataset([])]:
                out=self.evaluate(op,[value,integer(2)],[integer(0),integer(1)])
                self.assertEqual(out['diagnostic'],{'diagnosticVersion':1,'code':'type-mismatch','parameters':{
                    'operationId':op,'argument':'values','expectedKinds':['nonempty-list-of-exact-rational-expressions'],'actualKind':'list'}})
            for count in [integer(-1),rational(1,2),expr({'op':'approx','value':'1'}),dataset([])]:
                out=self.evaluate(op,[integer(1)],[count])
                self.assertEqual(out['diagnostic'],{'diagnosticVersion':1,'code':'type-mismatch','parameters':{
                    'operationId':op,'argument':'counts','expectedKinds':['list-of-exact-nonnegative-integers'],'actualKind':'list'}})

    def test_empty_zero_total_and_dimensions(self):
        for op in HANDLERS:
            for values,counts in [([],[]),([integer(3)],[integer(0)])]:
                out=self.evaluate(op,values,counts)
                self.assertEqual(out['diagnostic'],{'diagnosticVersion':1,'code':'type-mismatch','parameters':{
                    'operationId':op,'argument':'counts','expectedKinds':['absolute-frequencies-with-positive-total'],'actualKind':'list'}})
            out=self.evaluate(op,[integer(1),integer(2)],[integer(1)])
            self.assertEqual(out['diagnostic'],{'diagnosticVersion':1,'code':'dimension-mismatch','parameters':{
                'operationId':op,'expectedDimension':{'items':2},'actualDimension':{'items':1}}})

    def test_outer_kinds_and_arity(self):
        for op,handler in HANDLERS.items():
            for index,name in [(0,'values'),(1,'counts')]:
                inputs=[dataset([integer(1)]),dataset([integer(1)])];inputs[index]['kind']='vector'
                self.assertEqual(handler(request(op,inputs),table_spec(op))['diagnostic']['parameters'],{
                    'operationId':op,'argument':name,'expectedKinds':['list'],'actualKind':'vector'})
            for inputs in [[],[dataset([integer(1)])]*3]:
                self.assertEqual(handler(request(op,inputs),table_spec(op))['diagnostic'],{
                    'diagnosticVersion':1,'code':'wrong-arity','parameters':{'operationId':op,'expected':[1,2],'actual':len(inputs)}})

    def test_singleton_and_legacy_unary_contract(self):
        for op,handler in HANDLERS.items():
            data=dataset([rational(-5,7)])
            self.assertEqual(handler(request(op,[data]),table_spec(op)),handler(request(op,[data]),spec(op)))
            out=self.evaluate(op,[rational(-5,7),integer(99)],[integer(1),integer(0)])
            self.assertEqual(out,handler(request(op,[data]),table_spec(op)))
