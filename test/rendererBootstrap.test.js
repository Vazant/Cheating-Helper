const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const sourceRoot = path.resolve(__dirname, '../src');
const renderer = fs.readFileSync(path.join(sourceRoot, 'utils/renderer.js'), 'utf8');
const html = fs.readFileSync(path.join(sourceRoot, 'index.html'), 'utf8');

for (const [, request] of renderer.matchAll(/require\(['"](\.[^'"]+)['"]\)/g)) {
    const resolved = path.resolve(sourceRoot, request);
    assert.ok(fs.existsSync(resolved) || fs.existsSync(`${resolved}.js`), `Renderer dependency does not resolve from index.html: ${request}`);
}

assert.ok(!html.includes('id="cheatingDaddy"'), 'The app element must not shadow window.cheatingDaddy');
assert.ok(renderer.includes("Object.defineProperty(window, 'cheatingDaddy'"));

console.log('Renderer bootstrap: OK');
