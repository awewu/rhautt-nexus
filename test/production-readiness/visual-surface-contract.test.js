const fs = require('fs');
const path = require('path');
const { describeIfArtifacts } = require('./helpers/local-artifacts');

const ROOT = path.join(__dirname, '..', '..');
const LEGACY_PUBLIC = path.join(ROOT, 'archive', 'legacy-ui', 'public');

const PORTAL_PAGES = ['index.html', 'index-ready.html', 'privacy.html', 'consent.html'];

function readPublic(file) {
  return fs.readFileSync(path.join(LEGACY_PUBLIC, file), 'utf8');
}

// 遗留 UI 已归档移除（archive/ 在 .gitignore 且无生成步骤）；
// 产物存在时保持原严格校验。
const describeWithPages = describeIfArtifacts(
  PORTAL_PAGES.map((file) => path.join('archive', 'legacy-ui', 'public', file))
);

describeWithPages('marketing portal visual surface contract (archived legacy pages)', () => {
  test.each(PORTAL_PAGES)('%s remains an available marketing portal surface', (file) => {
    const html = readPublic(file);
    expect(html).toContain('<html');
    expect(html).not.toContain('/rysnova-bim-designer.html');
    expect(html).not.toContain('/designer.html');
  });
});

describe('marketing portal visual surface contract', () => {
  test('browser visual acceptance covers the active marketing portal pages', () => {
    const script = fs.readFileSync(
      path.join(ROOT, 'scripts', 'agent-guards', 'browser-visual-acceptance.js'),
      'utf8'
    );

    expect(script).toContain("path: '/index.html'");
    expect(script).toContain("path: '/index-ready.html'");
    expect(script).not.toContain('designer-workbench');
    expect(script).not.toContain('runViewerAcceptance');
  });
});
