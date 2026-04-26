"""
Sandsynlighedsfordelinger — diskrete og kontinuerte
Plain functions - registreres af registry.py
"""

import math
from sympy import N as sympy_N  # ← TOP-LEVEL

def _to_float(x):
    """Konverter SymPy-objekt eller tal til float"""
    try:
        # Hvis det har evalf() method (SymPy objects), brug det
        if hasattr(x, 'evalf'):
            return float(x.evalf())
        return float(x)
    except:
        return 0.0

def _to_int(x):
    """Konverter SymPy-objekt eller tal til int"""
    try:
        if hasattr(x, 'evalf'):
            return int(x.evalf())
        return int(x)
    except:
        return 0

def _to_int(x):
    """Konverter SymPy-objekt eller tal til int"""
    try:
        if isinstance(x, int):
            return x
        if isinstance(x, float):
            return int(x)
        val = sympy_N(x)
        return int(val)
    except:
        try:
            return int(x)
        except:
            return 0

def _binom_coeff(n, k):
    """Binomial koefficient C(n,k)"""
    if k > n or k < 0:
        return 0
    if k == 0 or k == n:
        return 1
    k = min(k, n - k)
    result = 1
    for i in range(k):
        result = result * (n - i) // (i + 1)
    return result

def _factorial(n):
    """n!"""
    if n < 0:
        return float('inf')
    if n == 0:
        return 1
    return math.factorial(n)

def binompdf(k, n, p):
    """Binomial sandsynlighedsfunktion: P(X = k)"""
    k = _to_int(k)
    n = _to_int(n)
    p = _to_float(p)
    
    if k < 0 or k > n or p < 0 or p > 1:
        return 0.0
    
    coeff = _binom_coeff(n, k)
    prob = coeff * (p ** k) * ((1 - p) ** (n - k))
    return float(prob)

def binomcdf(k, n, p):
    """Binomial kumulativ fordelingsfunktion: P(X ≤ k)"""
    k = _to_int(k)
    n = _to_int(n)
    p = _to_float(p)
    
    if k < 0:
        return 0.0
    if k >= n:
        return 1.0
    
    total = 0.0
    for i in range(int(k) + 1):
        total += binompdf(i, n, p)
    
    return float(total)

def poissonpdf(k, lam):
    """Poisson sandsynlighedsfunktion: P(X = k)"""
    k = _to_int(k)
    lam = _to_float(lam)
    
    if k < 0 or lam <= 0:
        return 0.0
    
    numerator = (lam ** k) * math.exp(-lam)
    denominator = _factorial(k)
    
    prob = numerator / denominator
    return float(prob)

def poissoncdf(k, lam):
    """Poisson kumulativ fordelingsfunktion: P(X ≤ k)"""
    k = _to_int(k)
    lam = _to_float(lam)
    
    if k < 0:
        return 0.0
    
    total = 0.0
    for i in range(int(k) + 1):
        total += poissonpdf(i, lam)
    
    return float(total)

def _normal_cdf_approx(z):
    """Approksimation af normal CDF ved z-score"""
    if z == 0:
        return 0.5
    
    b1 = 0.319381530
    b2 = -0.356563782
    b3 = 1.781477937
    b4 = -1.821255978
    b5 = 1.330274429
    p = 0.2316419
    c = 0.39894228
    
    t = 1.0 / (1.0 + p * abs(z))
    
    if z >= 0:
        return 1.0 - c * math.exp(-z*z/2.0) * t * (b1 + t*(b2 + t*(b3 + t*(b4 + t*b5))))
    else:
        return c * math.exp(-z*z/2.0) * t * (b1 + t*(b2 + t*(b3 + t*(b4 + t*b5))))

def normpdf(x, mu, sigma):
    """Normal sandsynlighedstæthed: f(x)"""
    x = _to_float(x)
    mu = _to_float(mu)
    sigma = _to_float(sigma)
    
    if sigma <= 0:
        return 0.0
    
    exponent = -((x - mu) ** 2) / (2 * sigma ** 2)
    coefficient = 1.0 / (sigma * math.sqrt(2 * math.pi))
    
    return float(coefficient * math.exp(exponent))

def normcdf(x, mu, sigma):
    """Normal kumulativ fordelingsfunktion: P(X ≤ x)"""
    x = _to_float(x)
    mu = _to_float(mu)
    sigma = _to_float(sigma)
    
    if sigma <= 0:
        return 0.0
    
    z = (x - mu) / sigma
    return float(_normal_cdf_approx(z))

def invnorm(p, mu, sigma):
    """Invers normal fordelingsfunktion"""
    p = _to_float(p)
    mu = _to_float(mu)
    sigma = _to_float(sigma)
    
    if p <= 0 or p >= 1 or sigma <= 0:
        return float('nan')
    
    if p < 0.5:
        z = math.sqrt(-2 * math.log(p))
    else:
        z = -math.sqrt(-2 * math.log(1 - p))
    
    for _ in range(5):
        f = _normal_cdf_approx(z) - p
        pdf = (1.0 / math.sqrt(2 * math.pi)) * math.exp(-z*z/2)
        z = z - f / pdf
    
    return float(mu + sigma * z)

def mean_B(n, p):
    """E(X) for X ~ B(n, p) = n*p"""
    return float(_to_int(n) * _to_float(p))

def var_B(n, p):
    """Var(X) for X ~ B(n, p) = n*p*(1-p)"""
    n_val = _to_int(n)
    p_val = _to_float(p)
    return float(n_val * p_val * (1 - p_val))

def std_B(n, p):
    """Std(X) for X ~ B(n, p)"""
    return float(math.sqrt(var_B(n, p)))

def mean_Po(lam):
    """E(X) for X ~ Po(λ) = λ"""
    return float(_to_float(lam))

def var_Po(lam):
    """Var(X) for X ~ Po(λ) = λ"""
    return float(_to_float(lam))

def std_Po(lam):
    """Std(X) for X ~ Po(λ)"""
    return float(math.sqrt(_to_float(lam)))

def mean_N(mu, sigma):
    """E(X) for X ~ N(μ, σ²) = μ"""
    return float(_to_float(mu))

def var_N(mu, sigma):
    """Var(X) for X ~ N(μ, σ²) = σ²"""
    sigma_val = _to_float(sigma)
    return float(sigma_val ** 2)

def std_N(mu, sigma):
    """Std(X) for X ~ N(μ, σ²) = σ"""
    return float(_to_float(sigma))