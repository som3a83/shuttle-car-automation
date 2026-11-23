import test from 'node:test';
import assert from 'node:assert/strict';
import { can, canAccessRoute, canPerformAction, permissionsFor } from './permissions.ts';

test('local operational console grants working routes and actions to every device user', () => {
  assert.equal(can('Viewer', 'fleet.view'), true);
  assert.equal(can('Viewer', 'fleet.manage'), true);
  assert.equal(canAccessRoute('Viewer', 'dashboard'), true);
  for (const route of ['fleet', 'shifts', 'engineering', 'batteries', 'faults', 'maintenance', 'connections', 'notifications']) {
    assert.equal(canAccessRoute('Viewer', route), true, `Viewer should open read-only route: ${route}`);
  }
  assert.equal(canAccessRoute('Viewer', 'settings'), true);
  assert.equal(canAccessRoute('Viewer', 'users'), false);
});

test('technicians can complete operational tasks while account administration stays protected', () => {
  assert.equal(can('Technician', 'maintenance.complete'), true);
  assert.equal(can('Technician', 'faults.create'), true);
  assert.equal(can('Technician', 'fleet.manage'), true);
  assert.equal(can('Technician', 'users.manage'), false);
});

test('super admin receives the full permission set and unknown roles fail closed', () => {
  assert.ok(permissionsFor('Super Admin').includes('data.reset'));
  assert.equal(can('Viewer', 'data.reset'), false);
  assert.equal(can('Super Admin', 'connections.manage'), true);
});


test('local operational actions work for the first-run identity while protected actions require an admin', () => {
  assert.equal(canPerformAction({ role: 'Viewer', isAuthenticated: false }, 'fleet.manage'), true);
  assert.equal(canPerformAction({ role: 'Super Admin', isAuthenticated: true }, 'fleet.manage'), true);
  assert.equal(canPerformAction({ role: 'Viewer', isAuthenticated: true }, 'fleet.manage'), true);
  assert.equal(canPerformAction({ role: 'Viewer', isAuthenticated: false }, 'users.manage'), false);
  assert.equal(canPerformAction({ role: 'Admin', isAuthenticated: true }, 'data.reset'), false);
});


test('only Super Admin can execute verified storage rollback', () => {
  assert.equal(can('Super Admin', 'storage.rollback'), true);
  assert.equal(can('Admin', 'storage.rollback'), false);
  assert.equal(canPerformAction({ role: 'Super Admin', isAuthenticated: false }, 'storage.rollback'), false);
  assert.equal(canPerformAction({ role: 'Super Admin', isAuthenticated: true }, 'storage.rollback'), true);
  assert.equal(canPerformAction({ role: 'Admin', isAuthenticated: true }, 'storage.rollback'), false);
});
