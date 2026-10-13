/** P0021 Slice 16: attach an explicit UI/document angle policy to an already
 * selected P0010 request; never infer angle mode from the source string.
 */
export function withSelectedAngleUnit(evaluate, angleUnit) {
  if (typeof evaluate !== 'function' || !['deg', 'rad'].includes(angleUnit))
    throw new TypeError('explicit deg/rad angle unit and evaluator required');
  return (envelope, selection) => {
    if (!['probe.scalar.sin','probe.scalar.cos','probe.scalar.tan'].includes(selection?.operationSpec?.evaluatorId))
      return evaluate(envelope, selection);
    const request = selection.evaluationRequest;
    if (request?.evaluatorId !== selection.operationSpec.evaluatorId ||
        !request.options || Object.keys(request.options).length !== 0)
      throw new TypeError('unexpected trigonometric request/options');
    const updated = {
      ...selection,
      evaluationRequest: {...request, options: {angleUnit}},
    };
    return evaluate(envelope, updated);
  };
}
