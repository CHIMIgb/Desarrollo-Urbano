const fs = require('fs');
const path = require('path');

const css = fs.readFileSync('style.css', 'utf8');

// Directories
const dirs = [
    'styles',
    'styles/tokens',
    'styles/base',
    'styles/components',
    'styles/layout'
];

for (const d of dirs) {
    if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
}

function extractBetween(text, startTag, endTag) {
    const startIndex = text.indexOf(startTag);
    if (startIndex === -1) return '';
    const start = startIndex + startTag.length;
    let end = text.length;
    if (endTag) {
        const endIndex = text.indexOf(endTag, start);
        if (endIndex !== -1) end = endIndex;
    }
    return text.substring(start, end).trim();
}

// Extract base variables
const rootVarsMatch = css.match(/:root\s*{([^}]+)}/);
const rootVars = rootVarsMatch ? rootVarsMatch[0] : '';
fs.writeFileSync('styles/tokens/colors.css', rootVars + '\n');

const typography = `
body {
  font-family: 'Inter', sans-serif;
  font-size: 13px;
}
`;
fs.writeFileSync('styles/tokens/typography.css', typography.trim() + '\n');

const spacing = `
/* Spacing variables or breakpoints can go here */
`;
fs.writeFileSync('styles/tokens/spacing.css', spacing.trim() + '\n');

const resetIndex = css.indexOf('/* ── SCROLLBAR ── */');
const resetEnd = css.indexOf('/* ============================================================ HEADER */');
const reset = css.substring(0, resetIndex).replace(/:root\s*{[^}]+}/, '').replace(/body\s*{[^}]+}/, '') + '\n' + css.substring(resetIndex, resetEnd);
fs.writeFileSync('styles/base/reset.css', reset.trim() + '\n');

// Specific sections
const sections = [
    { name: 'layout/header.css', start: '/* ============================================================ HEADER */', end: '/* ============================================================ APP BODY */' },
    { name: 'layout/app-body.css', start: '/* ============================================================ APP BODY */', end: '/* ============================================================ TOOLBAR */' },
    { name: 'components/toolbar.css', start: '/* ============================================================ TOOLBAR */', end: '/* ============================================================ MAP */' },
    { name: 'components/map.css', start: '/* ============================================================ MAP */', end: '/* ============================================================ PROPS PANEL */' },
    { name: 'components/panels.css', start: '/* ============================================================ PROPS PANEL */', end: '/* ============================================================ TOAST */' },
    { name: 'components/toast.css', start: '/* ============================================================ TOAST */', end: '/* ============================================================ MAPLIBRE OVERRIDES */' },
    { name: 'components/maplibre-overrides.css', start: '/* ============================================================ MAPLIBRE OVERRIDES */', end: '/* ============================================================ OPTIONS BAR */' },
    { name: 'components/options-bar.css', start: '/* ============================================================ OPTIONS BAR */', end: '/* ============================================================ MEASUREMENT CARD */' },
    { name: 'components/measurement.css', start: '/* ============================================================ MEASUREMENT CARD */', end: '/* ============================================================ PRECISION PANEL */' },
    { name: 'components/precision-panel.css', start: '/* ============================================================ PRECISION PANEL */', end: '/* ============================================================ NEW UTILITIES & EXTRACTED CLASSES' },
    { name: 'base/utilities.css', start: '/* ============================================================ NEW UTILITIES & EXTRACTED CLASSES', end: null }
];

sections.forEach(sec => {
    let content = extractBetween(css, sec.start, sec.end);
    if(content) {
        fs.writeFileSync('styles/' + sec.name, sec.start + '\n' + content + '\n');
    }
});

const mainCss = `
@import './tokens/colors.css';
@import './tokens/typography.css';
@import './tokens/spacing.css';

@import './base/reset.css';
@import './base/utilities.css';

@import './layout/header.css';
@import './layout/app-body.css';

@import './components/toolbar.css';
@import './components/map.css';
@import './components/panels.css';
@import './components/toast.css';
@import './components/options-bar.css';
@import './components/measurement.css';
@import './components/precision-panel.css';
@import './components/maplibre-overrides.css';
`;

fs.writeFileSync('styles/main.css', mainCss.trim() + '\n');
console.log('CSS extraction complete!');
