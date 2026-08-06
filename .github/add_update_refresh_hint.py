from pathlib import Path

path = Path('park-erp-viewer.user.js')
text = path.read_text(encoding='utf-8')

text = text.replace('// @version      6.3.14', '// @version      6.3.15', 1)
text = text.replace('const CURRENT_VERSION = "6.3.14";', 'const CURRENT_VERSION = "6.3.15";', 1)
text = text.replace(
    '<span class="attendance-viewer-version">현재 v6.3.14</span>',
    '<span class="attendance-viewer-version">현재 v6.3.15</span>',
    1,
)

text = text.replace(
    '            updateLink.hidden = false;\n',
    '            updateLink.hidden = false;\n\n            const refreshHint = document.getElementById(\n                "attendance-viewer-update-refresh-hint"\n            );\n\n            if (refreshHint) {\n                refreshHint.hidden = false;\n            }\n',
    1,
)

text = text.replace(
    '''                        <a
                            id="attendance-viewer-update-link"
                            class="attendance-viewer-update-link"
                            href="https://greasyfork.org/ko/scripts/589938-park-erp-%EA%B7%BC%ED%83%9C-%EB%A7%9E%EC%B6%A4-%EB%B3%B4%EA%B8%B0"
                            target="_blank"
                            rel="noopener noreferrer"
                            hidden></a>
''',
    '''                        <a
                            id="attendance-viewer-update-link"
                            class="attendance-viewer-update-link"
                            href="https://greasyfork.org/ko/scripts/589938-park-erp-%EA%B7%BC%ED%83%9C-%EB%A7%9E%EC%B6%A4-%EB%B3%B4%EA%B8%B0"
                            target="_blank"
                            rel="noopener noreferrer"
                            hidden></a>
                        <span
                            id="attendance-viewer-update-refresh-hint"
                            class="attendance-viewer-update-refresh-hint"
                            hidden>
                            업데이트 후 새로고침
                        </span>
''',
    1,
)

text = text.replace(
    '''            .attendance-viewer-update-link[hidden] {
                display: none;
            }
''',
    '''            .attendance-viewer-update-link[hidden],
            .attendance-viewer-update-refresh-hint[hidden] {
                display: none;
            }

            .attendance-viewer-update-refresh-hint {
                color: #8b938f;
                font-size: 11px;
                font-weight: 600;
                white-space: nowrap;
            }
''',
    1,
)

path.write_text(text, encoding='utf-8')
