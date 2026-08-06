from pathlib import Path

path = Path('park-erp-viewer.user.js')
text = path.read_text(encoding='utf-8')

text = text.replace('// @version      6.3.10', '// @version      6.3.11', 1)
text = text.replace('const CURRENT_VERSION = "6.3.10";', 'const CURRENT_VERSION = "6.3.11";', 1)
text = text.replace(
    '<span class="attendance-viewer-version">v6.3.10</span>',
    '<span class="attendance-viewer-version">현재 v6.3.11</span>',
    1,
)
text = text.replace(
    'updateLink.textContent = `업데이트 v${latestVersion}`;',
    'updateLink.innerHTML = `새 버전 v${latestVersion} 설치하기 <span aria-hidden="true">↗</span>`;',
    1,
)

old = '''        document
            .getElementById("attendance-viewer-close")
            ?.addEventListener("click", () => {
                panel.classList.remove("is-open");
            });

        enablePanelDragging(panel);
'''
new = '''        document
            .getElementById("attendance-viewer-close")
            ?.addEventListener("click", () => {
                panel.classList.remove("is-open");
            });

        const updateLink = document.getElementById(
            "attendance-viewer-update-link"
        );

        updateLink?.addEventListener("pointerdown", event => {
            event.stopPropagation();
        });

        updateLink?.addEventListener("click", event => {
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
if old not in text:
    raise SystemExit('panel interaction block not found')
text = text.replace(old, new, 1)

old_css = '''            .attendance-viewer-update-link {
                display: inline-flex;
                align-items: center;
                min-height: 20px;
                padding: 2px 7px;
                border: 1px solid #f1d49a;
                border-radius: 999px;
                background: #fff8e8;
                color: #9a6500;
                font-size: 10px;
                font-weight: 700;
                line-height: 1.3;
                text-decoration: none;
                white-space: nowrap;
            }
'''
new_css = '''            .attendance-viewer-update-link {
                display: inline-flex;
                align-items: center;
                gap: 4px;
                min-height: 24px;
                padding: 3px 9px;
                border: 1px solid #e7b95b;
                border-radius: 7px;
                background: #fff7df;
                color: #8a5700;
                font-size: 11px;
                font-weight: 700;
                line-height: 1.3;
                text-decoration: none;
                white-space: nowrap;
                cursor: pointer;
            }
'''
if old_css not in text:
    raise SystemExit('update link css block not found')
text = text.replace(old_css, new_css, 1)

path.write_text(text, encoding='utf-8')
