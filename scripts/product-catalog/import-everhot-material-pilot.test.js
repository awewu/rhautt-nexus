const test = require('node:test');
const assert = require('node:assert/strict');
const {
  BATCH_CODE,
  SOURCE_ROWS,
  assertSafeExisting,
  buildDto,
  readPilotRows,
  readinessFor,
} = require('./import-everhot-material-pilot');

test('selects the ten representative Everhot source rows in the declared order', () => {
  const rows = readPilotRows();
  assert.equal(rows.length, 10);
  assert.deepEqual(rows.map((row) => Number(row['源Excel行'])), SOURCE_ROWS);
  assert.ok(rows.every((row) => row.brandCode === 'everhot' && row['导入候选'] === '是'));
});

test('builds a non-published inactive DTO with migration metadata', () => {
  const row = readPilotRows()[0];
  const dto = buildDto(row, { id: 'category-id' });
  assert.equal(dto.brand, 'everhot');
  assert.equal(dto.status, 'inactive');
  assert.equal(dto.published, false);
  assert.equal(dto.categoryId, 'category-id');
  assert.equal(dto.spec.officialModel, 'ERAH150308');
  assert.equal(dto.meta.productLibrary.batchCode, BATCH_CODE);
  assert.equal(dto.meta.productLibrary.dataReadinessStatus, 'needs_completion');
  assert.equal(dto.meta.productLibrary.autoPublish, false);
  assert.equal(Object.keys(dto.meta.productLibrary.readinessDimensions).length, 8);
});

test('readiness keeps source facts distinct from missing content and assets', () => {
  const richRow = readPilotRows().find((row) => Number(row['源Excel行']) === 214);
  const readiness = readinessFor(richRow);
  assert.equal(readiness.identity.status, 'ready');
  assert.equal(readiness.taxonomy.status, 'ready');
  assert.equal(readiness.sku.status, 'ready');
  assert.equal(readiness.technical.status, 'incomplete');
  assert.equal(readiness.content.status, 'incomplete');
  assert.equal(readiness.assets.status, 'incomplete');
});

test('only allows idempotent overwrite of records from the same pilot batch', () => {
  assert.doesNotThrow(() => assertSafeExisting(null, 'NEW-SKU'));
  assert.doesNotThrow(() => assertSafeExisting({ meta: { productLibrary: { batchCode: BATCH_CODE } } }, 'PILOT-SKU'));
  assert.throws(
    () => assertSafeExisting({ meta: { productLibrary: { batchCode: 'another-import' } } }, 'OWNED-SKU'),
    /禁止覆盖/,
  );
});
