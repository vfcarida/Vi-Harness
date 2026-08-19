import assert from 'node:assert';
import * as fs from 'node:fs';

const routerFile = fs.existsSync('./router.js') ? './router.js' : './index.js';
const module = await import(routerFile);
const Router = module.Router || module.default?.Router || module.default;

assert.ok(Router, 'Router export must exist');
const router = new Router();

const hIndex = () => 'index';
const hUser = () => 'user';
const hRepo = () => 'repo';
const hStatic = () => 'static';

router.add('GET', '/', hIndex);
router.add('GET', '/users/:id', hUser);
router.add('POST', '/orgs/:orgId/repos/:repoId', hRepo);
router.add('GET', '/static/*file', hStatic);

// Test 1: Static match
const m1 = router.match('GET', '/');
assert.ok(m1 && m1.handler === hIndex, 'Static root match failed');

// Test 2: Param match
const m2 = router.match('GET', '/users/42');
assert.ok(m2 && m2.handler === hUser, 'User route match failed');
assert.strictEqual(m2.params.id, '42');

// Test 3: Multi param match
const m3 = router.match('POST', '/orgs/facebook/repos/react');
assert.ok(m3 && m3.handler === hRepo, 'Org repo route match failed');
assert.strictEqual(m3.params.orgId, 'facebook');
assert.strictEqual(m3.params.repoId, 'react');

// Test 4: Wildcard match
const m4 = router.match('GET', '/static/assets/styles.css');
assert.ok(m4 && m4.handler === hStatic, 'Wildcard route match failed');
assert.strictEqual(m4.params.file, 'assets/styles.css');

// Test 5: Method mismatch
const m5 = router.match('DELETE', '/');
assert.strictEqual(m5, null, 'Unmatched method should return null');

console.log('ALL HTTP_ROUTING_ENGINE TESTS PASSED (AC)');
