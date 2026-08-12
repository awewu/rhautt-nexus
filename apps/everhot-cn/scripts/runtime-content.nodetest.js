const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');

const publicJs = path.resolve(__dirname, '..', 'public', 'js');
const read = (name) => readFileSync(path.join(publicJs, name), 'utf8');

test('document library and dealer locator read the public API through the configured backend origin', () => {
  const documents = read('pro.js');
  const dealers = read('dealers.js');

  assert.match(documents, /EVERHOT_API_BASE/);
  assert.match(documents, /\/api\/v2\/sites\/.*\/documents\?scope=/);
  assert.match(documents, /apiUrl\(item\.url\|\|'#'\)/);
  assert.match(documents, /window\.EVERHOT_DOCS\|\|\[\]/);
  assert.match(dealers, /EVERHOT_API_BASE/);
  assert.match(dealers, /\/api\/v2\/sites\/.*\/dealers\?page=1&pageSize=200/);
  assert.match(dealers, /window\.EVERHOT_DEALERS/);
});

test('static website shell reads public basic settings and category visibility from Nexus', () => {
  const nav = read('nav.js');
  const settings = read('site-basic-settings.js');

  assert.match(nav, /site-basic-settings\.js/);
  assert.match(nav, /\/api\/v2\/sites\/.*\/product-categories/);
  assert.match(nav, /installRuntimeMenu/);
  assert.match(nav, /data-website-category/);
  assert.match(settings, /EVERHOT_API_BASE/);
  assert.match(settings, /\/api\/v2\/sites\/.*\/basic-settings/);
  assert.match(settings, /data-basic-settings-synced/);
});

test('homepage materials prefer the backend manifest and retain the static manifest fallback', () => {
  const materials = read('site-materials.js');

  assert.match(materials, /\/api\/v2\/site-materials\//);
  assert.match(materials, /\?asset=/);
  assert.match(materials, /\/assets\/img\/site-materials\/manifest\.json/);
  assert.match(materials, /normalizeRemoteManifest/);
});

test('product media keeps A-server assets local and sends backend artifacts to B', () => {
  const catalog = read('catalog.js');

  assert.match(catalog, /\^\\\/\(\?:api\\\/v2\|uploads\)\\\//);
  assert.match(catalog, /RUNTIME_API_BASE \+ path/);
  assert.match(catalog, /return path;/);
});

test('product detail categories prefer database category paths over legacy cat sys guesses', () => {
  const catalog = read('catalog.js');

  assert.match(catalog, /function categoryPathValue/);
  assert.match(catalog, /productCategoryBinding/);
  assert.match(catalog, /categoryLeaf\(p\)/);
  assert.match(catalog, /product && product\.websiteCategoryPath[\s\S]*product && product\.categoryPath/);
  assert.match(catalog, /var text = categoryText\(product\);[\s\S]*var legacy = String\(product && product\.sys/);
});
