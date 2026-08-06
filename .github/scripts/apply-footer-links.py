from pathlib import Path

path = Path("park-erp-viewer.user.js")
source = path.read_text(encoding="utf-8")

source = source.replace("// @version      6.3.16", "// @version      6.3.17", 1)
source = source.replace('const CURRENT_VERSION = "6.3.16";', 'const CURRENT_VERSION = "6.3.17";', 1)
source = source.replace('현재 v6.3.16', '현재 v6.3.17', 1)

header_link = '''                    <a
                        class="attendance-viewer-web-link"
                        href="https://attendance-tracker.higwon2.workers.dev/"
                        target="_blank"
                        rel="noopener noreferrer">
                        직접 기록하기 <span aria-hidden="true">↗</span>
                    </a>

'''
if header_link not in source:
    raise SystemExit("header web link block not found")
source = source.replace(header_link, "", 1)

old_footer = '''            <footer class="attendance-viewer-footer">
                <a
                    class="attendance-viewer-feedback-link"
                    href="https://greasyfork.org/ko/scripts/589938-park-erp-%EA%B7%BC%ED%83%9C-%EB%A7%9E%EC%B6%A4-%EB%B3%B4%EA%B8%B0/feedback#post-discussion"
                    target="_blank"
                    rel="noopener noreferrer">
                    <span class="attendance-viewer-feedback-icon" aria-hidden="true">?</span>
                    <span>문제가 있나요? <strong>버그 제보</strong> ↗</span>
                </a>
            </footer>'''

new_footer = '''            <footer class="attendance-viewer-footer">
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
                    href="https://greasyfork.org/ko/scripts/589938-park-erp-%EA%B7%BC%ED%83%9C-%EB%A7%9D%EC%B6%A4-%EB%B3%B4%EA%B8%B0/feedback#post-discussion"
                    target="_blank"
                    rel="noopener noreferrer">
                    <span class="attendance-viewer-footer-emoji" aria-hidden="true">🪲</span>
                    <span>문제가 있으신가요? <strong>버그 제보</strong> ↗</span>
                </a>
            </footer>'''

if old_footer not in source:
    raise SystemExit("footer block not found")
source = source.replace(old_footer, new_footer, 1)

old_css = '''            .attendance-viewer-footer {
                flex: 0 0 auto;
                padding: 12px 20px 14px;
                border-top: 1px solid #e5ebe7;
                background: #ffffff;
            }

            .attendance-viewer-feedback-link {
                display: inline-flex;
                align-items: center;
                gap: 8px;
                color: #66726c;
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
                border-radius: 999px;
                color: #6f7b75;
                font-size: 11px;
                font-weight: 700;
                line-height: 1;
            }'''

new_css = '''            .attendance-viewer-footer {
                display: flex;
                flex: 0 0 auto;
                align-items: center;
                gap: 14px;
                overflow-x: auto;
                padding: 12px 20px 14px;
                border-top: 1px solid #e5ebe7;
                background: #ffffff;
                white-space: nowrap;
            }

            .attendance-viewer-footer-link {
                display: inline-flex;
                align-items: center;
                gap: 7px;
                flex: 0 0 auto;
                color: #66726c;
                font-size: 12px;
                text-decoration: none;
            }

            .attendance-viewer-footer-link:hover {
                color: #17795b;
            }

            .attendance-viewer-footer-link strong {
                color: #17795b;
                font-weight: 700;
            }

            .attendance-viewer-footer-emoji {
                display: inline-flex;
                align-items: center;
                justify-content: center;
                width: 22px;
                height: 22px;
                font-size: 18px;
                line-height: 1;
            }

            .attendance-viewer-footer-divider {
                width: 1px;
                height: 18px;
                flex: 0 0 auto;
                background: #dfe5e2;
            }'''

if old_css not in source:
    raise SystemExit("footer css block not found")
source = source.replace(old_css, new_css, 1)

path.write_text(source, encoding="utf-8")
