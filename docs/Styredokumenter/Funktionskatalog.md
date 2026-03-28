
# Funktionskatalog

## 1. Generelle principper

- deterministiske funktioner
- strukturerede returværdier
- videreanvendelige output
- syntaktisk sukker fjernes før parsing

## 2. Algebra og ligninger

- solve(expr, var)
- solve({eq1, eq2}, {x,y})
- simplify(expr)
- expand(expr)
- factor(expr)
- completesquare(expr, vars)

## 3. Infinitesimalregning

- derivative(f(x), x, n)
- f'(x), f''(x) og f'''(x)
- limit(f(x), x, a)
- integrate(f(x), x)
- integrate(f(x), x, a, b)
- arclength(f(x), x, a, b)

## 4. Funktioner og regression

- linReg(x, y)
- expReg(x, y)
- powReg(x, y)
- logisticReg(x, y)
- regression(x, y, type=...)

Returnerer funktionsobjekter og evt. grafer (matplotlib).

## 5. Statistik

- mean(data)
- median(data)
- Q1(data), Q3(data)
- quartiles(data)
- extQuart(data)
- boxplot(data)
- histogram(data)
- sumcurve(data)
- frequencyTable(data, cumulative, relative)

## 6. Sandsynlighed

- binompdf(n, p, x)
- binomcdf(n, p, a, b)
- normalcdf(mu, sigma, a, b)

Syntaktisk sukker:
- X ~ b(n,p)
- P(X=k)
- P(a<=X<b)

- binomtest(...)
- chi2GOF(...)
- chi2Independence(...)

## 7. Vektorer og enheder

- vector(...)
- dotP, crossP, det, norm, angle
- line(p1,p2)
- plane(p,n)
- enheder: [m], [m/s], [kg*m/s^2]

## 8. Grafer
Programmet skal også kunne returnerer grafer for funktioner og plot af data. Dette er ikke givet mange tanker endnu, så det lader vi hænge en smule, men jeg tænker på funktioner som følgende:

- xyplot(xes, yes)
- graphplot(fct, interval)
