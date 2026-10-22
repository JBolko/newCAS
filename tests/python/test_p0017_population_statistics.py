import copy
import unittest
import sympy as sp
from src.python.adapters.sympy_value_adapter import SympyValueAdapter
from src.python.evaluator.list_mean import evaluate_mean_request
from src.python.evaluator.list_statistics import evaluate_variance_request, evaluate_standard_deviation_request


def expr(node):
    return {'valueVersion': 1, 'kind': 'expression', 'data': {'expr': node}}


def integer(n):
    return expr({'op': 'integer', 'value': str(n)})


def rational(n, d):
    return expr({'op': 'rational', 'numerator': str(n), 'denominator': str(d)})


def dataset(items, kind='list'):
    return {'valueVersion': 1, 'kind': kind, 'data': {'items': items}}


def spec(op):
    return {'operationSpecVersion': 1, 'operationId': op, 'evaluatorId': 'probe.statistics.'+op,
            'signatures': [{'arguments': [{'name': 'data', 'role': 'value'}]}]}


def request(op, inputs):
    return {'evaluationRequestVersion': 1, 'evaluatorId': 'probe.statistics.'+op,
            'instruction': {}, 'options': {}, 'inputs': inputs}


HANDLERS={'mean': evaluate_mean_request, 'variance': evaluate_variance_request,
          'standard_deviation': evaluate_standard_deviation_request}


class PopulationStatisticsTests(unittest.TestCase):
    def success(self, op, items, expected):
        req=request(op,[dataset(items)]); selected=spec(op); before=copy.deepcopy((req,selected))
        out=HANDLERS[op](req,selected)
        self.assertEqual(out['status'],'success')
        actual=SympyValueAdapter().to_backend(out['value'])
        self.assertEqual(sp.simplify(actual-expected),0)
        self.assertFalse(actual.has(sp.Float))
        self.assertEqual((req,selected),before)
        return out

    def test_fraction_mean(self):
        self.success('mean',[rational(1,3),rational(2,3)],sp.Rational(1,2))

    def test_decimal_population(self):
        data=[rational(1,10),rational(1,5)]
        for op,expected in [('mean',sp.Rational(3,20)),('variance',sp.Rational(1,400)),('standard_deviation',sp.Rational(1,20))]:
            with self.subTest(op=op): self.success(op,data,expected)

    def test_population_irrational_root(self):
        self.success('variance',[integer(1),integer(2),integer(3)],sp.Rational(2,3))
        out=self.success('standard_deviation',[integer(1),integer(2),integer(3)],sp.sqrt(sp.Rational(2,3)))
        self.assertIs(SympyValueAdapter().to_backend(out['value']).is_nonnegative,True)

    def test_singleton(self):
        for op in ['variance','standard_deviation']:
            with self.subTest(op=op): self.success(op,[rational(-5,7)],sp.Integer(0))

    def test_repeats_negative_large_and_translation(self):
        for data in [[integer(-2),integer(4),integer(4)],
                     [integer('9007199254740993'),integer('9007199254740999'),integer('9007199254740999')]]:
            self.success('variance',data,sp.Integer(8))
            self.success('standard_deviation',data,sp.sqrt(8))

    def test_rejected_domains_are_structured(self):
        for op,handler in HANDLERS.items():
            for value,expected,actual in [
                (dataset([]),'nonempty-list-of-exact-rational-expressions','list'),
                (dataset([integer(1)],'vector'),'list','vector'),
                (dataset([dataset([])]),'nonempty-list-of-exact-rational-expressions','list'),
                (dataset([expr({'op':'approx','value':'0.1'})]),'nonempty-list-of-exact-rational-expressions','list'),
                (dataset([expr({'op':'pow','base':{'op':'integer','value':'2'},'exponent':{'op':'rational','numerator':'1','denominator':'2'}})]),'nonempty-list-of-exact-rational-expressions','list'),
            ]:
                with self.subTest(op=op,value=value):
                    out=handler(request(op,[value]),spec(op))
                    self.assertEqual(out['diagnostic'],{'diagnosticVersion':1,'code':'type-mismatch','parameters':{
                        'operationId':op,'argument':'data','expectedKinds':[expected],'actualKind':actual}})

    def test_wrong_arity_and_capability(self):
        for op,handler in HANDLERS.items():
            for inputs in [[],[dataset([integer(1)])]*2]:
                self.assertEqual(handler(request(op,inputs),spec(op))['diagnostic'],{'diagnosticVersion':1,'code':'wrong-arity',
                    'parameters':{'operationId':op,'expected':[1],'actual':len(inputs)}})
            wrong=spec(op);wrong['evaluatorId']='wrong'
            req=request(op,[dataset([integer(1)])]);req['evaluatorId']='wrong'
            self.assertEqual(handler(req,wrong)['diagnostic']['code'],'unsupported-operation')

    def test_malformed_rational_payload_is_not_coerced(self):
        for n,d in [('1','0'),(1,'2'),('1',2),('1','02'),('1.0','2')]:
            with self.subTest(n=n,d=d), self.assertRaises(ValueError):
                evaluate_mean_request(request('mean',[dataset([expr({'op':'rational','numerator':n,'denominator':d})])]),spec('mean'))
