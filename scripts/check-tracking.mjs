import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const read=path=>readFile(new URL(`../${path}`,import.meta.url),'utf8');
const [source,bundle,css,index,bootstrap]=await Promise.all([
  read('assets/app-tracking-tab-v2.js'),
  read('assets/app-core.bundle.js'),
  read('assets/app.bundle.css'),
  read('index.html'),
  read('assets/bootstrap.js')
]);

// Parse the standalone module without executing browser globals.
new Function(source);

assert.match(source,/const pageSize=lowSpec\?12:15;/,'Tracking must keep its low-spec DOM page small');
assert.doesNotMatch(source,/renderLimit|currentLabelSignature/,'Legacy eager-list work should not return');
assert.match(source,/shipmentCache=\{revision:-1,shipments:\[\]\}/,'Shipment aggregation must be revision-cached');
assert.match(source,/if\(lowSpec\|\|active==='tracking'\|\|badgeRefreshId\)return/,'Low-spec startup must defer the tracking scan');
assert.match(source,/trackingPage-1\)\*pageSize/,'Row actions must account for the active page');
assert.ok(bundle.includes(source.trim()),'Core bundle does not contain the current tracking source');

for(const label of ['Shipment','Invoice','Courier','AWB / resi','Source','Status']){
  assert.ok(source.includes(`<th>${label}</th>`),`Missing tracking table column: ${label}`);
}
assert.ok(source.includes('id="trackingPagination"'),'Tracking pagination is missing from the view');
assert.match(css,/\.tracking-table\{[^}]*table-layout:fixed/,'Tracking table layout is not constrained');
assert.match(css,/@media\(max-width:760px\)[\s\S]*\.tracking-row\{display:grid/,'Mobile card fallback is missing');
assert.match(css,/html\.low-spec \.tracking-row\{transition:none!important\}/,'Low-spec row motion must stay disabled');

const indexVersion=index.match(/app\.bundle\.css\?v=([^"']+)/)?.[1];
const bootstrapVersion=bootstrap.match(/const version='([^']+)'/)?.[1];
assert.ok(indexVersion&&bootstrapVersion,'Asset version marker is missing');
assert.equal(indexVersion,bootstrapVersion,'Index and bootstrap cache versions differ');
assert.ok(index.includes(`bootstrap.js?v=${bootstrapVersion}`),'Bootstrap script cache version differs from CSS');
assert.match(bootstrap,/deployment-version\.json\?_=/,'Automatic deployment version check is missing');
assert.match(bootstrap,/location\.replace\(target\.href\)/,'New deployments must force the open app to reload');
assert.match(bootstrap,/setInterval\(checkDeployment,120000\)/,'Deployment polling must remain lightweight');

const accentContract=await readFile(new URL('../assets/style-55.css',import.meta.url),'utf8');
for(const view of ['#createView','#historyView','#trackingView','#analyticsView']){
  assert.ok(accentContract.includes(view),`${view} is missing from the cross-tab accent contract`);
}
for(const token of ['--theme-primary','--theme-accent','--theme-primary-soft','--theme-accent-soft']){
  assert.ok(accentContract.includes(token),`${token} is missing from the cross-tab accent contract`);
}
assert.match(accentContract,/#trackingView \.tracking-status-control\.processing/,'Processing status is not palette-aware');
assert.match(accentContract,/#trackingView \.tracking-status-control\.delivered/,'Delivered status is not palette-aware');

console.log('Tracking performance and responsive contracts passed.');
