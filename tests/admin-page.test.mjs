import test from 'node:test';
import assert from 'node:assert/strict';
import {ADMIN_HTML,ADMIN_LOGIN_HTML,ADMIN_SCRIPT} from '../worker/admin-page.mjs';
test('dashboard has meaningful filters, report queue, detail view, status form and sign out',()=>{
 for(const id of ['reportSearch','statusFilter','reportQueue','reportCounts','adminStatus'])
  assert.match(ADMIN_HTML,new RegExp('id="'+id+'"'));
 assert.match(ADMIN_HTML,/Review reported references/);
 assert.match(ADMIN_HTML,/not full army lists/i);
 assert.match(ADMIN_HTML,/public on GitHub/i);
 assert.match(ADMIN_HTML,/admin\/logout/);
 assert.match(ADMIN_LOGIN_HTML,/Sign in with GitHub/);
 assert.match(ADMIN_SCRIPT,/\/admin\/api\/reports/);
 assert.match(ADMIN_SCRIPT,/\/admin\/api\/review/);
 assert.match(ADMIN_SCRIPT,/saveReview/);
 assert.match(ADMIN_SCRIPT,/investigating/);
 assert.match(ADMIN_SCRIPT,/fixed/);
 assert.match(ADMIN_SCRIPT,/not-an-issue/);
 assert.doesNotMatch(ADMIN_SCRIPT,/innerHTML\s*=/);
 assert.doesNotMatch(ADMIN_SCRIPT,/localStorage|sessionStorage/);
});
test('static dashboard uses first-party script and no third-party login/client tokens',()=>{
 assert.match(ADMIN_HTML,/src="\/admin\/client\.js"/);
 assert.doesNotMatch(ADMIN_HTML,/https:\/\/[^"]+\.js/);
 assert.doesNotMatch(ADMIN_SCRIPT,/GITHUB_TOKEN|CLIENT_SECRET|ADMIN_SESSION_SECRET/);
 assert.match(ADMIN_SCRIPT,/textContent/);
});
