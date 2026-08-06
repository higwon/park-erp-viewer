from pathlib import Path

path = Path('park-erp-viewer.user.js')
text = path.read_text(encoding='utf-8')

text = text.replace('// @version      6.3.13', '// @version      6.3.14', 1)
text = text.replace('const CURRENT_VERSION = "6.3.13";', 'const CURRENT_VERSION = "6.3.14";', 1)
text = text.replace(
    '<span class="attendance-viewer-version">현재 v6.3.13</span>',
    '<span class="attendance-viewer-version">현재 v6.3.14</span>',
    1,
)
text = text.replace(
    '''    const LATEST_SCRIPT_URL =
        "https://raw.githubusercontent.com/higwon/park-erp-viewer/main/park-erp-viewer.user.js";
''',
    '''    const LATEST_SCRIPT_API_URL =
        "https://api.github.com/repos/higwon/park-erp-viewer/contents/park-erp-viewer.user.js?ref=main";
''',
    1,
)

old = '''            const response = await fetch(
                `${LATEST_SCRIPT_URL}?timestamp=${Date.now()}`,
                { cache: "no-store" }
            );

            if (!response.ok) {
                return;
            }

            const source = await response.text();
            const latestVersion = source.match(
                /^\\/\\/\\s*@version\\s+([^\\s]+)$/m
            )?.[1];
'''
new = '''            const response = await fetch(
                `${LATEST_SCRIPT_API_URL}&timestamp=${Date.now()}`,
                {
                    cache: "no-store",
                    headers: {
                        Accept: "application/vnd.github+json"
                    }
                }
            );

            if (!response.ok) {
                return;
            }

            const payload = await response.json();
            const encodedContent = String(payload?.content || "")
                .replace(/\\s/g, "");

            if (!encodedContent) {
                return;
            }

            const source = decodeURIComponent(
                Array.from(
                    atob(encodedContent),
                    character =>
                        `%${character.charCodeAt(0)
                            .toString(16)
                            .padStart(2, "0")}`
                ).join("")
            );
            const latestVersion = source.match(
                /^\\/\\/\\s*@version\\s+([^\\s]+)$/m
            )?.[1];

            console.debug(
                "[근태 맞춤 보기] 버전 확인",
                {
                    currentVersion: CURRENT_VERSION,
                    latestVersion
                }
            );
'''
if old not in text:
    raise SystemExit('update fetch block not found')
text = text.replace(old, new, 1)

path.write_text(text, encoding='utf-8')
