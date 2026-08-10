import 'reflect-metadata';
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { PERMISSIONS_KEY } from '../common/permissions.decorator';
import { ROLES_KEY } from '../common/roles.decorator';
import { SiteDocumentController } from './site-document.controller';
import { documentPublicationAfterEdit, formatDocumentSize } from './site-document.service';

const WRITE_ROLES = ['platform_admin', 'hq_admin', 'brand_admin'];

function permissionsFor(method: keyof SiteDocumentController): string[] {
  return Reflect.getMetadata(PERMISSIONS_KEY, SiteDocumentController.prototype[method]) || [];
}

function rolesFor(method: keyof SiteDocumentController): string[] {
  return Reflect.getMetadata(ROLES_KEY, SiteDocumentController.prototype[method]) || [];
}

test('site document controller maps each operation to its dedicated permission', () => {
  assert.deepEqual(permissionsFor('listCategories'), ['site.documentation.read']);
  assert.deepEqual(permissionsFor('listDocuments'), ['site.documentation.read']);
  for (const [method, permission] of [
    ['createCategory', 'site.documentation.create'],
    ['createDocument', 'site.documentation.create'],
    ['updateCategory', 'site.documentation.update'],
    ['updateDocument', 'site.documentation.update'],
    ['hideDocument', 'site.documentation.update'],
    ['publishDocument', 'site.documentation.publish'],
    ['deleteCategory', 'site.documentation.delete'],
    ['archiveDocument', 'site.documentation.delete'],
  ] as const) {
    assert.deepEqual(rolesFor(method), WRITE_ROLES);
    assert.deepEqual(permissionsFor(method), [permission]);
  }
});

test('document sizes are projected using the same website units', () => {
  assert.equal(formatDocumentSize(999), '999 B');
  assert.equal(formatDocumentSize(2048), '2 KB');
  assert.equal(formatDocumentSize(2.4 * 1024 * 1024), '2.4 MB');
});

test('editing a published document returns it to draft for republishing', () => {
  const publishedAt = new Date('2026-08-04T08:00:00.000Z');
  assert.deepEqual(
    documentPublicationAfterEdit('published', publishedAt, { displayName: '新版安装手册' }),
    { status: 'draft', publishedAt: null }
  );
  assert.deepEqual(
    documentPublicationAfterEdit('hidden', publishedAt, { displayName: '新版安装手册' }),
    { status: 'hidden', publishedAt }
  );
});

test('site document migration uses the upload ledger and enforces tenant RLS', () => {
  const migration = fs.readFileSync(
    path.resolve(
      __dirname,
      '../../../../../database/postgres/migrations/089_site_document_library.sql'
    ),
    'utf8'
  );
  assert.match(migration, /REFERENCES rhautt_nexus\.uploaded_files\(id\)/);
  assert.doesNotMatch(migration, /REFERENCES rhautt_nexus\.file_artifacts\(id\)/);
  assert.match(migration, /site_document_categories FORCE ROW LEVEL SECURITY/);
  assert.match(migration, /site_documents FORCE ROW LEVEL SECURITY/);
  assert.doesNotMatch(migration, /everhot|installation-manual|product-catalog/i);
});
