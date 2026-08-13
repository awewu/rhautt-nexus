import 'reflect-metadata';
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { IS_PUBLIC_KEY } from '../common/public.decorator';
import { PERMISSIONS_KEY } from '../common/permissions.decorator';
import { SiteDealerController, SiteDealerPublicController } from './site-dealer.controller';

test('site dealer management reuses the official brand library permission domain', () => {
  assert.deepEqual(Reflect.getMetadata(PERMISSIONS_KEY, SiteDealerController.prototype.list), [
    'brand.library.read',
  ]);
  assert.deepEqual(Reflect.getMetadata(PERMISSIONS_KEY, SiteDealerController.prototype.get), [
    'brand.library.read',
  ]);
  assert.deepEqual(Reflect.getMetadata(PERMISSIONS_KEY, SiteDealerController.prototype.create), [
    'brand.library.create',
  ]);
  assert.deepEqual(Reflect.getMetadata(PERMISSIONS_KEY, SiteDealerController.prototype.update), [
    'brand.library.update',
  ]);
  assert.deepEqual(Reflect.getMetadata(PERMISSIONS_KEY, SiteDealerController.prototype.archive), [
    'brand.library.delete',
  ]);
  assert.deepEqual(
    Reflect.getMetadata(PERMISSIONS_KEY, SiteDealerController.prototype.archiveByPost),
    ['brand.library.delete']
  );
  assert.equal(Reflect.getMetadata(IS_PUBLIC_KEY, SiteDealerPublicController), true);
});

test('site dealer migration enforces tenant RLS without instance seed data', () => {
  const migration = fs.readFileSync(
    path.resolve(
      __dirname,
      '../../../../../database/postgres/migrations/090_site_dealer_directory.sql'
    ),
    'utf8'
  );
  assert.match(migration, /site_dealers FORCE ROW LEVEL SECURITY/);
  assert.match(migration, /tenant_id = rhautt_nexus\.current_tenant_id\(\)/);
  assert.doesNotMatch(migration, /everhot|CROSS JOIN seed|INSERT INTO rhautt_nexus\.site_dealers/i);
});
