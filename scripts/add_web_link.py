from pathlib import Path

path = Path("park-erp-viewer.user.js")
text = path.read_text(encoding="utf-8")

text = text.replace("// @version      6.3.6", "// @version      6.3.7", 1)
text = text.replace("v6.3.6</span>", "v6.3.7</span>", 1)

old = '''                <button
                    id="attendance-viewer-close"
                    type="button"
                    aria-label="닫기">
                    ×
                </button>
'''
new = '''                <div class="attendance-viewer-header-actions">
                    <a
                        class="attendance-viewer-web-link"
                        href="https://attendance-tracker.higwon2.workers.dev/"
                        target="_blank"
                        rel="noopener noreferrer">
                        직접 기록하기 <span aria-hidden="true">↗</span>
                    </a>

                    <button
                        id="attendance-viewer-close"
                        type="button"
                        aria-label="닫기">
                        ×
                    </button>
                </div>
'''

if old not in text:
    raise SystemExit("close button block not found")

text = text.replace(old, new, 1)

marker = "            #attendance-viewer-close {\n"
css = '''            .attendance-viewer-header-actions {
                display: flex;
                align-items: center;
                gap: 8px;
                flex: 0 0 auto;
            }

            .attendance-viewer-web-link {
                display: inline-flex;
                align-items: center;
                gap: 4px;
                height: 30px;
                padding: 0 10px;
                border: 1px solid #d5e3dc;
                border-radius: 8px;
                background: #f7faf8;
                color: #17795b;
                font-size: 12px;
                font-weight: 700;
                text-decoration: none;
                white-space: nowrap;
            }

            .attendance-viewer-web-link:hover {
                border-color: #b9d5c8;
                background: #eef7f3;
            }

'''

if marker not in text:
    raise SystemExit("close css marker not found")

text = text.replace(marker, css + marker, 1)
path.write_text(text, encoding="utf-8")
