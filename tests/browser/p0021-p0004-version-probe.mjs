/* Manual real browser P0004 backend-version probe. This does not touch the app runtime. */
const button = document.getElementById('run');
const status = document.getElementById('status');
const output = document.getElementById('output');
const CDN = 'https://cdn.jsdelivr.net/pyodide/v314.0.7/full/';
button.addEventListener('click', async () => {
  button.disabled = true;
  status.textContent = 'Indlæser Pyodide og SymPy fra P0004-baseline…';
  output.textContent = '';
  try {
    const {loadPyodide} = await import(`${CDN}pyodide.mjs`);
    const py = await loadPyodide({indexURL:CDN});
    await py.loadPackage('sympy');
    const actual = JSON.parse(await py.runPythonAsync(`import json, sys, sympy
json.dumps({'python': list(sys.version_info[:3]), 'sympy': sympy.__version__})`));
    const report={pyodide:py.version, ...actual};
    output.textContent=JSON.stringify(report,null,2);
    if (report.pyodide !== '314.0.7' || actual.sympy !== '1.14.0' ||
        JSON.stringify(actual.python) !== '[3,14,2]') {
      throw Error('Indlæste runtime-versioner stemmer ikke med P0004');
    }
    status.textContent = 'PASS — faktisk indlæst Pyodide/Python/SymPy matcher P0004.';
    status.className='pass';
  } catch (error) {
    status.textContent=`FAIL — ${error.message}`;
    status.className='fail';
  } finally {button.disabled=false;}
});
