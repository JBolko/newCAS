from typing import Iterable, Union
from .registry import register

Number = Union[int, float]

@register("mean", category="statistics")
def mean(data: Iterable[Number]) -> float:
    return sum(data) / len(data)

@register("median", category="statistics")
def median(data: Iterable[Number]) -> float:
    s = sorted(data)
    n = len(s)
    if n % 2 == 1:
        return float(s[n // 2])
    return float((s[n // 2 - 1] + s[n // 2]) / 2)

@register("Q1", category="statistics")
def Q1(data: Iterable[Number]) -> float:
    s = sorted(data)
    return median(s[:len(s) // 2])

@register("Q3", category="statistics")
def Q3(data: Iterable[Number]) -> float:
    s = sorted(data)
    n = len(s)
    upper = s[n // 2:] if n % 2 == 0 else s[n // 2 + 1:]
    return median(upper)

@register("min", forbidden=True, category="statistics")
def cas_min(*args: Union[Number, Iterable[Number]]) -> Number:
    data = args[0] if len(args) == 1 and isinstance(args[0], (list, tuple)) else args
    return min(data)

@register("max", forbidden=True, category="statistics")
def cas_max(*args: Union[Number, Iterable[Number]]) -> Number:
    data = args[0] if len(args) == 1 and isinstance(args[0], (list, tuple)) else args
    return max(data)