// Loads the calculation code straight out of index.html, so the tests run the exact code the app runs.
const fs = require('fs');
const path = require('path');
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const script = html.match(/<script>([\s\S]*?)<\/script>/g).pop().replace(/<\/?script>/g, '');
const start = script.indexOf('const DEF');
const end = script.indexOf('/* ---------- inputs ---------- */');
if (start < 0 || end < 0) throw new Error('could not find the calculation block in index.html');
const core = script.slice(start, end);
module.exports = new Function(core + `
  return {DEF, compute, sane, parts, warnings, printKit, printModel, printProfiles, stlBinary, area2, rafterSVGs, braceSVG, f0, setUnit, UL, triangleFacts, triangleSVG, annoFor, rafterLayout, layoutSVG};
`)();
