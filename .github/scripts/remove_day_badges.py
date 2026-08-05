from pathlib import Path
import re

path = Path("park-erp-viewer.user.js")
text = path.read_text(encoding="utf-8")

text = text.replace("// @version      6.3.5", "// @version      6.3.6", 1)
text = text.replace(
    '<span class="attendance-viewer-version">v6.3.5</span>',
    '<span class="attendance-viewer-version">v6.3.6</span>',
    1,
)

old_subtitle = '''        const todaySubtitle = isWorking
            ? `현재 근무시간 ${formatMinutes(
                summary.todayWorkMinutes
            )} · ${
                summary.canLeaveNow
                    ? "지금 퇴근 가능"
                    : `${summary.availableCheckOutTime}부터 퇴근 가능`
            }`
            : summary.description;
'''
new_subtitle = '''        const todaySubtitle = isWorking
            ? `현재 근무시간 ${formatMinutes(
                summary.todayWorkMinutes
            )}`
            : summary.description;
'''

if old_subtitle not in text:
    raise SystemExit("today subtitle block not found")

text = text.replace(old_subtitle, new_subtitle, 1)

badge_markup = "                    ${createDayBadges(record, todayKey)}\n"
if badge_markup not in text:
    raise SystemExit("day badge markup not found")
text = text.replace(badge_markup, "", 1)

text, helper_count = re.subn(
    r"\n\n    function createDayBadges\(record, todayKey\) \{.*?\n    function createWeekTitle",
    "\n\n    function createWeekTitle",
    text,
    count=1,
    flags=re.S,
)
if helper_count != 1:
    raise SystemExit("day badge helpers not found")

text, css_count = re.subn(
    r"\n            \.attendance-day-badges \{.*?\n            \.attendance-day-badge\.is-vacation,\n            \.attendance-day-badge\.is-holiday \{.*?\n            \}\n",
    "\n",
    text,
    count=1,
    flags=re.S,
)
if css_count != 1:
    raise SystemExit("day badge css not found")

path.write_text(text, encoding="utf-8")
