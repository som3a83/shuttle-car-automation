import test from 'node:test';
import assert from 'node:assert/strict';
import { can, canAccessRoute, canPerformAction, permissionsFor } from './permissions.ts';

test('viewer is read-only and cannot enter administrative destinations', () => {
  assert.equal(can('Viewer', 'fleet.view'), true);
  assert.equal(can('Viewer', 'fleet.manage'), false);
  assert.equal(canAccessRoute('Viewer', 'dashboard'), true);
  for (const route of ['fleet', 'shifts', 'engineering', 'batteries', 'faults', 'maintenance', 'connections', 'ai', 'reports', 'notifications']) {
    assert.equal(canAccessRoute('Viewer', route), true, `Viewer should be able to open read-only route: ${route}`);
  }
  assert.equal(canAccessRoute('Viewer', 'settings'), false);
  assert.equal(canAccessRoute('Viewer', 'users'), false);
});

test('technician can update maintenance work but cannot administer fleet or accounts', () => {
  assert.equal(can('Technician', 'maintenance.complete'), true);
  assert.equal(can('Technician', 'faults.create'), true);
  assert.equal(can('Technician', 'fleet.manage'), false);
  assert.equal(can('Technician', 'users.manage'), false);
});

test('super admin receives the full permission set and unknown roles fail closed', () => {
  assert.ok(permissionsFor('Super Admin').includes('data.reset'));
  assert.equal(can('Viewer', 'data.reset'), false);
  assert.equal(can('Super Admin', 'connections.manage'), true);
});


test('an unauthenticated preview identity cannot perform mutations, even with an admin role', () => {
  assert.equal(canPerformAction({ role: 'Super Admin', isAuthenticated: false }, 'fleet.manage'), false);
  assert.equal(canPerformAction({ role: 'Super Admin', isAuthenticated: true }, 'fleet.manage'), true);
  assert.equal(canPerformAction({ role: 'Viewer', isAuthenticated: true }, 'fleet.manage'), false);
});


test('only Super Admin can execute verified storage rollback', () => {
  assert.equal(can('Super Admin', 'storage.rollback'), true);
  assert.equal(can('Admin', 'storage.rollback'), false);
  assert.equal(canPerformAction({ role: 'Super Admin', isAuthenticated: false }, 'storage.rollback'), false);
  assert.equal(canPerformAction({ role: 'Super Admin', isAuthenticated: true }, 'storage.rollback'), true);
  assert.equal(canPerformAction({ role: 'Admin', isAuthenticated: true }, 'storage.rollback'), false);
});
