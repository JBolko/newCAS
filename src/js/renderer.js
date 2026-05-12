/**
 * renderer.js
 * Oversætter JSON-resultatobjekter fra CAS-motoren til synligt output.
 * Tilføj nye result-typer her — ikke i main.js.
 */

import { getFriendlyMessage } from './error-catalog.js';

// ─── Hoved-dispatcher ────────────────────────────────────────────────────────

export function renderResult(result, latexDiv, decimalDiv, settings) {
    decimalDiv.textContent = '';

    switch (result.type) {
        case 'error':
            latexDiv.innerHTML = `<span class="cas-error">${getFriendlyMessage(result)}</span>`;
            return;
        case 'success':
            latexDiv.innerHTML = '';
            return;
        case 'hypothesis_test':
            latexDiv.innerHTML = renderHypothesisTest(result);
            return;
        case 'regression':
            renderLatex(result.latex, latexDiv);
            if (result.r_squared != null)
                decimalDiv.textContent = `r² = ${String(result.r_squared).replace('.', ',')}`;
            return;
        case 'list':
            renderLatex(`\\left\\{ ${result.latex} \\right\\}`, latexDiv);
            break;
        default:
            renderLatex(result.latex ?? '', latexDiv);
            break;
    }

    if (result.decimal && !result.is_symbolic) {
        const sep = settings?.user?.decimalSeparator ?? ',';
        decimalDiv.textContent = `≈\u2009${result.decimal.replace('.', sep)}`;
    }
}

export function renderParseError(err, latexDiv, decimalDiv) {
    decimalDiv.textContent = '';
    latexDiv.innerHTML = `<span class="cas-error">${getFriendlyMessage(err)}</span>`;
}

// ─── KaTeX-rendering ─────────────────────────────────────────────────────────

function renderLatex(latex, container) {
    if (!latex) { container.innerHTML = ''; return; }
    window.katex.render(latex, container, {
        throwOnError: false,
        displayMode:  false,
        output:       'htmlAndMathml',
    });
}

// ─── Hypotesetest ─────────────────────────────────────────────────────────────

function renderHypothesisTest(r) {
    // Dispatch på testtype: binomtest har accept_str, kontinuerte tests har stat_sym
    return r.accept_str != null
        ? renderBinomtest(r)
        : renderContinuousTest(r);
}

// ── Binomialtest (diskret) ────────────────────────────────────────────────────

function renderBinomtest(r) {
    const { reject, icon, cls, pCmp, setInfo, sideTxt } = _shared(r);
    return `
<div class="hypothesis-test">
  <div class="ht-header">
    <span class="ht-title">${r.test_name}</span>
    <span class="ht-meta">${sideTxt}&nbsp;&middot;&nbsp;&alpha;&nbsp;=&nbsp;${r.alpha_pct}</span>
  </div>
  <div class="ht-hypotheses">
    <span class="ht-h0">H&sub0;: ${r.h0}</span>
    <span class="ht-sep">&nbsp;&middot;&nbsp;</span>
    <span class="ht-h1">H&sub1;: ${r.h1}</span>
  </div>
  <div class="ht-observed">Observeret: x&nbsp;=&nbsp;${r.x},&ensp;n&nbsp;=&nbsp;${r.n}</div>
  <table class="ht-table">
    <tr>
      <td class="ht-label">P-v&aelig;rdi</td>
      <td class="ht-value ht-pvalue">${r.p_value_fmt}</td>
    </tr>
    <tr>
      <td class="ht-label">Acceptm&aelig;ngde</td>
      <td class="ht-value">${r.accept_str}</td>
    </tr>
    <tr>
      <td class="ht-label">Kritisk m&aelig;ngde</td>
      <td class="ht-value">${r.crit_str}</td>
    </tr>
  </table>
  <div class="ht-conclusion ${cls}">
    <span class="ht-icon">${icon}</span>
    <span>
      <strong>${r.conclusion}</strong>&ensp;&mdash;&ensp;${pCmp}<br>
      <span class="ht-setinfo">${setInfo}</span>
    </span>
  </div>
</div>`.trim();
}

// ── Kontinuerte tests: t-test og chi²-test ───────────────────────────────────

function renderContinuousTest(r) {
    const { reject, icon, cls, pCmp, sideTxt } = _shared(r);

    // Stikprøve-info afhænger af testtype
    const sampleRows = _sampleRows(r);

    // Kritisk region (ensidet vs tosidet)
    const critLabel  = r.side === 'two'
        ? `|${r.stat_sym}| &gt; ${r.crit_fmt}`
        : r.side === 'less' || r.side === 'right'
            ? `${r.stat_sym} ${r.side === 'less' ? '<' : '>'} ${r.side === 'less' ? '-' : ''}${r.crit_fmt}`
            : `${r.stat_sym} &gt; ${r.crit_fmt}`;

    return `
<div class="hypothesis-test">
  <div class="ht-header">
    <span class="ht-title">${r.test_name}</span>
    <span class="ht-meta">${sideTxt}&nbsp;&middot;&nbsp;&alpha;&nbsp;=&nbsp;${r.alpha_pct}</span>
  </div>
  <div class="ht-hypotheses">
    <span class="ht-h0">H&sub0;: ${r.h0}</span>
    <span class="ht-sep">&nbsp;&middot;&nbsp;</span>
    <span class="ht-h1">H&sub1;: ${r.h1}</span>
  </div>
  ${sampleRows ? `<div class="ht-observed">${sampleRows}</div>` : ''}
  <table class="ht-table">
    <tr>
      <td class="ht-label">${r.stat_sym}-teststørrelse</td>
      <td class="ht-value ht-pvalue">${r.stat_fmt}</td>
    </tr>
    <tr>
      <td class="ht-label">Frihedsgrader</td>
      <td class="ht-value">df&nbsp;=&nbsp;${r.df}</td>
    </tr>
    <tr>
      <td class="ht-label">Kritisk v&aelig;rdi</td>
      <td class="ht-value">${r.crit_fmt}&nbsp;<span class="ht-crit-region">(forkast hvis ${critLabel})</span></td>
    </tr>
    <tr>
      <td class="ht-label">P-v&aelig;rdi</td>
      <td class="ht-value ht-pvalue">${r.p_value_fmt}</td>
    </tr>
  </table>
  <div class="ht-conclusion ${cls}">
    <span class="ht-icon">${icon}</span>
    <span><strong>${r.conclusion}</strong>&ensp;&mdash;&ensp;${pCmp}</span>
  </div>
</div>`.trim();
}

// Stikprøve-info per testtype
function _sampleRows(r) {
    if (r.test_name.startsWith('T-test (én')) {
        return `n&nbsp;=&nbsp;${r.n},&ensp;x&#772;&nbsp;=&nbsp;${r.xbar_fmt},&ensp;s&nbsp;=&nbsp;${r.s_fmt}`;
    }
    if (r.test_name.startsWith('T-test (to')) {
        return `n&#8321;&nbsp;=&nbsp;${r.n1},&ensp;x&#772;&#8321;&nbsp;=&nbsp;${r.xbar1_fmt},&ensp;s&#8321;&nbsp;=&nbsp;${r.s1_fmt}`
             + `&ensp;&nbsp;|&ensp;&nbsp;n&#8322;&nbsp;=&nbsp;${r.n2},&ensp;x&#772;&#8322;&nbsp;=&nbsp;${r.xbar2_fmt},&ensp;s&#8322;&nbsp;=&nbsp;${r.s2_fmt}`;
    }
    if (r.table_dim) {
        return `Kontingenstabel: ${r.table_dim}`;
    }
    if (r.k) {
        return `Antal kategorier: ${r.k}`;
    }
    return '';
}

// ── Delte hjælpere ────────────────────────────────────────────────────────────

function _shared(r) {
    const reject  = r.reject_h0;
    const icon    = reject ? '✗' : '✓';
    const cls     = reject ? 'ht-reject' : 'ht-accept';
    const pCmp    = reject
        ? `p-v&aelig;rdi ${r.p_value_fmt} &lt; &alpha; = ${r.alpha_pct}`
        : `p-v&aelig;rdi ${r.p_value_fmt} &ge; &alpha; = ${r.alpha_pct}`;
    const setInfo = r.in_critical != null
        ? (r.in_critical
            ? `x = ${r.x} tilh&oslash;rer den <em>kritiske</em> m&aelig;ngde`
            : `x = ${r.x} tilh&oslash;rer <em>acceptm&aelig;ngden</em>`)
        : '';
    const sideTxt = { two: 'Tosidet', less: 'Venstresidet',
                      greater: 'H&oslash;jresidet', right: 'H&oslash;jresidet' }[r.side] ?? '';
    return { reject, icon, cls, pCmp, setInfo, sideTxt };
}
