from pathlib import Path

path = Path("park-erp-viewer.user.js")
source = path.read_text(encoding="utf-8")

source = source.replace("// @version      6.3.17", "// @version      6.3.18", 1)
source = source.replace('const CURRENT_VERSION = "6.3.17";', 'const CURRENT_VERSION = "6.3.18";', 1)
source = source.replace('현재 v6.3.17', '현재 v6.3.18', 1)

constants_anchor = '''    const LATEST_SCRIPT_API_URL =
        "https://api.github.com/repos/higwon/park-erp-viewer/contents/park-erp-viewer.user.js?ref=main";
'''
constants_replacement = constants_anchor + '''    const ATTENDANCE_SITE_ORIGIN =
        "https://attendance-tracker.higwon2.workers.dev";
    const ATTENDANCE_IMPORT_URL =
        `${ATTENDANCE_SITE_ORIGIN}/import/erp`;
'''
if constants_anchor not in source:
    raise SystemExit("constants anchor not found")
source = source.replace(constants_anchor, constants_replacement, 1)

state_anchor = '''    let attendanceRecords = [];
    let updateCheckStarted = false;
'''
state_replacement = '''    let attendanceRecords = [];
    let updateCheckStarted = false;
    let attendanceImportWindow = null;
    let pendingAttendanceImportPayload = null;
'''
if state_anchor not in source:
    raise SystemExit("state anchor not found")
source = source.replace(state_anchor, state_replacement, 1)

listener_anchor = '''        window.addEventListener("resize", keepPanelInViewport);

        setInterval(ensureUserInterface, 1500);
'''
listener_replacement = '''        window.addEventListener("resize", keepPanelInViewport);
        window.addEventListener("message", handleAttendanceImportMessage);

        setInterval(ensureUserInterface, 1500);
'''
if listener_anchor not in source:
    raise SystemExit("message listener anchor not found")
source = source.replace(listener_anchor, listener_replacement, 1)

old_footer = '''            <footer class="attendance-viewer-footer">
                <a
                    class="attendance-viewer-footer-link attendance-viewer-personal-link"
                    href="https://attendance-tracker.higwon2.workers.dev/"
                    target="_blank"
                    rel="noopener noreferrer">
                    <span class="attendance-viewer-footer-emoji" aria-hidden="true">😡</span>
                    <span>ERP 갱신 안 돼서 빡치시나요? <strong>개인 근태 기록 사이트</strong> ↗</span>
                </a>

                <span class="attendance-viewer-footer-divider" aria-hidden="true"></span>

                <a
                    class="attendance-viewer-footer-link attendance-viewer-feedback-link"
                    href="https://greasyfork.org/ko/scripts/589938-park-erp-%EA%B7%BC%ED%83%9C-%EB%A7%9E%EC%B6%A4-%EB%B3%B4%EA%B8%B0/feedback#post-discussion"
                    target="_blank"
                    rel="noopener noreferrer">
                    <span class="attendance-viewer-footer-emoji" aria-hidden="true">🪲</span>
                    <span>문제가 있으신가요? <strong>버그 제보</strong> ↗</span>
                </a>
            </footer>'''

new_footer = '''            <footer class="attendance-viewer-footer">
                <button
                    id="attendance-viewer-import-button"
                    class="attendance-viewer-footer-link attendance-viewer-import-button"
                    type="button">
                    <span id="attendance-viewer-import-label"><strong>내 계정에 ERP 기록 가져오기</strong> ↗</span>
                </button>

                <span class="attendance-viewer-footer-divider" aria-hidden="true"></span>

                <a
                    class="attendance-viewer-footer-link attendance-viewer-feedback-link"
                    href="https://greasyfork.org/ko/scripts/589938-park-erp-%EA%B7%BC%ED%83%9C-%EB%A7%9E%EC%B6%A4-%EB%B3%B4%EA%B8%B0/feedback#post-discussion"
                    target="_blank"
                    rel="noopener noreferrer">
                    <span class="attendance-viewer-footer-emoji" aria-hidden="true">🪲</span>
                    <span>문제가 있으신가요? <strong>버그 제보</strong> ↗</span>
                </a>
            </footer>'''
if old_footer not in source:
    raise SystemExit("current footer block not found")
source = source.replace(old_footer, new_footer, 1)

binding_anchor = '''        updateLink?.addEventListener("click", event => {
            event.preventDefault();
            event.stopPropagation();
            window.open(
                updateLink.href,
                "_blank",
                "noopener,noreferrer"
            );
        });

        enablePanelDragging(panel);
'''
binding_replacement = '''        updateLink?.addEventListener("click", event => {
            event.preventDefault();
            event.stopPropagation();
            window.open(
                updateLink.href,
                "_blank",
                "noopener,noreferrer"
            );
        });

        document
            .getElementById("attendance-viewer-import-button")
            ?.addEventListener("click", startAttendanceImport);

        enablePanelDragging(panel);
'''
if binding_anchor not in source:
    raise SystemExit("panel binding anchor not found")
source = source.replace(binding_anchor, binding_replacement, 1)

functions_anchor = '''    function enablePanelDragging(panel) {
'''
functions_block = '''    function startAttendanceImport() {
        const records = attendanceRecords
            .map(createAttendanceImportRecord)
            .filter(Boolean);

        if (records.length === 0) {
            window.alert(
                "가져올 ERP 근태 기록이 없습니다. 먼저 ERP에서 근태 조회를 실행해 주세요."
            );
            return;
        }

        pendingAttendanceImportPayload = {
            version: 1,
            source: "park-erp",
            exportedAt: new Date().toISOString(),
            records
        };

        setAttendanceImportStatus("웹 로그인 및 연결을 기다리는 중...");

        attendanceImportWindow = window.open(
            ATTENDANCE_IMPORT_URL,
            "attendance-erp-import",
            "width=760,height=820"
        );

        if (!attendanceImportWindow) {
            pendingAttendanceImportPayload = null;
            setAttendanceImportStatus("팝업이 차단되었습니다. 다시 시도해 주세요.", true);
            window.alert(
                "ERP 근태 가져오기 창이 차단되었습니다. 브라우저에서 팝업을 허용해 주세요."
            );
        }
    }

    function handleAttendanceImportMessage(event) {
        if (
            event.origin !== ATTENDANCE_SITE_ORIGIN ||
            event.source !== attendanceImportWindow
        ) {
            return;
        }

        const message = event.data;

        if (!message || typeof message !== "object") {
            return;
        }

        if (message.type === "ATTENDANCE_IMPORT_READY") {
            if (!pendingAttendanceImportPayload) {
                return;
            }

            attendanceImportWindow.postMessage(
                {
                    type: "ATTENDANCE_IMPORT_DATA",
                    payload: pendingAttendanceImportPayload
                },
                ATTENDANCE_SITE_ORIGIN
            );
            setAttendanceImportStatus(
                `ERP 기록 ${pendingAttendanceImportPayload.records.length}건 전달 중...`
            );
            return;
        }

        if (message.type === "ATTENDANCE_IMPORT_RECEIVED") {
            setAttendanceImportStatus(
                "웹사이트에서 저장 내용을 확인해 주세요."
            );
            return;
        }

        if (message.type === "ATTENDANCE_IMPORT_COMPLETED") {
            const created = Number(message.created) || 0;
            const updated = Number(message.updated) || 0;
            const unchanged = Number(message.unchanged) || 0;
            const conflicts = Number(message.conflicts) || 0;

            setAttendanceImportStatus(
                `저장 완료 · 신규 ${created} · 수정 ${updated} · 동일 ${unchanged} · 충돌 ${conflicts}`
            );
            pendingAttendanceImportPayload = null;
            return;
        }

        if (message.type === "ATTENDANCE_IMPORT_ERROR") {
            const text = String(
                message.message ||
                "ERP 근태 기록을 가져오지 못했습니다."
            );
            setAttendanceImportStatus(text, true);
            window.alert(text);
        }
    }

    function createAttendanceImportRecord(record) {
        const parsedDate = parseErpDate(record.workDate);

        if (!parsedDate) {
            return null;
        }

        const hasCheckTime = Boolean(
            record.checkInTime ||
            record.checkOutTime
        );

        let workType = "work";

        if (record.isHoliday) {
            workType = "holiday";
        } else if (
            record.isFullPaidLeave &&
            !hasCheckTime
        ) {
            workType = "annual";
        } else if (record.isHalfDay) {
            workType = "half";
        }

        return {
            workDate: formatDateKey(parsedDate),
            checkInTime: record.checkInTime || null,
            checkOutTime: record.checkOutTime || null,
            workType,
            paidWorkHours: Math.max(
                0,
                Number(record.paidWorkMinutes || 0) / 60
            ),
            workItemName: record.workItem || null,
            statusName: record.status || null,
            dayTypeName: record.dayType || null,
            isHoliday: Boolean(record.isHoliday)
        };
    }

    function setAttendanceImportStatus(text, isError = false) {
        const label = document.getElementById(
            "attendance-viewer-import-label"
        );
        const button = document.getElementById(
            "attendance-viewer-import-button"
        );

        if (label) {
            label.textContent = text;
        }

        if (button) {
            button.classList.toggle("is-error", isError);
        }
    }

'''
if functions_anchor not in source:
    raise SystemExit("function insertion anchor not found")
source = source.replace(functions_anchor, functions_block + functions_anchor, 1)

css_anchor = '''            .attendance-viewer-footer-link {
                display: inline-flex;
                align-items: center;
                gap: 7px;
                flex: 0 0 auto;
                color: #66726c;
                font-size: 12px;
                text-decoration: none;
            }
'''
css_replacement = css_anchor + '''

            .attendance-viewer-import-button {
                border: 0;
                padding: 0;
                background: transparent;
                font-family: inherit;
                cursor: pointer;
            }

            .attendance-viewer-import-button.is-error,
            .attendance-viewer-import-button.is-error strong {
                color: #b42318;
            }
'''
if css_anchor not in source:
    raise SystemExit("footer link css anchor not found")
source = source.replace(css_anchor, css_replacement, 1)

path.write_text(source, encoding="utf-8")
