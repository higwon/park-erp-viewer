from pathlib import Path

path = Path("park-erp-viewer.user.js")
text = path.read_text(encoding="utf-8")

text = text.replace("// @version      6.3.3", "// @version      6.3.4", 1)
text = text.replace("// webhook sync test: 2026-08-05\n", "", 1)
text = text.replace(
    '<span class="attendance-viewer-version">v6.3.3</span>',
    '<span class="attendance-viewer-version">v6.3.4</span>',
    1,
)

old = '''        const todayMetricLabel = isWorking
            ? "현재 근무시간"
            : "오늘 근무시간";

        const readyBadge = summary.canLeaveNow
            ? `<em>지금 퇴근 가능</em>`
            : "";
'''
new = '''        const todaySubtitle = isWorking
            ? `현재 근무시간 ${formatMinutes(
                summary.todayWorkMinutes
            )} · ${
                summary.canLeaveNow
                    ? "지금 퇴근 가능"
                    : `${summary.availableCheckOutTime}부터 퇴근 가능`
            }`
            : summary.description;

        const readyBadge = summary.canLeaveNow
            ? `<em>지금 퇴근 가능</em>`
            : "";
'''
if old not in text:
    raise SystemExit("todayMetricLabel block not found")
text = text.replace(old, new, 1)

old = '''                        <p>
                            ${escapeHtml(summary.description)}
                        </p>
'''
new = '''                        <p class="attendance-today-summary">
                            <span class="attendance-summary-clock" aria-hidden="true">◷</span>
                            ${escapeHtml(todaySubtitle)}
                        </p>
'''
if old not in text:
    raise SystemExit("today description block not found")
text = text.replace(old, new, 1)

old = '''                    ${createTodayCard(
                        todayMetricLabel,
                        formatMinutes(
                            summary.todayWorkMinutes
                        )
                    )}

                    ${createTodayCard(
                        "이번 주 근무시간",
                        formatMinutes(
                            summary.weeklyWorkMinutes
                        )
                    )}

                    ${createTodayCard(
                        "이번 주 초과근무",
                        formatSignedMinutes(
                            summary.weeklyOvertimeMinutes
                        ),
                        getTimeStateClass(
                            summary.weeklyOvertimeMinutes
                        )
                    )}
'''
new = '''                    ${createTodayCard(
                        "이번주 근무시간",
                        formatMinutes(
                            summary.weeklyWorkMinutes
                        ),
                        "",
                        "◷"
                    )}

                    ${createTodayCard(
                        "이번주 초과근무",
                        formatSignedMinutes(
                            summary.weeklyOvertimeMinutes
                        ),
                        getTimeStateClass(
                            summary.weeklyOvertimeMinutes
                        ),
                        "↗"
                    )}

                    ${createTodayCard(
                        "이번주 필요근무",
                        formatMinutes(
                            summary.weeklyRequiredMinutes
                        ),
                        "",
                        "◎"
                    )}
'''
if old not in text:
    raise SystemExit("today card block not found")
text = text.replace(old, new, 1)

old = '''    function createTodayCard(label, value, valueClass = "") {
        return `
            <article class="attendance-today-card">
                <span>${escapeHtml(label)}</span>
                <strong class="${valueClass}">
                    ${escapeHtml(value)}
                </strong>
            </article>
        `;
    }
'''
new = '''    function createTodayCard(
        label,
        value,
        valueClass = "",
        icon = ""
    ) {
        return `
            <article class="attendance-today-card">
                <div class="attendance-card-heading">
                    <span class="attendance-card-icon" aria-hidden="true">
                        ${escapeHtml(icon)}
                    </span>
                    <span>${escapeHtml(label)}</span>
                </div>
                <strong class="${valueClass}">
                    ${escapeHtml(value)}
                </strong>
            </article>
        `;
    }
'''
if old not in text:
    raise SystemExit("createTodayCard block not found")
text = text.replace(old, new, 1)

marker = """            @media (max-width: 900px) {
"""
css = """            /* Dashboard-style today summary */
            .attendance-today {
                padding: 24px;
                border-color: #dfe8e3;
                border-radius: 20px;
                box-shadow: 0 8px 24px rgba(24, 45, 36, 0.06);
            }

            .attendance-today-title {
                align-items: center;
                margin-bottom: 20px;
            }

            .attendance-today-eyebrow {
                margin-bottom: 7px;
                font-size: 12px;
            }

            .attendance-today-title strong {
                font-size: 27px;
                line-height: 1.25;
                letter-spacing: -0.035em;
            }

            .attendance-today-summary {
                display: flex;
                align-items: center;
                gap: 7px;
                margin-top: 8px !important;
                color: #68766f !important;
                font-size: 13px !important;
                line-height: 1.45;
            }

            .attendance-summary-clock {
                display: inline-flex;
                align-items: center;
                justify-content: center;
                width: 18px;
                height: 18px;
                color: #7b8982;
                font-size: 16px;
            }

            .attendance-today-badge {
                display: inline-flex;
                align-items: center;
                gap: 7px;
                padding: 8px 13px;
                border: 1px solid rgba(23, 121, 91, 0.12);
                font-size: 13px;
            }

            .attendance-today-badge.is-working::before {
                width: 7px;
                height: 7px;
                border-radius: 50%;
                background: currentColor;
                content: "";
            }

            .attendance-today-cards {
                gap: 14px;
            }

            .attendance-today-card {
                min-height: 104px;
                padding: 16px;
                border-color: #dfe6e2;
                border-radius: 15px;
                background: #ffffff;
                box-shadow: 0 3px 12px rgba(24, 45, 36, 0.035);
            }

            .attendance-card-heading {
                display: flex;
                align-items: center;
                gap: 9px;
                margin-bottom: 12px;
            }

            .attendance-card-heading > span {
                margin: 0;
            }

            .attendance-card-icon {
                display: inline-flex !important;
                align-items: center;
                justify-content: center;
                width: 30px;
                height: 30px;
                flex: 0 0 30px;
                border-radius: 50%;
                background: #eef7f3;
                color: #18815f !important;
                font-size: 17px !important;
                font-weight: 700;
            }

            .attendance-today-card strong {
                font-size: 19px;
                letter-spacing: -0.025em;
            }

            .attendance-departure-card {
                min-height: 104px;
                padding-top: 18px;
            }

            .attendance-departure-heading {
                margin-bottom: 13px;
            }

            .attendance-departure-heading > span::before {
                display: inline-flex;
                align-items: center;
                justify-content: center;
                width: 30px;
                height: 30px;
                margin-right: 9px;
                border-radius: 50%;
                background: #f2efff;
                color: #6f56c8;
                content: "◷";
                font-size: 17px;
                font-weight: 700;
                vertical-align: middle;
            }

            .attendance-departure-value {
                margin-top: 0;
            }

            .attendance-departure-value strong {
                font-size: 19px;
            }

"""
if marker not in text:
    raise SystemExit("CSS media marker not found")
text = text.replace(marker, css + marker, 1)

path.write_text(text, encoding="utf-8")
