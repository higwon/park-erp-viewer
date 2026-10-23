import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";

const userscript = readFileSync(
    new URL("../park-erp-viewer.user.js", import.meta.url),
    "utf8"
);

function extractInjectedInterceptor() {
    let injectedSource = "";
    const target = {
        appendChild(node) {
            injectedSource = node.textContent;
        }
    };
    const document = {
        createElement() {
            return { textContent: "", remove() {} };
        },
        documentElement: target,
        head: target,
        body: target
    };
    const window = { top: {} };

    vm.runInNewContext(userscript, {
        document,
        window,
        console,
        setInterval() {}
    });

    assert.ok(injectedSource.includes("readAttendanceGrid"));
    return injectedSource;
}

function runGridCapture({
    dataSource,
    values = [],
    polls = 1,
    useGlobalSpread = true
}) {
    const intervals = [];
    const messages = [];
    const events = [];
    const columns = [
        "WkDate",
        "WeekName",
        "BeginTimeN",
        "EndTimeN",
        "PaidWkCnt"
    ];
    const items = columns.map(datafield => ({
        getAttribute(name) {
            return name === "datafield" ? datafield : "DataBlock1";
        }
    }));
    const sheet = {
        getDataSource: () => dataSource,
        getRowCount: () => values.length,
        getColumnCount: () => columns.length,
        getValue: (row, column) => values[row]?.[column]
    };
    const spread = { getActiveSheet: () => sheet };
    const sheetElement = { querySelectorAll: () => items };
    const spreadElement = {};
    const context = {
        console: { log() {}, debug() {} },
        CustomEvent: class {
            constructor(type, options) {
                this.type = type;
                this.detail = options.detail;
            }
        },
        XMLHttpRequest: function XMLHttpRequest() {},
        document: {
            getElementById(id) {
                return {
                    datWkFrDate_dat: { value: "2026-10-01" },
                    datWkToDate_dat: { value: "2026-10-23" }
                }[id];
            },
            querySelector(selector) {
                if (selector === "#SS1") return sheetElement;
                if (selector === "#SS1_c") return spreadElement;
                return null;
            }
        },
        setInterval(callback) {
            intervals.push(callback);
        },
        addEventListener() {},
        dispatchEvent(event) {
            events.push(event);
        },
        location: { origin: "https://erp.parksystems.com" },
        jQuery() {
            return {
                data(name) {
                    return name === "spread" ? spread : undefined;
                }
            };
        }
    };
    context.XMLHttpRequest.prototype = {
        open() {},
        send() {},
        addEventListener() {}
    };
    context.window = context;
    if (useGlobalSpread) {
        context.Spread = spread;
    }
    context.top = {
        postMessage(message, origin) {
            messages.push({ message, origin });
        }
    };

    vm.runInNewContext(extractInjectedInterceptor(), context);
    assert.equal(intervals.length, 1);
    for (let index = 0; index < polls; index++) {
        intervals[0]();
    }

    return { events, messages, columns };
}

test("SpreadJS object data source is published as an attendance table", () => {
    const result = runGridCapture({
        dataSource: [
            {
                WkDate: "2026-10-22",
                WeekName: "목",
                BeginTimeN: "09:46",
                EndTimeN: "20:02",
                PaidWkCnt: 0
            },
            { WkDate: "", WeekName: "합계" }
        ]
    });

    assert.equal(result.events.length, 1);
    assert.equal(result.messages.length, 1);
    assert.equal(result.messages[0].origin, "https://erp.parksystems.com");
    assert.deepEqual(
        JSON.parse(JSON.stringify(
            result.messages[0].message.detail.response.Tables[0]
        )),
        {
            Columns: result.columns,
            Rows: [["2026-10-22", "목", "09:46", "20:02", 0]]
        }
    );
    assert.deepEqual(
        JSON.parse(JSON.stringify(
            result.messages[0].message.detail.queryRange
        )),
        { startDate: "2026-10-01", endDate: "2026-10-23" }
    );
});

test("SpreadJS cell fallback ignores blank rows and publishes dated rows", () => {
    const result = runGridCapture({
        dataSource: null,
        values: [
            ["2026-10-21", "수", null, null, 8],
            ["", "합계", null, null, 8]
        ]
    });

    assert.deepEqual(
        JSON.parse(JSON.stringify(
            result.events[0].detail.response.Tables[0].Rows
        )),
        [["2026-10-21", "수", null, null, 8]]
    );
});

test("legacy jQuery spread instance remains supported", () => {
    const result = runGridCapture({
        dataSource: [{ WkDate: "2026-10-19", WeekName: "월" }],
        useGlobalSpread: false
    });

    assert.equal(result.events.length, 1);
    assert.equal(
        result.events[0].detail.response.Tables[0].Rows[0][0],
        "2026-10-19"
    );
});

test("unchanged grid data is emitted only once", () => {
    const result = runGridCapture({
        dataSource: [{ WkDate: "2026-10-20", WeekName: "화" }],
        polls: 2
    });

    assert.equal(result.events.length, 1);
    assert.equal(result.messages.length, 1);
});
