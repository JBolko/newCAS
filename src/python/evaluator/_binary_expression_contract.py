"""Private selected-binary-expression contract checks; no dispatch registry."""

def _failure(code, parameters):
    """P0009 Diagnostic inside P0010 failure outcome (transport-only data)."""
    return {'evaluationOutcomeVersion': 1, 'status': 'failure',
            'diagnostic': {'diagnosticVersion': 1, 'code': code,
                           'parameters': parameters}}


def validate_binary_expression_request(request, operation_spec, handler_capability, handler_label):
    if not isinstance(request, dict) or not isinstance(operation_spec, dict):
        raise ValueError('expected request and selected operation spec')
    if request.get('evaluationRequestVersion') != 1:
        raise ValueError('unsupported EvaluationRequest version')
    if operation_spec.get('operationSpecVersion') != 1:
        raise ValueError('unsupported OperationSpec version')
    if not isinstance(request.get('evaluatorId'), str) or not request['evaluatorId']:
        raise ValueError('invalid evaluatorId')
    operation_id = operation_spec.get('operationId')
    if not isinstance(operation_id, str) or not operation_id:
        raise ValueError('invalid selected operationId')

    if request['evaluatorId'] != operation_spec.get('evaluatorId'):
        # Selection mismatch: refuse to execute. Specific diagnostic mapping
        # awaits the real evaluator-dispatch boundary; this slice uses the
        # existing generic unsupported-operation vocabulary.
        return _failure('unsupported-operation', {'operationId': operation_id})
    # Verify the selected handler capability, not the public operation name.
    # A wrong selected handler must never silently perform addition.
    if operation_spec.get('evaluatorId') != handler_capability:
        return _failure('unsupported-operation', {'operationId': operation_id})
    if request.get('instruction') != {} or request.get('options') != {}:
        raise ValueError(f'unsupported instruction or options in {handler_label} slice')

    inputs = request.get('inputs')
    if not isinstance(inputs, list):
        raise ValueError('inputs must be a materialized Value array')
    # Validate the selected operation contract BEFORE judging the supplied
    # inputs. A unary/ternary selected signature is an integration error,
    # not a user's wrong-arity error for the binary addition implementation.
    signatures = operation_spec.get('signatures')
    if not isinstance(signatures, list) or len(signatures) != 1:
        raise ValueError(f'{handler_label} slice expects one selected signature')
    arguments = signatures[0].get('arguments') if isinstance(signatures[0], dict) else None
    if (not isinstance(arguments, list) or len(arguments) != 2
            or any(not isinstance(arg, dict) or not isinstance(arg.get('name'), str)
                   or not arg['name'] for arg in arguments)):
        raise ValueError(f'invalid selected binary {handler_label} signature')
    # P0008 role is instruction semantics, not whether a Value contains symbols.
    # Symbolic expressions remain valid ordinary 'value' operands.
    if any(argument_spec.get('role') != 'value' for argument_spec in arguments):
        raise ValueError(f'{handler_label} handler requires two value argument roles')
    expected_arity = len(arguments)
    if len(inputs) != expected_arity:
        return _failure('wrong-arity', {'operationId': operation_id,
                                        'expected': [expected_arity],
                                        'actual': len(inputs)})
    for argument_spec, value in zip(arguments, inputs):
        argument = argument_spec['name']
        if not isinstance(value, dict):
            raise ValueError('inputs must contain public Values')
        if value.get('kind') != 'expression':
            return _failure('type-mismatch', {'operationId': operation_id,
                                              'argument': argument,
                                              'expectedKinds': ['expression'],
                                              'actualKind': str(value.get('kind', 'unknown'))})

    return None
