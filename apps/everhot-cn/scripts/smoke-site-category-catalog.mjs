#!/usr/bin/env node
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import vm from 'node:vm';

const ROOT = join(import.meta.dirname, '..');
const CATALOG_JS = readFileSync(join(ROOT, 'public', 'js', 'catalog.js'), 'utf8');

const categoryTree = [
  {
    id: 'cat-residential',
    code: 'residential',
    slug: 'residential',
    name: '家用',
    children: [
      {
        id: 'cat-heating',
        parentId: 'cat-residential',
        code: 'heating-cooling',
        slug: 'heating-cooling',
        name: '采暖与制冷',
        children: [
          {
            id: 'cat-underfloor',
            parentId: 'cat-heating',
            code: 'geothermal-system',
            slug: 'underfloor-heating',
            name: '地暖系统',
            children: [],
          },
        ],
      },
    ],
  },
];

const products = [
  {
    brand: 'everhot',
    slug: 'bound-underfloor',
    name: '后台绑定地暖产品',
    summary: '来自官网目录绑定',
    websiteCategoryPath: '家用 / 采暖与制冷 / 地暖系统',
    siteMeta: {
      websiteCategoryPath: '家用 / 采暖与制冷 / 地暖系统',
      siteProductCategory: {
        id: 'cat-underfloor',
        code: 'geothermal-system',
        slug: 'underfloor-heating',
        name: '地暖系统',
        path: '家用 / 采暖与制冷 / 地暖系统',
        level: 3,
      },
    },
    cat: 'residential',
    sys: 'water-heating',
    series: '不是地暖系统',
  },
  {
    brand: 'everhot',
    slug: 'other-category',
    name: '其他目录产品',
    summary: '不应出现在地暖页',
    websiteCategoryPath: '家用 / 热水系统',
    siteMeta: {
      siteProductCategory: {
        id: 'cat-water',
        slug: 'water-heating',
        name: '热水系统',
        path: '家用 / 热水系统',
      },
    },
    cat: 'residential',
    sys: 'heating-cooling',
    series: '地暖系统',
  },
];

const grid = {
  dataset: {},
  parentNode: null,
  innerHTML: '',
  getAttribute(name) {
    return name === 'data-catalog' ? 'residential:heating-cooling:地暖系统' : null;
  },
  querySelectorAll() {
    return [];
  },
};

const calls = [];
const context = {
  console,
  CustomEvent: function CustomEvent(type, init) {
    this.type = type;
    this.detail = init && init.detail;
  },
  URLSearchParams,
  location: {
    hostname: 'localhost',
    search: '',
    pathname: '/products/residential/heating-cooling/underfloor-heating/',
  },
  document: {
    readyState: 'complete',
    addEventListener() {},
    querySelector(selector) {
      if (selector === '[data-product-detail]' || selector === '[data-product-compare]')
        return null;
      return null;
    },
    querySelectorAll(selector) {
      if (selector === '[data-catalog]' || selector === '[data-catalog],[data-featured]')
        return [grid];
      if (selector === '[data-featured]') return [];
      return [];
    },
    createElement() {
      return { className: '', innerHTML: '', querySelectorAll: () => [] };
    },
    head: { appendChild() {} },
  },
  history: { replaceState() {} },
  navigator: {},
  fetch: async (url) => {
    calls.push(url);
    if (url === '/api/v2/sites/everhot/product-categories') {
      return {
        ok: true,
        json: async () => ({ success: true, data: { items: [], tree: categoryTree, total: 3 } }),
      };
    }
    assert.equal(url, '/api/v2/sites/everhot/products?locale=zh-CN');
    return {
      ok: true,
      json: async () => ({ success: true, data: { items: products, total: products.length } }),
    };
  },
  setTimeout,
  clearTimeout,
  Promise,
};
context.window = context;
context.window.EVERHOT_PRODUCTS = [];

vm.createContext(context);
vm.runInContext(CATALOG_JS, context, { filename: 'catalog.js' });
if (context.window.EVERHOT_PRODUCTS_READY) await context.window.EVERHOT_PRODUCTS_READY;
await Promise.resolve();
await Promise.resolve();

assert.deepEqual(calls, [
  '/api/v2/sites/everhot/product-categories',
  '/api/v2/sites/everhot/products?locale=zh-CN',
]);
assert.equal(context.window.EVERHOT_PRODUCTS_STATUS, 'runtime');
assert.match(grid.innerHTML, /后台绑定地暖产品/);
assert.doesNotMatch(grid.innerHTML, /其他目录产品/);
assert.doesNotMatch(grid.innerHTML, /该系列产品正在陆续上架/);

console.log('Everhot site category catalog smoke passed.');
