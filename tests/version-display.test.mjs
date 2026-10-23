import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(
    new URL("../park-erp-viewer.user.js", import.meta.url),
    "utf8"
);

test("metadata and runtime version constants stay identical", () => {
    const metadataVersion = source.match(
        /^\/\/\s*@version\s+([^\s]+)$/m
    )?.[1];
    const runtimeVersion = source.match(
        /const CURRENT_VERSION = "([^"]+)";/
    )?.[1];

    assert.ok(metadataVersion);
    assert.equal(runtimeVersion, metadataVersion);
});

test("panel displays the runtime version instead of a hardcoded value", () => {
    assert.match(
        source,
        /attendance-viewer-version">현재 v\$\{CURRENT_VERSION\}<\/span>/
    );
    assert.doesNotMatch(
        source,
        /attendance-viewer-version">현재 v\d+\.\d+\.\d+<\/span>/
    );
});
