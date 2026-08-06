from pathlib import Path

path = Path('park-erp-viewer.user.js')
text = path.read_text(encoding='utf-8')

old_version = '6.3.15'
new_version = '6.3.16'

for old, new in [
    (f'// @version      {old_version}', f'// @version      {new_version}'),
    (f'const CURRENT_VERSION = "{old_version}";', f'const CURRENT_VERSION = "{new_version}";'),
    (f'<span class="attendance-viewer-version">현재 v{old_version}</span>', f'<span class="attendance-viewer-version">현재 v{new_version}</span>'),
]:
    if old not in text:
        raise RuntimeError(f'Missing version marker: {old}')
    text = text.replace(old, new, 1)

function_marker = '    function createTodayStatus(summary) {\n'
if function_marker not in text:
    raise RuntimeError('createTodayStatus not found')
text = text.replace(
    function_marker,
    function_marker + '        const visual = getTodayStatusVisual(summary);\n',
    1
)

old_title_start = '                <div class="attendance-today-title">\n'
old_cards_marker = '                <div class="attendance-today-cards">\n'
start = text.find(old_title_start)
end = text.find(old_cards_marker, start)
if start < 0 or end < 0:
    raise RuntimeError('Today title block not found')

new_hero = '''                <div class="attendance-today-hero">
                    <div class="attendance-today-hero-left">
                        <div class="attendance-today-status-icon ${visual.iconClass}">
                            ${createTodayStatusIcon(visual.kind)}
                        </div>

                        <div class="attendance-today-hero-text">
                            <strong>
                                ${escapeHtml(summary.title)}
                            </strong>

                            <p>
                                ${escapeHtml(summary.description)}
                            </p>
                        </div>
                    </div>

                    <span class="attendance-today-badge ${summary.badgeClass}">
                        ${escapeHtml(summary.badge)}
                    </span>
                </div>

'''
text = text[:start] + new_hero + text[end:]

helper_marker = '    function createTodayStatus(summary) {\n'
helpers = '''    function getTodayStatusVisual(summary) {
        const badgeClass = String(summary.badgeClass || "is-muted");

        if (badgeClass.includes("is-working")) {
            return {
                kind: "working",
                iconClass: "is-working"
            };
        }

        if (badgeClass.includes("is-complete")) {
            return {
                kind: "complete",
                iconClass: "is-complete"
            };
        }

        if (badgeClass.includes("is-vacation")) {
            return {
                kind: "vacation",
                iconClass: "is-vacation"
            };
        }

        if (badgeClass.includes("is-holiday")) {
            return {
                kind: "holiday",
                iconClass: "is-holiday"
            };
        }

        return {
            kind: "unregistered",
            iconClass: "is-muted"
        };
    }

    function createTodayStatusIcon(kind) {
        if (kind === "working" || kind === "complete") {
            return `
                <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M9 4.5h6a1 1 0 0 1 1 1V7h2.5A2.5 2.5 0 0 1 21 9.5v8A2.5 2.5 0 0 1 18.5 20h-13A2.5 2.5 0 0 1 3 17.5v-8A2.5 2.5 0 0 1 5.5 7H8V5.5a1 1 0 0 1 1-1Zm1 2V7h4V6.5h-4ZM5 11v6.5c0 .3.2.5.5.5h13a.5.5 0 0 0 .5-.5V11h-5.2a1.8 1.8 0 0 1-3.6 0H5Z" />
                </svg>
            `;
        }

        if (kind === "vacation") {
            return `
                <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M7 4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8.8a2 2 0 0 0-.6-1.4l-2.8-2.8A2 2 0 0 0 14.2 4H7Zm7 1.5V8h2.5L14 5.5ZM8 12h8v1.5H8V12Zm0 3h6v1.5H8V15Z" />
                </svg>
            `;
        }

        if (kind === "holiday") {
            return `
                <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M7 3h1.5v2H15V3h1.5v2H18a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h1V3ZM5.5 9v9c0 .3.2.5.5.5h12a.5.5 0 0 0 .5-.5V9h-13ZM8 11h3v3H8v-3Z" />
                </svg>
            `;
        }

        return `
            <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M12 3a9 9 0 1 1 0 18a9 9 0 0 1 0-18Zm0 4a1 1 0 0 0-1 1v5c0 .3.1.5.3.7l3 3 1.4-1.4-2.7-2.7V8a1 1 0 0 0-1-1Z" />
            </svg>
        `;
    }

'''
text = text.replace(helper_marker, helpers + helper_marker, 1)

main_close = '''            </main>
        `;
'''
footer = '''            </main>

            <footer class="attendance-viewer-footer">
                <a
                    class="attendance-viewer-feedback-link"
                    href="https://greasyfork.org/ko/scripts/589938-park-erp-%EA%B7%BC%ED%83%9C-%EB%A7%9E%EC%B6%A4-%EB%B3%B4%EA%B8%B0/feedback#post-discussion"
                    target="_blank"
                    rel="noopener noreferrer">
                    <span class="attendance-viewer-feedback-icon" aria-hidden="true">?</span>
                    <span>문제가 있나요? <strong>버그 제보</strong> ↗</span>
                </a>
            </footer>
        `;
'''
if main_close not in text:
    raise RuntimeError('Panel main closing marker not found')
text = text.replace(main_close, footer, 1)

css_marker = '''            .attendance-today-cards {
'''
css = '''            .attendance-today-hero {
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 18px;
                margin-bottom: 16px;
                padding: 14px 16px;
                border: 1px solid #e3e9e6;
                border-radius: 16px;
                background: #ffffff;
            }

            .attendance-today-hero-left {
                display: flex;
                align-items: center;
                gap: 14px;
                min-width: 0;
            }

            .attendance-today-status-icon {
                display: inline-flex;
                align-items: center;
                justify-content: center;
                flex: 0 0 auto;
                width: 58px;
                height: 58px;
                border-radius: 50%;
            }

            .attendance-today-status-icon svg {
                width: 29px;
                height: 29px;
                fill: currentColor;
            }

            .attendance-today-status-icon.is-working {
                background: #e8f7f1;
                color: #17795b;
            }

            .attendance-today-status-icon.is-complete {
                background: #edf2ff;
                color: #4666ad;
            }

            .attendance-today-status-icon.is-vacation {
                background: #fff7e6;
                color: #ad7a14;
            }

            .attendance-today-status-icon.is-holiday {
                background: #fff4da;
                color: #9a6a10;
            }

            .attendance-today-status-icon.is-muted {
                background: #eef1ef;
                color: #717c77;
            }

            .attendance-today-hero-text {
                min-width: 0;
            }

            .attendance-today-hero-text strong {
                display: block;
                color: #17201c;
                font-size: 22px;
                line-height: 1.25;
            }

            .attendance-today-hero-text p {
                margin: 6px 0 0;
                color: #707b76;
                font-size: 13px;
                line-height: 1.45;
            }

            .attendance-today-badge {
                display: inline-flex;
                align-items: center;
                gap: 7px;
            }

            .attendance-today-badge::before {
                width: 7px;
                height: 7px;
                border-radius: 50%;
                background: currentColor;
                content: "";
            }

            .attendance-viewer-footer {
                flex: 0 0 auto;
                padding: 13px 22px 15px;
                border-top: 1px solid #e1e7e4;
                background: #ffffff;
            }

            .attendance-viewer-feedback-link {
                display: inline-flex;
                align-items: center;
                gap: 8px;
                color: #68756f;
                font-size: 12px;
                text-decoration: none;
            }

            .attendance-viewer-feedback-link:hover {
                color: #17795b;
            }

            .attendance-viewer-feedback-link strong {
                color: #17795b;
                font-weight: 700;
            }

            .attendance-viewer-feedback-icon {
                display: inline-flex;
                align-items: center;
                justify-content: center;
                width: 20px;
                height: 20px;
                border: 1px solid #cbd5d0;
                border-radius: 50%;
                color: #6d7973;
                font-size: 11px;
                font-weight: 700;
            }

'''
if css_marker not in text:
    raise RuntimeError('CSS insertion marker not found')
text = text.replace(css_marker, css + css_marker, 1)

path.write_text(text, encoding='utf-8')
