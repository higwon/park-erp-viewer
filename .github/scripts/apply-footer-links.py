from pathlib import Path
import re

path = Path("park-erp-viewer.user.js")
source = path.read_text(encoding="utf-8")

source = source.replace("// @version      6.3.18", "// @version      6.3.19", 1)
source = source.replace('const CURRENT_VERSION = "6.3.18";', 'const CURRENT_VERSION = "6.3.19";', 1)
source = source.replace('현재 v6.3.18', '현재 v6.3.19', 1)

pattern = re.compile(
    r"    function createAttendanceImportRecord\(record\) \{.*?\n    \}\n\n"
    r"    function setAttendanceImportStatus",
    re.DOTALL,
)

replacement = '''    function createAttendanceImportRecord(record) {
        const parsedDate = parseErpDate(record.workDate);

        if (!parsedDate) {
            return null;
        }

        const checkInTime = normalizeImportTime(record.checkInTime);
        const checkOutTime = normalizeImportTime(record.checkOutTime);
        const hasCheckTime = Boolean(checkInTime || checkOutTime);
        const paidMinutes = Number(record.paidWorkMinutes);
        const paidWorkHours = Number.isFinite(paidMinutes)
            ? Math.min(8, Math.max(0, paidMinutes / 60))
            : 0;

        let workType = "work";
        let isHoliday = false;

        if (record.isHoliday && !hasCheckTime) {
            workType = "holiday";
            isHoliday = true;
        } else if (record.isFullPaidLeave && !hasCheckTime) {
            workType = "annual";
        } else if (record.isHalfDay) {
            workType = "half";
        }

        const importRecord = {
            workDate: formatDateKey(parsedDate),
            checkInTime,
            checkOutTime,
            workType,
            paidWorkHours,
            workItemName: normalizeImportText(record.workItem, 200),
            statusName: normalizeImportText(record.status, 100),
            dayTypeName: normalizeImportText(record.dayType, 100),
            isHoliday
        };

        console.debug("[근태 맞춤 보기] ERP 가져오기 레코드", importRecord);
        return importRecord;
    }

    function normalizeImportTime(value) {
        const text = String(value || "").trim();
        return /^(?:[01]\\d|2[0-3]):[0-5]\\d$/.test(text)
            ? text
            : null;
    }

    function normalizeImportText(value, maxLength) {
        const text = String(value || "").trim();
        return text ? text.slice(0, maxLength) : null;
    }

    function setAttendanceImportStatus'''

source, count = pattern.subn(replacement, source, count=1)
if count != 1:
    raise SystemExit("ERP import record function not found")

source = source.replace(
    '        pendingAttendanceImportPayload = {\n',
    '        pendingAttendanceImportPayload = {\n',
    1,
)
source = source.replace(
    '        setAttendanceImportStatus("웹 로그인 및 연결을 기다리는 중...");\n',
    '        console.debug("[근태 맞춤 보기] ERP 가져오기 payload", pendingAttendanceImportPayload);\n\n        setAttendanceImportStatus("웹 로그인 및 연결을 기다리는 중...");\n',
    1,
)

path.write_text(source, encoding="utf-8")
