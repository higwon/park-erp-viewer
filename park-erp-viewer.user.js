// ==UserScript==
// @name         Park ERP 근태 맞춤 보기
// @namespace    attendance-viewer
// @version      6.3.12
// @description  Park ERP 근무내역을 실시간 오늘 상태와 주차별 요약으로 표시합니다.
// @match        *://erp.parksystems.com/*
// @run-at       document-start
// @grant        none
// ==/UserScript==

(function () {
    "use strict";

    const TARGET_SERVICE_SEQ = 72220098;
    const EVENT_NAME = "ERP_ATTENDANCE_DATA_RECEIVED";
    const BUTTON_ID = "attendance-viewer-button";
    const PANEL_ID = "attendance-viewer-panel";
    const STYLE_ID = "attendance-viewer-style";
    const CURRENT_VERSION = "6.3.12";
    const LATEST_SCRIPT_URL =
        "https://raw.githubusercontent.com/higwon/park-erp-viewer/main/park-erp-viewer.user.js";

    const STANDARD_WORK_MINUTES = 8 * 60;
    const DEFAULT_BREAK_MINUTES = 60;

    let attendanceRecords = [];
    let updateCheckStarted = false;

    injectApiInterceptor();
    initializeUserInterface();

    function injectApiInterceptor() {
        const script = document.createElement("script");

        script.textContent = `
            (() => {
                const TARGET_SERVICE_SEQ = ${TARGET_SERVICE_SEQ};
                const EVENT_NAME = "${EVENT_NAME}";

                if (window.__attendanceViewerInterceptorInstalled) {
                    return;
                }

                window.__attendanceViewerInterceptorInstalled = true;

                const originalOpen = XMLHttpRequest.prototype.open;
                const originalSend = XMLHttpRequest.prototype.send;

                XMLHttpRequest.prototype.open = function(method, url, ...args) {
                    this.__attendanceViewerUrl = String(url ?? "");
                    return originalOpen.call(this, method, url, ...args);
                };

                XMLHttpRequest.prototype.send = function(body) {
                    this.__attendanceViewerRequestBody = body;

                    this.addEventListener("load", function() {
                        try {
                            if (!this.__attendanceViewerUrl.includes("/api/WebApi")) {
                                return;
                            }

                            const request = parseRepeatedJson(
                                this.__attendanceViewerRequestBody
                            );

                            if (Number(request?.ServiceSeq) !== TARGET_SERVICE_SEQ) {
                                return;
                            }

                            const response = parseRepeatedJson(this.responseText);

                            window.dispatchEvent(
                                new CustomEvent(EVENT_NAME, {
                                    detail: { request, response }
                                })
                            );
                        } catch (error) {
                            console.error("[근태 맞춤 보기] 응답 감지 실패", error);
                        }
                    });

                    return originalSend.call(this, body);
                };

                function parseRepeatedJson(value) {
                    let result = value;

                    for (let index = 0; index < 4; index++) {
                        if (typeof result !== "string") {
                            break;
                        }

                        const trimmed = result.trim();

                        if (!trimmed) {
                            break;
                        }

                        result = JSON.parse(trimmed);
                    }

                    return result;
                }

                console.log("[근태 맞춤 보기] 감지기 설치 완료");
            })();
        `;

        const target =
            document.documentElement ||
            document.head ||
            document.body;

        target.appendChild(script);
        script.remove();
    }

    function initializeUserInterface() {
        window.addEventListener(EVENT_NAME, event => {
            try {
                attendanceRecords = extractAttendanceRecords(
                    event.detail?.response
                );

                ensureUserInterface();
                updateButton();
                renderPanel();
            } catch (error) {
                console.error("[근태 맞춤 보기] 데이터 변환 실패", error);
            }
        });

        document.addEventListener("DOMContentLoaded", ensureUserInterface);
        window.addEventListener("load", ensureUserInterface);
        window.addEventListener("resize", keepPanelInViewport);

        setInterval(ensureUserInterface, 1500);

        // 현재 시각, 퇴근 가능 상태를 ERP 재조회 없이 실시간 갱신합니다.
        setInterval(() => {
            updateLiveTodayStatus();
            updateLiveWeekStatus();
        }, 1000);
    }

    function ensureUserInterface() {
        createStyles();
        createButton();
        createPanel();
        checkForUpdates();
    }

    async function checkForUpdates() {
        if (updateCheckStarted) {
            return;
        }

        updateCheckStarted = true;

        try {
            const response = await fetch(
                `${LATEST_SCRIPT_URL}?timestamp=${Date.now()}`,
                { cache: "no-store" }
            );

            if (!response.ok) {
                return;
            }

            const source = await response.text();
            const latestVersion = source.match(
                /^\/\/\s*@version\s+([^\s]+)$/m
            )?.[1];

            if (
                !latestVersion ||
                compareVersions(latestVersion, CURRENT_VERSION) <= 0
            ) {
                return;
            }

            const updateLink = document.getElementById(
                "attendance-viewer-update-link"
            );

            if (!updateLink) {
                return;
            }

            updateLink.innerHTML = `새 버전 v${latestVersion} 설치하기 <span aria-hidden="true">↗</span>`;
            updateLink.hidden = false;
        } catch (error) {
            console.debug(
                "[근태 맞춤 보기] 최신 버전 확인 실패",
                error
            );
        }
    }

    function compareVersions(left, right) {
        const leftParts = String(left)
            .split(".")
            .map(part => Number(part) || 0);
        const rightParts = String(right)
            .split(".")
            .map(part => Number(part) || 0);
        const length = Math.max(leftParts.length, rightParts.length);

        for (let index = 0; index < length; index++) {
            const difference =
                (leftParts[index] ?? 0) -
                (rightParts[index] ?? 0);

            if (difference !== 0) {
                return difference;
            }
        }

        return 0;
    }

    function createButton() {
        if (!document.body || document.getElementById(BUTTON_ID)) {
            return;
        }

        const button = document.createElement("button");

        button.id = BUTTON_ID;
        button.type = "button";
        button.textContent = "내 근태 보기";

        button.addEventListener("click", () => {
            document
                .getElementById(PANEL_ID)
                ?.classList.toggle("is-open");
        });

        document.body.appendChild(button);
    }

    function createPanel() {
        if (!document.body || document.getElementById(PANEL_ID)) {
            return;
        }

        const panel = document.createElement("section");

        panel.id = PANEL_ID;
        panel.innerHTML = `
            <header class="attendance-viewer-header">
                <div class="attendance-viewer-heading">
                    <div class="attendance-viewer-title-row">
                        <strong>내 출퇴근 기록</strong>
                        <span class="attendance-viewer-version">현재 v6.3.12</span>
                        <a
                            id="attendance-viewer-update-link"
                            class="attendance-viewer-update-link"
                            href="https://greasyfork.org/ko/scripts/589938-park-erp-%EA%B7%BC%ED%83%9C-%EB%A7%9E%EC%B6%A4-%EB%B3%B4%EA%B8%B0"
                            target="_blank"
                            rel="noopener noreferrer"
                            hidden></a>
                    </div>
                    <p>ERP 조회 결과를 오늘 상태와 주차별 근무시간으로 정리합니다.</p>
                </div>

                <div class="attendance-viewer-header-actions">
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
            </header>

            <main id="attendance-viewer-content">
                <div class="attendance-viewer-empty">
                    ERP에서 기간을 선택하고 조회를 눌러주세요.
                </div>
            </main>
        `;

        document.body.appendChild(panel);

        document
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
    }

    function enablePanelDragging(panel) {
        const header = panel.querySelector(".attendance-viewer-header");

        if (!header || header.dataset.dragReady === "true") {
            return;
        }

        header.dataset.dragReady = "true";

        let dragging = false;
        let pointerId = null;
        let offsetX = 0;
        let offsetY = 0;

        header.addEventListener("pointerdown", event => {
            if (event.button !== 0) {
                return;
            }

            if (event.target.closest("button, a")) {
                return;
            }

            const rect = panel.getBoundingClientRect();

            dragging = true;
            pointerId = event.pointerId;
            offsetX = event.clientX - rect.left;
            offsetY = event.clientY - rect.top;

            panel.style.setProperty("left", `${rect.left}px`, "important");
            panel.style.setProperty("top", `${rect.top}px`, "important");
            panel.style.setProperty("right", "auto", "important");
            panel.style.setProperty("bottom", "auto", "important");

            header.setPointerCapture(event.pointerId);
            document.body.classList.add("attendance-viewer-dragging");

            event.preventDefault();
        });

        header.addEventListener("pointermove", event => {
            if (!dragging || event.pointerId !== pointerId) {
                return;
            }

            const rect = panel.getBoundingClientRect();
            const maxLeft = Math.max(0, window.innerWidth - rect.width);
            const maxTop = Math.max(0, window.innerHeight - rect.height);

            const left = Math.max(
                0,
                Math.min(event.clientX - offsetX, maxLeft)
            );

            const top = Math.max(
                0,
                Math.min(event.clientY - offsetY, maxTop)
            );

            panel.style.setProperty("left", `${left}px`, "important");
            panel.style.setProperty("top", `${top}px`, "important");
        });

        const stopDragging = event => {
            if (!dragging || event.pointerId !== pointerId) {
                return;
            }

            dragging = false;
            pointerId = null;
            document.body.classList.remove("attendance-viewer-dragging");

            try {
                header.releasePointerCapture(event.pointerId);
            } catch {
                // 이미 해제된 경우 무시
            }
        };

        header.addEventListener("pointerup", stopDragging);
        header.addEventListener("pointercancel", stopDragging);
    }

    function keepPanelInViewport() {
        const panel = document.getElementById(PANEL_ID);

        if (!panel || !panel.classList.contains("is-open")) {
            return;
        }

        const rect = panel.getBoundingClientRect();
        const left = Math.max(
            0,
            Math.min(rect.left, window.innerWidth - rect.width)
        );
        const top = Math.max(
            0,
            Math.min(rect.top, window.innerHeight - rect.height)
        );

        panel.style.setProperty("left", `${left}px`, "important");
        panel.style.setProperty("top", `${top}px`, "important");
        panel.style.setProperty("right", "auto", "important");
        panel.style.setProperty("bottom", "auto", "important");
    }

    function updateButton() {
        const button = document.getElementById(BUTTON_ID);

        if (!button) {
            return;
        }

        const visibleCount = attendanceRecords.filter(
            record => !record.isWeekend
        ).length;

        button.textContent =
            visibleCount > 0
                ? `내 근태 보기 (${visibleCount})`
                : "내 근태 보기";
    }

    function renderPanel() {
        const content = document.getElementById(
            "attendance-viewer-content"
        );

        if (!content) {
            return;
        }

        const visibleRecords = attendanceRecords.filter(
            record => !record.isWeekend
        );

        if (visibleRecords.length === 0) {
            content.innerHTML = `
                <div class="attendance-viewer-empty">
                    표시할 평일 근태 기록이 없습니다.
                </div>
            `;
            return;
        }

        const weeks = groupRecordsByWeek(visibleRecords);
        const todaySummary = calculateTodaySummary(visibleRecords);

        content.innerHTML = `

            <div id="attendance-live-status">
                ${createTodayStatus(todaySummary)}
            </div>

            <div class="attendance-week-list">
                ${weeks.map(createWeekSection).join("")}
            </div>
        `;

        bindWeekToggleEvents();
        bindDepartureInfoEvent();
    }

    function updateLiveTodayStatus() {
        const container = document.getElementById(
            "attendance-live-status"
        );

        if (!container || attendanceRecords.length === 0) {
            return;
        }

        const expanded =
            container.querySelector(".attendance-departure-card")
                ?.classList.contains("is-expanded") ?? false;

        const visibleRecords = attendanceRecords.filter(
            record => !record.isWeekend
        );

        container.innerHTML = createTodayStatus(
            calculateTodaySummary(visibleRecords)
        );

        if (expanded) {
            container
                .querySelector(".attendance-departure-card")
                ?.classList.add("is-expanded");

            container
                .querySelector(".attendance-departure-info")
                ?.setAttribute("aria-expanded", "true");
        }

        bindDepartureInfoEvent();
    }

    function updateLiveWeekStatus() {
        if (attendanceRecords.length === 0) {
            return;
        }

        const now = getSeoulNow();
        const todayKey = formatDateKey(now);
        const weekStart = formatDateKey(getMonday(now));

        const card = document.querySelector(
            `.attendance-week-card[data-week-start="${weekStart}"]`
        );

        if (!card) {
            return;
        }

        const records = attendanceRecords.filter(record => {
            const date = parseErpDate(record.workDate);

            return (
                date &&
                formatDateKey(getMonday(date)) === weekStart &&
                !record.isWeekend
            );
        });

        const summary = calculateWeekSummary(
            records,
            weekStart,
            now
        );

        updateWeekMetric(
            card,
            "work",
            formatMinutes(summary.totalWorkMinutes),
            ""
        );

        updateWeekMetric(
            card,
            "required",
            formatMinutes(summary.requiredWorkMinutes),
            ""
        );

        updateWeekMetric(
            card,
            "overtime",
            formatSignedMinutes(summary.overtimeMinutes),
            getTimeStateClass(summary.overtimeMinutes)
        );

        const todayRecord = records.find(
            record => record.workDate === todayKey
        );

        const row = card.querySelector(
            `.attendance-day-row[data-work-date="${todayKey}"]`
        );

        if (!todayRecord || !row) {
            return;
        }

        const effectiveWorkMinutes =
            getEffectiveWorkMinutes(todayRecord, now);

        const requiredMinutes =
            calculateRequiredMinutes(todayRecord);

        const isActiveToday =
            todayRecord.workDate === todayKey &&
            Boolean(todayRecord.checkInTime) &&
            !todayRecord.checkOutTime &&
            !todayRecord.isHoliday &&
            (
                !todayRecord.isVacation ||
                todayRecord.isHalfDay
            );

        const includedRequiredMinutes =
            isActiveToday
                ? Math.min(
                    effectiveWorkMinutes,
                    requiredMinutes
                )
                : requiredMinutes;

        const overtimeMinutes =
            effectiveWorkMinutes -
            includedRequiredMinutes;

        const workElement = row.querySelector(
            '[data-day-value="work"]'
        );

        const overtimeElement = row.querySelector(
            '[data-day-value="overtime"]'
        );

        if (workElement) {
            workElement.textContent =
                effectiveWorkMinutes > 0
                    ? formatMinutes(effectiveWorkMinutes)
                    : "-";
        }

        if (overtimeElement) {
            const isIncluded =
                isConfirmedRecord(
                    todayRecord,
                    todayKey
                );

            overtimeElement.textContent =
                isIncluded && requiredMinutes > 0
                    ? formatSignedMinutes(overtimeMinutes)
                    : "-";

            overtimeElement.classList.remove(
                "is-positive",
                "is-negative",
                "is-neutral"
            );

            if (isIncluded && requiredMinutes > 0) {
                overtimeElement.classList.add(
                    getTimeStateClass(overtimeMinutes)
                );
            }
        }
    }

    function updateWeekMetric(
        card,
        metric,
        value,
        valueClass
    ) {
        const element = card.querySelector(
            `[data-week-metric="${metric}"] strong`
        );

        if (!element) {
            return;
        }

        element.textContent = value;
        element.classList.remove(
            "is-positive",
            "is-negative",
            "is-neutral"
        );

        if (valueClass) {
            element.classList.add(valueClass);
        }
    }

    function createTodayStatus(summary) {
        const isWorking =
            Boolean(summary.todayRecord?.checkInTime) &&
            !summary.todayRecord?.checkOutTime &&
            !summary.todayRecord?.isHoliday &&
            (
                !summary.todayRecord?.isVacation ||
                summary.todayRecord?.isHalfDay
            );

        const todaySubtitle = isWorking
            ? `현재 근무시간 ${formatMinutes(
                summary.todayWorkMinutes
            )}`
            : summary.description;

        const readyBadge = summary.canLeaveNow
            ? `<em>지금 퇴근 가능</em>`
            : "";

        return `
            <section class="attendance-today">
                <div class="attendance-today-title">
                    <div>
                        <span class="attendance-today-eyebrow">오늘</span>
                        <strong>${escapeHtml(summary.title)}</strong>
                        <p class="attendance-today-summary">
                            ${escapeHtml(todaySubtitle)}
                        </p>
                    </div>

                    <span class="attendance-today-badge ${summary.badgeClass}">
                        ${escapeHtml(summary.badge)}
                    </span>
                </div>

                <div class="attendance-today-cards">
                    ${createTodayCard(
                        "이번주 근무시간",
                        formatMinutes(summary.weeklyWorkMinutes)
                    )}

                    ${createTodayCard(
                        "이번주 초과근무",
                        formatSignedMinutes(summary.weeklyOvertimeMinutes),
                        getTimeStateClass(summary.weeklyOvertimeMinutes)
                    )}

                    ${createTodayCard(
                        "이번주 필요근무",
                        formatMinutes(summary.weeklyRequiredMinutes)
                    )}

                    <article class="attendance-today-card attendance-departure-card ${
                        summary.canLeaveNow ? "is-ready" : ""
                    }">
                        <div class="attendance-departure-heading">
                            <span>퇴근 가능시간</span>
                            <button
                                type="button"
                                class="attendance-departure-info"
                                aria-label="퇴근 가능시간 계산 정보"
                                aria-expanded="false">i</button>
                        </div>

                        <div class="attendance-departure-value">
                            <strong class="${
                                summary.canLeaveNow
                                    ? "is-positive"
                                    : summary.availableCheckOutClass
                            }">
                                ${escapeHtml(summary.availableCheckOutTime)}
                            </strong>
                            ${readyBadge}
                        </div>

                        <div class="attendance-departure-details">
                            <div>
                                ${
                                    summary.todayRecord &&
                                    summary.todayRecord.workDate === summary.lastWorkDate
                                        ? `
                                            <aside class="attendance-departure-guide">
                                                <strong>오늘은 이번 주 마지막 근무일입니다.</strong>
                                                <span>이번 주 남은 필요 근무시간을 적용했습니다.</span>
                                            </aside>
                                            <p><span>이번 주 필요 근무시간</span><b>${formatMinutes(summary.weeklyRequiredMinutes)}</b></p>
                                            <p><span>누적 근무시간</span><b>${formatMinutes(summary.priorWorkMinutes)}<em class="${getTimeStateClass(summary.priorOvertimeMinutes)}">${formatSignedMinutes(summary.priorOvertimeMinutes)}</em></b></p>
                                            <p><span>오늘 필요 근무시간</span><b>${formatMinutes(summary.requiredTodayMinutes)}</b></p>
                                            <p><span>오늘 출근시간</span><b>${summary.todayRecord?.checkInTime ?? "--:--"}</b></p>
                                            <p><span>최종 퇴근 가능시간</span><b>${escapeHtml(summary.availableCheckOutTime)}</b></p>
                                        `
                                        : `
                                            <aside class="attendance-departure-guide">
                                                <strong>오늘은 출근 시간부터 ${formatMinutes(summary.requiredTodayMinutes)} 근무 기준입니다.</strong>
                                            </aside>
                                            <p><span>출근시간</span><b>${summary.todayRecord?.checkInTime ?? "--:--"}</b></p>
                                            <p><span>필요 근무시간</span><b>${formatMinutes(summary.requiredTodayMinutes)}</b></p>
                                            <p><span>퇴근 가능시간</span><b>${escapeHtml(summary.availableCheckOutTime)}</b></p>
                                        `
                                }
                            </div>
                        </div>
                    </article>
                </div>
            </section>
        `;
    }

    function bindDepartureInfoEvent() {
        const button = document.querySelector(
            ".attendance-departure-info"
        );

        const card = button?.closest(
            ".attendance-departure-card"
        );

        if (
            !button ||
            !card ||
            button.dataset.bound === "true"
        ) {
            return;
        }

        button.dataset.bound = "true";

        button.addEventListener("click", event => {
            event.stopPropagation();

            const expanded = card.classList.toggle(
                "is-expanded"
            );

            button.setAttribute(
                "aria-expanded",
                String(expanded)
            );
        });

        card
            .querySelector(".attendance-departure-details")
            ?.addEventListener("click", event => {
                event.stopPropagation();
            });

        document.addEventListener("click", () => {
            if (!card.classList.contains("is-expanded")) {
                return;
            }

            card.classList.remove("is-expanded");

            button.setAttribute(
                "aria-expanded",
                "false"
            );
        });
    }

    function createTodayCard(
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

    function createWeekSection(week) {
        const summary = calculateWeekSummary(
            week.records,
            week.startDate,
            getSeoulNow()
        );
        const sectionId = `attendance-week-${week.startDate}`;

        return `
            <section
                class="attendance-week-card"
                data-expanded="false"
                data-week-start="${week.startDate}">
                <button
                    class="attendance-week-header"
                    type="button"
                    aria-expanded="false"
                    aria-controls="${sectionId}">
                    <div class="attendance-week-heading">
                        <span class="attendance-week-chevron">›</span>

                        <div>
                            <strong>
                                ${escapeHtml(
                                    createWeekTitle(
                                        week.startDate,
                                        week.endDate
                                    )
                                )}
                            </strong>

                            <span>
                                ${summary.requiredDayCount}일 ·
                                ${summary.recordedWorkDayCount}일 기록
                            </span>
                        </div>
                    </div>

                    <div class="attendance-week-metrics">
                        ${createWeekMetric(
                            "총 근무",
                            formatMinutes(summary.totalWorkMinutes)
                        )}

                        ${createWeekMetric(
                            "필요",
                            formatMinutes(summary.requiredWorkMinutes)
                        )}

                        ${createWeekMetric(
                            "초과",
                            formatSignedMinutes(summary.overtimeMinutes),
                            getTimeStateClass(summary.overtimeMinutes)
                        )}
                    </div>
                </button>

                <div
                    id="${sectionId}"
                    class="attendance-day-list"
                    hidden>
                    ${week.records.map(createAttendanceRow).join("")}
                </div>
            </section>
        `;
    }

    function bindWeekToggleEvents() {
        document
            .querySelectorAll(".attendance-week-header")
            .forEach(header => {
                header.addEventListener("click", () => {
                    const card = header.closest(".attendance-week-card");
                    const bodyId = header.getAttribute("aria-controls");
                    const body = bodyId
                        ? document.getElementById(bodyId)
                        : null;

                    if (!card || !body) {
                        return;
                    }

                    const expanded =
                        header.getAttribute("aria-expanded") === "true";

                    header.setAttribute(
                        "aria-expanded",
                        String(!expanded)
                    );

                    card.dataset.expanded = String(!expanded);
                    body.hidden = expanded;
                });
            });
    }

    function createWeekMetric(label, value, valueClass = "") {
        const metricKey =
            label === "총 근무"
                ? "work"
                : label === "필요"
                    ? "required"
                    : "overtime";

        return `
            <div
                class="attendance-week-metric"
                data-week-metric="${metricKey}">
                <span>${escapeHtml(label)}</span>
                <strong class="${valueClass}">
                    ${escapeHtml(value)}
                </strong>
            </div>
        `;
    }

    function createAttendanceRow(record) {
        const now = getSeoulNow();
        const todayKey = formatDateKey(now);
        const effectiveWorkMinutes =
            getEffectiveWorkMinutes(record, now);

        const requiredMinutes =
            calculateRequiredMinutes(record);

        const isActiveToday =
            record.workDate === todayKey &&
            Boolean(record.checkInTime) &&
            !record.checkOutTime &&
            !record.isHoliday;

        const includedRequiredMinutes =
            isActiveToday
                ? Math.min(
                    effectiveWorkMinutes,
                    requiredMinutes
                )
                : requiredMinutes;

        const overtimeMinutes =
            effectiveWorkMinutes -
            includedRequiredMinutes;

        const hasTime =
            record.checkInTime ||
            record.checkOutTime;

        const mainText = hasTime
            ? `${record.checkInTime ?? "--:--"} ~ ${record.checkOutTime ?? "--:--"}`
            : getNonWorkingLabel(record);

        const statusText = createStatusText(record);

        const rowClass = [
            record.isHoliday ? "is-holiday" : "",
            record.hasPaidLeave ? "is-vacation" : "",
            record.workDate === todayKey
                ? "is-today"
                : ""
        ]
            .filter(Boolean)
            .join(" ");

        const isConfirmed =
            isConfirmedRecord(
                record,
                todayKey
            );

        return `
            <article
                class="attendance-day-row ${rowClass}"
                data-work-date="${record.workDate}">
                <div class="attendance-day-date">
                    <strong>${formatMonthDay(record.workDate)}</strong>
                    <span>${escapeHtml(record.weekName)}</span>
                </div>

                <div class="attendance-day-time">
                    <strong>${escapeHtml(mainText)}</strong>
                    <span>${escapeHtml(statusText)}</span>
                </div>

                <div class="attendance-day-value">
                    <span>근무시간</span>
                    <strong data-day-value="work">
                        ${
                            effectiveWorkMinutes > 0
                                ? formatMinutes(effectiveWorkMinutes)
                                : "-"
                        }
                    </strong>
                </div>

                <div class="attendance-day-value">
                    <span>초과시간</span>
                    <strong
                        data-day-value="overtime"
                        class="${
                            isConfirmed && requiredMinutes > 0
                                ? getTimeStateClass(overtimeMinutes)
                                : ""
                        }">
                        ${
                            isConfirmed && requiredMinutes > 0
                                ? formatSignedMinutes(overtimeMinutes)
                                : "-"
                        }
                    </strong>
                </div>
            </article>
        `;
    }

    function extractAttendanceRecords(response) {
        const normalized = normalizeResponse(response);

        const table =
            normalized?.JSonData?.Tables?.find(
                item => item?.TableName === "DataBlock1"
            ) ??
            normalized?.Tables?.find(
                item => item?.TableName === "DataBlock1"
            );

        if (
            !Array.isArray(table?.Columns) ||
            !Array.isArray(table?.Rows)
        ) {
            console.warn(
                "[근태 맞춤 보기] DataBlock1을 찾지 못했습니다.",
                normalized
            );

            return [];
        }

        return table.Rows
            .map(row => mapRow(table.Columns, row))
            .map(toAttendanceRecord)
            .filter(record => record.workDate)
            .sort((left, right) =>
                left.workDate.localeCompare(right.workDate)
            );
    }

    function normalizeResponse(value) {
        let result = value;

        for (let index = 0; index < 4; index++) {
            if (typeof result !== "string") {
                break;
            }

            const trimmed = result.trim();

            if (!trimmed) {
                break;
            }

            result = JSON.parse(trimmed);
        }

        return result;
    }

    function mapRow(columns, row) {
        return Object.fromEntries(
            columns.map((column, index) => [
                column,
                row[index]
            ])
        );
    }

    function getPaidWorkHours(row) {
        const value = Number(row.PaidWkCnt ?? 0);

        return Number.isFinite(value)
            ? Math.max(0, value)
            : 0;
    }

    function toAttendanceRecord(row) {
        const workHours = Number(
            row.OptWkCnt ??
            row.WkCnt ??
            0
        );

        const paidWorkHours =
            getPaidWorkHours(row);

        const workDate = String(row.WkDate || "");
        const weekName = String(row.WeekName || "");
        const workItem = String(row.WkItemName || "");
        const status = String(row.SMStatusName || "");
        const dayType = String(row.DayTypeName || "");
        const workStatus = String(row.WkStatusName || "");

        const isWeekend =
            weekName === "토" ||
            weekName === "일";

        const paidWorkMinutes =
            Number.isFinite(paidWorkHours)
                ? Math.round(paidWorkHours * 60)
                : 0;

        const hasPaidLeave =
            paidWorkMinutes > 0;

        const isFullPaidLeave =
            paidWorkMinutes >= STANDARD_WORK_MINUTES;

        const isPartialPaidLeave =
            paidWorkMinutes > 0 &&
            paidWorkMinutes < STANDARD_WORK_MINUTES;

        const isHalfDay =
            paidWorkMinutes === 4 * 60;

        const isVacation =
            hasPaidLeave ||
            containsAny(
                `${workItem} ${status} ${workStatus}`,
                [
                    "연차",
                    "휴가",
                    "반차",
                    "유급휴가"
                ]
            );

        const isHoliday =
            String(row.IsHoli) === "1" ||
            containsAny(
                `${dayType} ${workItem} ${status}`,
                [
                    "공휴일",
                    "휴일"
                ]
            );

        return {
            workDate,
            weekName,

            checkInTime: formatTime(
                row.BeginTimeN ||
                row.BegTime
            ),

            checkOutTime: formatTime(
                row.EndTimeN ||
                row.EndTime
            ),

            workMinutes:
                Number.isFinite(workHours)
                    ? Math.round(workHours * 60)
                    : 0,

            paidWorkMinutes,
            hasPaidLeave,
            isFullPaidLeave,
            isPartialPaidLeave,

            status,
            workStatus,
            dayType,
            workItem,
            isWeekend,
            isHoliday,
            isVacation,
            isHalfDay
        };
    }

    function groupRecordsByWeek(records) {
        const groups = new Map();

        for (const record of records) {
            const date = parseErpDate(record.workDate);

            if (!date) {
                continue;
            }

            const weekStart = getMonday(date);
            const weekEnd = addDays(weekStart, 6);
            const key = formatDateKey(weekStart);

            if (!groups.has(key)) {
                groups.set(key, {
                    startDate: formatDateKey(weekStart),
                    endDate: formatDateKey(weekEnd),
                    records: []
                });
            }

            groups.get(key).records.push(record);
        }

        return [...groups.values()].sort((left, right) =>
            left.startDate.localeCompare(right.startDate)
        );
    }

    function calculateTodaySummary(records) {
        const now = getSeoulNow();
        const todayKey = formatDateKey(now);
        const weekStart = getMonday(now);
        const weekStartKey = formatDateKey(weekStart);
        const weekDates = Array.from(
            { length: 5 },
            (_, index) =>
                formatDateKey(addDays(weekStart, index))
        );

        const recordsByDate = new Map(
            records.map(record => [
                record.workDate,
                record
            ])
        );

        const weeklyCalculation = calculateWeekSummary(
            records.filter(record =>
                weekDates.includes(record.workDate)
            ),
            weekStartKey,
            now
        );

        const todayRecord = recordsByDate.get(todayKey);
        const todayWorkMinutes = todayRecord
            ? getEffectiveWorkMinutes(todayRecord, now)
            : 0;

        const lastWorkDate = [...weekDates]
            .reverse()
            .find(date => {
                const record = recordsByDate.get(date);

                return (
                    record
                        ? calculateRequiredMinutes(record)
                        : STANDARD_WORK_MINUTES
                ) > 0;
            }) ?? weekDates[4];

        const priorDates = weekDates.filter(
            date => date < todayKey
        );

        const priorWorkMinutes = priorDates.reduce(
            (sum, date) => {
                const record = recordsByDate.get(date);

                if (
                    !record ||
                    !isConfirmedRecord(record, todayKey)
                ) {
                    return sum;
                }

                return (
                    sum +
                    getEffectiveWorkMinutes(record, now)
                );
            },
            0
        );

        const priorRequiredMinutes = priorDates.reduce(
            (sum, date) => {
                const record = recordsByDate.get(date);

                if (
                    !record ||
                    !isConfirmedRecord(record, todayKey)
                ) {
                    return sum;
                }

                return (
                    sum +
                    calculateRequiredMinutes(record)
                );
            },
            0
        );

        const priorOvertimeMinutes =
            priorWorkMinutes -
            priorRequiredMinutes;

        const todayTarget = todayRecord
            ? calculateRequiredMinutes(todayRecord)
            : STANDARD_WORK_MINUTES;

        const requiredTodayMinutes =
            todayKey === lastWorkDate
                ? Math.max(
                    0,
                    weeklyCalculation.requiredWorkMinutes -
                    priorWorkMinutes
                )
                : todayTarget;

        let availableCheckOutTime = "--:--";
        let availableCheckOutClass = "";
        let canLeaveNow = false;

        if (
            todayRecord?.checkInTime &&
            !todayRecord.isHoliday &&
            requiredTodayMinutes > 0
        ) {
            availableCheckOutTime = addMinutesToTime(
                todayRecord.checkInTime,
                requiredTodayMinutes +
                    DEFAULT_BREAK_MINUTES
            );

            const currentTime =
                `${String(now.getHours()).padStart(2, "0")}:` +
                `${String(now.getMinutes()).padStart(2, "0")}`;

            canLeaveNow =
                !todayRecord.checkOutTime &&
                compareTime(
                    currentTime,
                    availableCheckOutTime
                ) >= 0;

            if (
                canLeaveNow ||
                (
                    todayRecord.checkOutTime &&
                    compareTime(
                        todayRecord.checkOutTime,
                        availableCheckOutTime
                    ) >= 0
                )
            ) {
                availableCheckOutClass =
                    "is-positive";
            }
        }

        const common = {
            todayRecord,
            todayWorkMinutes,
            weeklyWorkMinutes:
                weeklyCalculation.totalWorkMinutes,
            weeklyOvertimeMinutes:
                weeklyCalculation.overtimeMinutes,
            weeklyRequiredMinutes:
                weeklyCalculation.requiredWorkMinutes,
            availableCheckOutTime,
            availableCheckOutClass,
            canLeaveNow,
            lastWorkDate,
            priorWorkMinutes,
            priorRequiredMinutes,
            priorOvertimeMinutes,
            todayTarget,
            requiredTodayMinutes
        };

        if (!todayRecord) {
            return {
                ...common,
                title: "오늘 기록이 없습니다",
                description:
                    "조회 기간에 오늘 날짜가 포함되어 있는지 확인하세요.",
                badge: "기록 없음",
                badgeClass: "is-muted"
            };
        }

        if (todayRecord.isHoliday) {
            return {
                ...common,
                title: getNonWorkingLabel(todayRecord),
                description:
                    "오늘은 필요 근무시간에 포함되지 않습니다.",
                badge: "공휴일",
                badgeClass: "is-holiday",
                availableCheckOutTime: "-",
                canLeaveNow: false
            };
        }

        if (
            todayRecord.isFullPaidLeave &&
            !todayRecord.checkInTime &&
            !todayRecord.checkOutTime
        ) {
            const leaveName =
                todayRecord.workItem ||
                todayRecord.status ||
                "유급휴가";

            return {
                ...common,
                title: leaveName,
                description:
                    `유급근무시간 ${formatMinutes(
                        todayRecord.paidWorkMinutes
                    )}이 반영되어 오늘 필요 근무시간은 없습니다.`,
                badge: leaveName,
                badgeClass: "is-vacation",
                availableCheckOutTime: "-",
                canLeaveNow: false
            };
        }

        if (
            todayRecord.checkInTime &&
            !todayRecord.checkOutTime
        ) {
            const paidDescription =
                todayRecord.paidWorkMinutes > 0
                    ? ` · 유급 ${formatMinutes(
                        todayRecord.paidWorkMinutes
                    )} 반영`
                    : "";

            return {
                ...common,
                title: `${todayRecord.checkInTime} 출근`,
                description: canLeaveNow
                    ? `퇴근 가능한 시간입니다${paidDescription}.`
                    : `${availableCheckOutTime}부터 퇴근할 수 있습니다${paidDescription}.`,
                badge: canLeaveNow
                    ? "퇴근 가능"
                    : "근무 중",
                badgeClass: canLeaveNow
                    ? "is-complete"
                    : "is-working"
            };
        }

        if (
            todayRecord.checkInTime &&
            todayRecord.checkOutTime
        ) {
            const paidDescription =
                todayRecord.paidWorkMinutes > 0
                    ? `, 유급 ${formatMinutes(
                        todayRecord.paidWorkMinutes
                    )} 반영`
                    : "";

            return {
                ...common,
                title:
                    `${todayRecord.checkInTime} ~ ${todayRecord.checkOutTime}`,
                description:
                    `오늘 ${formatMinutes(
                        todayWorkMinutes
                    )} 근무했습니다${paidDescription}.`,
                badge: "퇴근 완료",
                badgeClass: "is-complete",
                canLeaveNow: false
            };
        }

        if (todayRecord.hasPaidLeave) {
            const leaveName =
                todayRecord.workItem ||
                todayRecord.status ||
                "유급휴가";

            return {
                ...common,
                title: leaveName,
                description:
                    `유급근무시간 ${formatMinutes(
                        todayRecord.paidWorkMinutes
                    )}, 필요 근무시간 ${formatMinutes(
                        todayTarget
                    )}으로 반영됩니다.`,
                badge: leaveName,
                badgeClass: "is-vacation",
                availableCheckOutTime:
                    todayTarget > 0
                        ? "--:--"
                        : "-",
                canLeaveNow: false
            };
        }

        return {
            ...common,
            title: getNonWorkingLabel(todayRecord),
            description: createStatusText(todayRecord),
            badge: "미등록",
            badgeClass: "is-muted"
        };
    }

    function isConfirmedRecord(
        record,
        todayKey
    ) {
        const isActiveToday =
            record.workDate === todayKey &&
            Boolean(record.checkInTime) &&
            !record.checkOutTime &&
            !record.isHoliday;

        const isCompletedWork =
            Boolean(record.checkInTime) &&
            Boolean(record.checkOutTime);

        return (
            isCompletedWork ||
            isActiveToday ||
            record.isHoliday ||
            record.isVacation ||
            record.paidWorkMinutes > 0
        );
    }

    function getEffectiveWorkMinutes(record, now) {
        if (!record.checkInTime) {
            return 0;
        }

        if (record.checkOutTime) {
            return calculateWorkMinutesFromTimes(
                record.checkInTime,
                record.checkOutTime
            );
        }

        if (record.workDate !== formatDateKey(now)) {
            return 0;
        }

        const currentTime =
            `${String(now.getHours()).padStart(2, "0")}:` +
            `${String(now.getMinutes()).padStart(2, "0")}`;

        return calculateLiveWorkMinutes(
            record.checkInTime,
            currentTime
        );
    }

    function calculateWorkMinutesFromTimes(
        checkInTime,
        checkOutTime
    ) {
        const elapsed = calculateElapsedMinutes(
            checkInTime,
            checkOutTime
        );

        if (elapsed <= 0) {
            return 0;
        }

        const breakMinutes =
            elapsed > 300
                ? DEFAULT_BREAK_MINUTES
                : 0;

        return Math.max(
            0,
            elapsed - breakMinutes
        );
    }

    function calculateLiveWorkMinutes(
        checkInTime,
        currentTime
    ) {
        const elapsed = calculateElapsedMinutes(
            checkInTime,
            currentTime
        );

        if (elapsed <= 0) {
            return 0;
        }

        const appliedBreakMinutes = Math.min(
            DEFAULT_BREAK_MINUTES,
            Math.max(0, elapsed - 240)
        );

        return Math.max(
            0,
            elapsed - appliedBreakMinutes
        );
    }

    function calculateElapsedMinutes(
        startTime,
        endTime
    ) {
        const startMinutes =
            timeToMinutes(startTime);

        let endMinutes =
            timeToMinutes(endTime);

        if (
            !Number.isFinite(startMinutes) ||
            !Number.isFinite(endMinutes)
        ) {
            return 0;
        }

        if (endMinutes < startMinutes) {
            endMinutes += 24 * 60;
        }

        return endMinutes - startMinutes;
    }

    function calculateWeekSummary(
        records,
        weekStartDate,
        now = getSeoulNow()
    ) {
        const recordsByDate = new Map(
            records.map(record => [
                record.workDate,
                record
            ])
        );

        const parsedWeekStart =
            parseErpDate(weekStartDate);

        const weekdayDates = parsedWeekStart
            ? Array.from(
                { length: 5 },
                (_, index) =>
                    formatDateKey(
                        addDays(parsedWeekStart, index)
                    )
            )
            : records.map(record => record.workDate);

        const todayKey = formatDateKey(now);

        const requiredWorkMinutes =
            weekdayDates.reduce((sum, date) => {
                const record = recordsByDate.get(date);

                return (
                    sum +
                    (
                        record
                            ? calculateRequiredMinutes(record)
                            : STANDARD_WORK_MINUTES
                    )
                );
            }, 0);

        let totalWorkMinutes = 0;
        let includedRequiredMinutes = 0;

        for (const record of records) {
            if (!isConfirmedRecord(record, todayKey)) {
                continue;
            }

            const effectiveWorkMinutes =
                getEffectiveWorkMinutes(record, now);

            const target =
                calculateRequiredMinutes(record);

            const isActiveToday =
                record.workDate === todayKey &&
                Boolean(record.checkInTime) &&
                !record.checkOutTime &&
                !record.isHoliday &&
                (
                    !record.isVacation ||
                    record.isHalfDay
                );

            totalWorkMinutes +=
                effectiveWorkMinutes;

            includedRequiredMinutes +=
                isActiveToday
                    ? Math.min(
                        effectiveWorkMinutes,
                        target
                    )
                    : target;
        }

        return {
            totalWorkMinutes,
            requiredWorkMinutes,
            overtimeMinutes:
                totalWorkMinutes -
                includedRequiredMinutes,

            requiredDayCount: weekdayDates.filter(date => {
                const record = recordsByDate.get(date);

                return (
                    record
                        ? calculateRequiredMinutes(record)
                        : STANDARD_WORK_MINUTES
                ) > 0;
            }).length,

            recordedWorkDayCount: records.filter(
                record =>
                    isConfirmedRecord(
                        record,
                        todayKey
                    )
            ).length
        };
    }

    function calculateRequiredMinutes(record) {
        if (!record) {
            return STANDARD_WORK_MINUTES;
        }

        if (
            record.isWeekend ||
            record.isHoliday
        ) {
            return 0;
        }

        const paidWorkMinutes = Math.max(
            0,
            Math.min(
                STANDARD_WORK_MINUTES,
                Number(record.paidWorkMinutes) || 0
            )
        );

        return Math.max(
            0,
            STANDARD_WORK_MINUTES -
                paidWorkMinutes
        );
    }

    function getNonWorkingLabel(record) {
        if (record.workItem) {
            return record.workItem;
        }

        if (record.isHoliday) {
            return "공휴일";
        }

        if (record.isVacation) {
            return record.isHalfDay
                ? "반차"
                : "연차";
        }

        if (record.status) {
            return record.status;
        }

        return "기록 없음";
    }

    function createStatusText(record) {
        const values = [
            record.status,
            record.workItem,
            record.dayType
        ].filter(Boolean);

        if (record.paidWorkMinutes > 0) {
            values.push(
                `유급 ${formatMinutes(
                    record.paidWorkMinutes
                )}`
            );
        }

        return [...new Set(values)].join(" · ");
    }

    function createWeekTitle(startDate, endDate) {
        return `${formatWeekDate(startDate)} ~ ${formatWeekDate(endDate)}`;
    }

    function getTimeStateClass(minutes) {
        if (minutes > 0) {
            return "is-positive";
        }

        if (minutes < 0) {
            return "is-negative";
        }

        return "is-neutral";
    }

    function formatSignedMinutes(minutes) {
        const safeMinutes =
            Math.round(Number(minutes) || 0);

        if (safeMinutes === 0) {
            return "0분";
        }

        const sign =
            safeMinutes > 0 ? "+" : "-";

        return sign + formatMinutes(
            Math.abs(safeMinutes)
        );
    }

    function formatMinutes(totalMinutes) {
        const safeMinutes = Math.max(
            0,
            Math.round(Number(totalMinutes) || 0)
        );

        const hours = Math.floor(safeMinutes / 60);
        const minutes = safeMinutes % 60;

        if (hours === 0) {
            return `${minutes}분`;
        }

        if (minutes === 0) {
            return `${hours}시간`;
        }

        return `${hours}시간 ${minutes}분`;
    }

    function formatTime(value) {
        const text =
            String(value || "").replace(/\D/g, "");

        if (text.length !== 4) {
            return null;
        }

        return `${text.slice(0, 2)}:${text.slice(2, 4)}`;
    }

    function formatWeekDate(value) {
        const text =
            String(value || "").replace(/\D/g, "");

        if (text.length !== 8) {
            return value || "-";
        }

        return `${Number(text.slice(4, 6))}.${Number(
            text.slice(6, 8)
        )}`;
    }

    function formatMonthDay(value) {
        const text =
            String(value || "").replace(/\D/g, "");

        if (text.length !== 8) {
            return value || "-";
        }

        return `${Number(text.slice(4, 6))}월 ${Number(
            text.slice(6, 8)
        )}일`;
    }

    function parseErpDate(value) {
        const text =
            String(value || "").replace(/\D/g, "");

        if (text.length !== 8) {
            return null;
        }

        return new Date(
            Number(text.slice(0, 4)),
            Number(text.slice(4, 6)) - 1,
            Number(text.slice(6, 8))
        );
    }

    function getMonday(date) {
        const result = new Date(
            date.getFullYear(),
            date.getMonth(),
            date.getDate()
        );

        const day = result.getDay();
        const offset = day === 0 ? -6 : 1 - day;

        result.setDate(result.getDate() + offset);

        return result;
    }

    function addDays(date, days) {
        const result = new Date(
            date.getFullYear(),
            date.getMonth(),
            date.getDate()
        );

        result.setDate(result.getDate() + days);

        return result;
    }

    function formatDateKey(date) {
        return [
            date.getFullYear(),
            String(date.getMonth() + 1).padStart(2, "0"),
            String(date.getDate()).padStart(2, "0")
        ].join("");
    }

    function getSeoulNow() {
        const parts = new Intl.DateTimeFormat(
            "en-CA",
            {
                timeZone: "Asia/Seoul",
                year: "numeric",
                month: "2-digit",
                day: "2-digit",
                hour: "2-digit",
                minute: "2-digit",
                hourCycle: "h23"
            }
        ).formatToParts(new Date());

        const get = type =>
            parts.find(part => part.type === type)?.value ?? "0";

        return new Date(
            Number(get("year")),
            Number(get("month")) - 1,
            Number(get("day")),
            Number(get("hour")),
            Number(get("minute"))
        );
    }

    function timeToMinutes(value) {
        if (!value) {
            return 0;
        }

        const [hour, minute] =
            value.split(":").map(Number);

        return hour * 60 + minute;
    }

    function addMinutesToTime(value, minutes) {
        const total =
            (timeToMinutes(value) + minutes) % 1440;

        return `${String(
            Math.floor(total / 60)
        ).padStart(2, "0")}:${String(
            total % 60
        ).padStart(2, "0")}`;
    }

    function compareTime(left, right) {
        return (
            timeToMinutes(left) -
            timeToMinutes(right)
        );
    }

    function containsAny(value, candidates) {
        const text = String(value || "");

        return candidates.some(candidate =>
            text.includes(candidate)
        );
    }

    function escapeHtml(value) {
        return String(value ?? "")
            .replaceAll("&", "&amp;")
            .replaceAll("<", "&lt;")
            .replaceAll(">", "&gt;")
            .replaceAll('"', "&quot;")
            .replaceAll("'", "&#039;");
    }

    function createStyles() {
        if (!document.head || document.getElementById(STYLE_ID)) {
            return;
        }

        const style = document.createElement("style");

        style.id = STYLE_ID;
        style.textContent = `
            body.attendance-viewer-dragging {
                user-select: none !important;
                cursor: grabbing !important;
            }

            #${BUTTON_ID} {
                position: fixed !important;
                right: 24px !important;
                bottom: 24px !important;
                z-index: 2147483646 !important;
                display: block !important;
                height: 44px !important;
                padding: 0 18px !important;
                border: 0 !important;
                border-radius: 12px !important;
                background: #17795b !important;
                color: #ffffff !important;
                font-family: Pretendard, "Noto Sans KR", Arial, sans-serif !important;
                font-size: 14px !important;
                font-weight: 700 !important;
                box-shadow: 0 8px 24px rgba(0, 0, 0, 0.24) !important;
                cursor: pointer !important;
            }

            #${BUTTON_ID}:hover {
                filter: brightness(1.06);
            }

            #${PANEL_ID} {
                position: fixed !important;
                top: 20px !important;
                right: 20px !important;
                z-index: 2147483647 !important;
                width: min(900px, calc(100vw - 40px)) !important;
                height: min(800px, calc(100vh - 40px)) !important;
                display: none !important;
                overflow: hidden !important;
                border: 1px solid #dde4e0 !important;
                border-radius: 18px !important;
                background: #f5f7f6 !important;
                color: #17201c !important;
                box-shadow: 0 18px 60px rgba(0, 0, 0, 0.32) !important;
                font-family: Pretendard, "Noto Sans KR", Arial, sans-serif !important;
            }

            #${PANEL_ID}.is-open {
                display: flex !important;
                flex-direction: column !important;
            }

            .attendance-viewer-header {
                display: flex;
                align-items: flex-start;
                justify-content: space-between;
                gap: 20px;
                flex: 0 0 auto;
                padding: 20px 22px;
                border-bottom: 1px solid #e1e7e4;
                background: #ffffff;
                cursor: grab;
                touch-action: none;
            }

            .attendance-viewer-header:active {
                cursor: grabbing;
            }

            .attendance-viewer-heading {
                min-width: 0;
                pointer-events: none;
            }

            .attendance-viewer-title-row {
                display: flex;
                align-items: center;
                gap: 8px;
            }

            .attendance-viewer-header strong {
                color: #17201c;
                font-size: 20px;
            }

            .attendance-viewer-version {
                display: inline-flex;
                align-items: center;
                height: 20px;
                padding: 0 7px;
                border: 1px solid #dfe6e2;
                border-radius: 999px;
                background: #f5f8f6;
                color: #7b8781;
                font-size: 11px;
                font-weight: 600;
                line-height: 1;
            }

            .attendance-viewer-header p {
                margin: 5px 0 0;
                color: #707b76;
                font-size: 13px;
            }

            .attendance-viewer-update-link {
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

            .attendance-viewer-update-link:hover {
                border-color: #e4bd6d;
                background: #fff1cf;
            }

            .attendance-viewer-update-link[hidden] {
                display: none;
            }

            .attendance-viewer-header-actions {
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

            #attendance-viewer-close {
                flex: 0 0 auto;
                width: 34px;
                height: 34px;
                border: 0;
                border-radius: 10px;
                background: #edf1ef;
                color: #53605a;
                font-size: 24px;
                line-height: 1;
                cursor: pointer;
            }

            #attendance-viewer-content {
                flex: 1 1 auto;
                min-height: 0;
                overflow-y: auto;
                padding: 20px;
            }

            .attendance-today {
                margin-bottom: 18px;
                padding: 20px;
                border: 1px solid #dce5e0;
                border-radius: 18px;
                background: #ffffff;
            }

            .attendance-today-title {
                display: flex;
                align-items: flex-start;
                justify-content: space-between;
                gap: 20px;
                margin-bottom: 16px;
            }

            .attendance-today-eyebrow {
                display: block;
                margin-bottom: 5px;
                color: #17795b;
                font-size: 12px;
                font-weight: 700;
            }

            .attendance-today-title strong {
                color: #17201c;
                font-size: 22px;
            }

            .attendance-today-title p {
                margin: 6px 0 0;
                color: #707b76;
                font-size: 13px;
            }

            .attendance-today-badge {
                flex: 0 0 auto;
                padding: 7px 11px;
                border-radius: 999px;
                font-size: 12px;
                font-weight: 700;
            }

            .attendance-today-badge.is-working {
                background: #e8f7f1;
                color: #17795b;
            }

            .attendance-today-badge.is-complete {
                background: #edf2ff;
                color: #4666ad;
            }

            .attendance-today-badge.is-holiday,
            .attendance-today-badge.is-vacation {
                background: #fff4da;
                color: #9a6a10;
            }

            .attendance-today-badge.is-muted {
                background: #eef1ef;
                color: #69736e;
            }

            .attendance-today-cards {
                display: grid;
                grid-template-columns: repeat(4, minmax(0, 1fr));
                align-items: stretch;
                gap: 10px;
            }

            .attendance-today-card {
                min-width: 0;
                min-height: 76px;
                padding: 13px 14px;
                border: 1px solid #e3e9e6;
                border-radius: 13px;
                background: #f9fbfa;
            }

            .attendance-today-card span {
                display: block;
                margin-bottom: 7px;
                color: #7c8781;
                font-size: 11px;
            }

            .attendance-today-card strong {
                display: block;
                overflow: hidden;
                color: #1d2923;
                font-size: 16px;
                text-overflow: ellipsis;
                white-space: nowrap;
            }

            .attendance-departure-card {
                position: relative;
                min-height: 72px;
            }

            .attendance-departure-card.is-ready {
                border-color: #b8dcca;
                background: #f5fbf8;
            }

            .attendance-departure-heading {
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 8px;
                margin-bottom: 7px;
            }

            .attendance-departure-heading > span {
                margin: 0;
            }

            .attendance-departure-value {
                display: flex;
                align-items: center;
                gap: 7px;
                min-width: 0;
                margin-top: 7px;
            }

            .attendance-departure-value strong {
                display: block;
                min-width: 0;
                overflow: hidden;
                font-size: 18px;
                line-height: 1.2;
                text-overflow: ellipsis;
                white-space: nowrap;
            }

            .attendance-departure-value em {
                flex: 0 0 auto;
                display: inline-flex;
                align-items: center;
                min-height: 20px;
                padding: 2px 7px;
                border-radius: 999px;
                background: #dff4ea;
                color: #17795b;
                font-size: 9px;
                font-style: normal;
                font-weight: 700;
                white-space: nowrap;
            }

            .attendance-departure-info {
                flex: 0 0 auto;
                width: 20px;
                height: 20px;
                padding: 0;
                border: 1px solid #cfd9d4;
                border-radius: 50%;
                background: #ffffff;
                color: #66736d;
                font-size: 11px;
                font-weight: 800;
                line-height: 18px;
                cursor: pointer;
            }

            .attendance-departure-details {
                position: absolute;
                top: calc(100% + 8px);
                right: 0;
                z-index: 20;
                display: none;
                width: 320px;
                padding: 13px;
                border: 1px solid #dce5e0;
                border-radius: 12px;
                background: #ffffff;
                box-shadow: 0 8px 22px rgba(23, 32, 28, 0.12);
            }

            .attendance-departure-card.is-expanded
            .attendance-departure-details {
                display: block;
            }

            .attendance-departure-guide strong,
            .attendance-departure-guide span {
                display: block;
            }

            .attendance-departure-guide strong {
                color: #45665a;
                font-size: 11px;
                font-weight: 700;
            }

            .attendance-departure-guide span {
                margin-top: 3px;
                color: #6f8179;
                font-size: 10px;
                line-height: 1.45;
            }

            .attendance-departure-details p b em {
                display: inline-block;
                margin-left: 5px;
                font-size: 10px;
                font-style: normal;
                font-weight: 700;
            }

            .attendance-departure-guide {
                display: block;
                margin: 0 0 10px;
                padding: 9px 10px;
                border-radius: 9px;
                background: #f4f8f6;
                color: #65716b;
                font-size: 11px;
                font-style: normal;
                line-height: 1.45;
            }

            .attendance-departure-details p {
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 16px;
                margin: 8px 0 0;
                padding-top: 8px;
                border-top: 1px solid #e3e9e6;
                color: #6f7b75;
                font-size: 11px;
            }

            .attendance-departure-details p:first-child {
                margin-top: 0;
                padding-top: 0;
                border-top: 0;
            }

            .attendance-departure-details p span {
                margin: 0;
            }

            .attendance-departure-details p b {
                color: #26332d;
                font-size: 11px;
            }

            .attendance-departure-details aside {
                margin-top: 10px;
                padding: 9px 10px;
                border-radius: 9px;
                background: #eef7f3;
                color: #41685a;
                font-size: 11px;
                line-height: 1.45;
            }

            .attendance-week-list {
                display: grid;
                gap: 12px;
            }

            .attendance-week-card {
                overflow: hidden;
                border: 1px solid #dfe6e2;
                border-radius: 14px;
                background: #ffffff;
            }

            .attendance-week-header {
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 20px;
                width: 100%;
                padding: 16px 18px;
                border: 0;
                background: #ffffff;
                color: inherit;
                font: inherit;
                text-align: left;
                cursor: pointer;
            }

            .attendance-week-header:hover {
                background: #fafcfb;
            }

            .attendance-week-heading {
                display: flex;
                align-items: center;
                gap: 11px;
                min-width: 0;
            }

            .attendance-week-chevron {
                flex: 0 0 auto;
                color: #718079;
                font-size: 25px;
                line-height: 1;
                transition: transform 150ms ease;
            }

            .attendance-week-card[data-expanded="true"]
            .attendance-week-chevron {
                transform: rotate(90deg);
            }

            .attendance-week-heading strong {
                display: block;
                color: #1b2721;
                font-size: 17px;
            }

            .attendance-week-heading div > span {
                display: block;
                margin-top: 4px;
                color: #7a8580;
                font-size: 12px;
            }

            .attendance-week-metrics {
                display: flex;
                align-items: center;
                gap: 22px;
            }

            .attendance-week-metric {
                min-width: 82px;
                text-align: right;
            }

            .attendance-week-metric span {
                display: block;
                margin-bottom: 4px;
                color: #808984;
                font-size: 11px;
            }

            .attendance-week-metric strong {
                font-size: 14px;
            }

            .attendance-day-list {
                border-top: 1px solid #e7ebe9;
            }

            .attendance-day-list[hidden] {
                display: none !important;
            }

            .attendance-day-row {
                display: grid;
                grid-template-columns:
                    105px
                    minmax(180px, 1fr)
                    115px
                    115px;
                align-items: center;
                gap: 16px;
                min-height: 68px;
                padding: 11px 18px;
                border-bottom: 1px solid #edf0ee;
                background: #ffffff;
            }

            .attendance-day-row:last-child {
                border-bottom: 0;
            }

            .attendance-day-row.is-today {
                background: #f4faf7;
                box-shadow: inset 3px 0 0 #2b8a68;
            }

            .attendance-day-row.is-vacation,
            .attendance-day-row.is-holiday {
                background: #fffbf1;
            }

            .attendance-day-row.is-today.is-vacation,
            .attendance-day-row.is-today.is-holiday {
                box-shadow: inset 3px 0 0 #c59a36;
            }

            .attendance-day-date,
            .attendance-day-time,
            .attendance-day-value {
                min-width: 0;
            }

            .attendance-day-date {
                display: flex;
                align-items: baseline;
                gap: 7px;
            }

            .attendance-day-date strong {
                color: #24302a;
                font-size: 14px;
            }

            .attendance-day-date span {
                color: #7d8782;
                font-size: 12px;
            }

            .attendance-day-time strong {
                display: block;
                overflow: hidden;
                color: #17201c;
                font-size: 15px;
                text-overflow: ellipsis;
                white-space: nowrap;
            }

            .attendance-day-time span {
                display: block;
                margin-top: 4px;
                overflow: hidden;
                color: #818b86;
                font-size: 11px;
                text-overflow: ellipsis;
                white-space: nowrap;
            }

            .attendance-day-value {
                text-align: right;
            }

            .attendance-day-value span {
                display: block;
                margin-bottom: 4px;
                color: #8a938f;
                font-size: 11px;
            }

            .attendance-day-value strong {
                color: #27332d;
                font-size: 14px;
            }

            .is-positive {
                color: #17795b !important;
            }

            .is-negative {
                color: #d84f4f !important;
            }

            .is-neutral {
                color: #626c67 !important;
            }

            .attendance-viewer-empty {
                padding: 60px 20px;
                color: #717c76;
                text-align: center;
            }

            /* Dashboard-style today summary */
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

            /* Simplified modern dashboard */
            .attendance-today {
                padding: 16px;
                border-radius: 16px;
                box-shadow: none;
            }

            .attendance-today-title {
                align-items: flex-start;
                gap: 14px;
                margin-bottom: 14px;
            }

            .attendance-today-title strong {
                font-size: 18px;
                line-height: 1.2;
                letter-spacing: -0.02em;
            }

            .attendance-today-summary {
                margin: 6px 0 0 !important;
                color: #69756f !important;
                font-size: 13px !important;
                line-height: 1.5;
            }

            .attendance-today-badge {
                padding: 6px 10px;
                font-size: 12px;
            }

            .attendance-today-badge.is-working::before,
            .attendance-card-icon,
            .attendance-departure-heading > span::before {
                display: none !important;
                content: none !important;
            }

            .attendance-today-cards {
                gap: 10px;
            }

            .attendance-today-card {
                min-height: 74px;
                padding: 13px 14px;
                border-radius: 13px;
                background: #ffffff;
                box-shadow: none;
            }

            .attendance-card-heading {
                display: block;
                margin: 0;
            }

            .attendance-today-card span {
                margin-bottom: 7px;
                font-size: 12px;
            }

            .attendance-today-card strong {
                font-size: 18px;
            }

            .attendance-departure-card {
                min-height: 74px;
                padding-top: 13px;
            }

            .attendance-departure-heading {
                margin-bottom: 7px;
            }

            .attendance-departure-details {
                width: 300px;
                padding: 12px;
                font-size: 12px;
            }

            .attendance-departure-guide strong {
                font-size: 12px;
                line-height: 1.45;
            }

            .attendance-departure-guide span,
            .attendance-departure-details p,
            .attendance-departure-details p b,
            .attendance-departure-details p b em {
                font-size: 11px;
                line-height: 1.45;
            }

            .attendance-day-date {
                align-items: center;
                flex-wrap: wrap;
            }


            @media (max-width: 900px) {
                .attendance-today-cards {
                    grid-template-columns:
                        repeat(2, minmax(0, 1fr));
                }

                .attendance-week-header {
                    align-items: flex-start;
                    flex-direction: column;
                }

                .attendance-week-metrics {
                    width: 100%;
                    justify-content: space-between;
                }

                .attendance-week-metric {
                    min-width: 0;
                    text-align: left;
                }

                .attendance-day-row {
                    grid-template-columns:
                        95px
                        minmax(150px, 1fr)
                        105px
                        105px;
                }
            }

            @media (max-width: 650px) {

                .attendance-today-cards {
                    grid-template-columns: 1fr;
                }

                .attendance-departure-details {
                    right: 0;
                    width: min(330px, calc(100vw - 64px));
                }

                #${PANEL_ID} {
                    top: 10px !important;
                    right: 10px !important;
                    width: calc(100vw - 20px) !important;
                    height: calc(100vh - 20px) !important;
                }

                .attendance-today-title {
                    flex-direction: column;
                    gap: 10px;
                }

                .attendance-day-row {
                    grid-template-columns:
                        minmax(0, 1fr)
                        auto;
                    gap: 8px 12px;
                }

                .attendance-day-date {
                    grid-column: 1;
                    grid-row: 1;
                }

                .attendance-day-time {
                    grid-column: 1;
                    grid-row: 2;
                }

                .attendance-day-value {
                    grid-column: 2;
                }

                .attendance-day-value:nth-of-type(3) {
                    grid-row: 1;
                }

                .attendance-day-value:nth-of-type(4) {
                    grid-row: 2;
                }
            }
        `;

        document.head.appendChild(style);
    }
})();
