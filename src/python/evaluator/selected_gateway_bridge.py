"""P0021 Slice 8: selected-operation gateway -> existing P0012 handler.

No parsing, symbol lookup, registry or durable Python document scope.
This is deliberately not yet a source-to-Pyodide evaluator.
"""
import json


class GatewayContractError(ValueError):
    """Invalid integration payload (not a mathematical diagnostic)."""


def _portable(obj):
    try:
        return json.loads(json.dumps(obj, allow_nan=False))
    except (TypeError, ValueError, OverflowError) as exc:
        raise GatewayContractError('payload is not JSON portable') from exc


def evaluate_selected_gateway(envelope, selection, selected_handler):
    """Evaluate an externally selected P0010 request with a P0012 handler.

    `selection` MUST be produced by a separate semantic-IR/OperationSpec
    compilation step (NOT by Python parsing the source). `providerIds`
    explicitly attest the exact provider bindings used to compile it.
    """
    envelope = _portable(envelope)
    selection = _portable(selection)
    if not isinstance(envelope, dict) or envelope.get('protocol') != 'newcas.semantic-evaluation.v1':
        raise GatewayContractError('unsupported gateway protocol')
    for key in ('revision', 'blockId', 'taskScopeId', 'source'):
        if not isinstance(envelope.get(key), str) or not envelope[key]:
            raise GatewayContractError(f'invalid gateway {key}')
    providers = envelope.get('providers')
    if not isinstance(providers, list):
        raise GatewayContractError('invalid providers')
    identities = []
    for entry in providers:
        if not isinstance(entry, dict) or not isinstance(entry.get('name'), str) or not entry['name'] or not isinstance(entry.get('providerId'), str) or not entry['providerId'] or 'value' not in entry:
            raise GatewayContractError('invalid provider entry')
        identities.append((entry['name'], entry['providerId']))
    if len(set(identities)) != len(identities) or len({name for name, _ in identities}) != len(identities):
        raise GatewayContractError('duplicate provider binding')
    if not isinstance(selection, dict) or selection.get('blockId') != envelope['blockId'] or selection.get('revision') != envelope['revision']:
        raise GatewayContractError('selected operation belongs to another block or revision')
    # A selection must be explicitly attested to the *same* sources and providers.
    if selection.get('source') != envelope['source'] or selection.get('taskScopeId') != envelope['taskScopeId']:
        raise GatewayContractError('selected operation belongs to different source or task')
    selected_bindings = selection.get('providerIds')
    if not isinstance(selected_bindings, list) or any(not isinstance(x, dict) for x in selected_bindings):
        raise GatewayContractError('missing provider identity attestation')
    if (any(not isinstance(x.get('name'), str) or not isinstance(x.get('providerId'), str) for x in selected_bindings)
            or sorted((x['name'], x['providerId']) for x in selected_bindings) != sorted(identities)):
        raise GatewayContractError('selected operation provider identities differ')
    request, spec = selection.get('evaluationRequest'), selection.get('operationSpec')
    if not isinstance(request, dict) or not isinstance(spec, dict):
        raise GatewayContractError('missing selected P0010 request / P0008 OperationSpec')
    if request.get('evaluationRequestVersion') != 1 or spec.get('operationSpecVersion') != 1:
        raise GatewayContractError('unsupported selection contract version')
    if not isinstance(request.get('evaluatorId'), str) or request['evaluatorId'] != spec.get('evaluatorId'):
        raise GatewayContractError('selection evaluator mismatch')
    if not callable(selected_handler):
        raise GatewayContractError('preselected handler required')
    # The handler owns mathematical diagnostics, not this transport boundary.
    outcome = _portable(selected_handler(request, spec))
    if not isinstance(outcome, dict) or outcome.get('evaluationOutcomeVersion') != 1 or outcome.get('status') not in ('success', 'failure'):
        raise GatewayContractError('invalid P0010 evaluation outcome')
    if outcome['status'] == 'success':
        if 'value' not in outcome:
            raise GatewayContractError('successful outcome without Value')
        return {'blockId': envelope['blockId'], 'status': 'success', 'value': outcome['value']}
    diagnostic = outcome.get('diagnostic')
    if not isinstance(diagnostic, dict) or not isinstance(diagnostic.get('code'), str) or not diagnostic['code']:
        raise GatewayContractError('failed outcome without diagnostic')
    return {'blockId': envelope['blockId'], 'status': 'failure', 'code': diagnostic['code'], 'message': diagnostic['code']}
