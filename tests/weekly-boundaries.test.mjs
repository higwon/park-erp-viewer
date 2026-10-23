import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const source = readFileSync(new URL('../park-erp-viewer.user.js', import.meta.url), 'utf8');
function scenario(end, worked = 480) {
    const code = source.replace('    injectApiInterceptor();', '')
        .replace('    if (window === window.top) {', '    if (false) {');
    const probe = `
        getSeoulNow = () => new Date(2026, 9, 21, 12);
        attendanceQueryRange = {startDate:'20261019',endDate:'${end}'};
        const records = ['20261019','20261020'].map(workDate => ({
            workDate,checkInTime:'09:00',checkOutTime:'18:00',paidWorkMinutes:0
        }));
        getEffectiveWorkMinutes = () => ${worked};
        globalThis.result = calculateTodaySummary(records);
    `;
    const context = {window:{}, console};
    vm.runInNewContext(code.replace(/\}\)\(\);\s*$/, probe + '\n})();'), context);
    return context.result;
}
test('Wednesday ending partial query is not a last working day', () => {
    const result = scenario('20261021');
    assert.equal(result.lastWorkDate, null);
    assert.equal(result.requiredTodayMinutes, 480);
});
test('full week keeps Friday as last working day', () => {
    assert.equal(scenario('20261023').lastWorkDate, '20261023');
});
