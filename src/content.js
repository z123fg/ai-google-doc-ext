import React from "react";
import { createRoot } from "react-dom/client";
import { SidebarApp } from "./SidebarApp.jsx";
import { sidebarStore } from "./sidebarStore.js";
import { MSG } from "./messages.js";
import "./sidebar.css";
import { asyncThrottle } from "@tanstack/pacer";

(() => {
    if (location.href !== "about:blank") return;

    const SEL = 'div[aria-label="Document content"][contenteditable="true"]';
    const targetDoc = window.top.document;

    let shadowBuffer = "";
    let shadowCursor = 0;
    let isPopupOpen = false;
    let isAllSelected = false;
    let throttledRequestSearchResults;
    const searchSession = {
        issuedVersion: 0,
        renderedVersion: 0,

        issue() {
            return ++this.issuedVersion;
        },

        invalidate() {
            this.issuedVersion += 1;
            this.renderedVersion = this.issuedVersion;
        },

        canRender(version) {
            return version > this.renderedVersion;
        },

        markRendered(version) {
            this.renderedVersion = version;
        },
    };

    const isExtensionContextAlive = () => {
        try {
            return Boolean(chrome?.runtime?.id);
        } catch {
            return false;
        }
    };

    const safeSendMessage = async (message) => {
        if (!isExtensionContextAlive()) return null;
        try {
            return await chrome.runtime.sendMessage(message);
        } catch (error) {
            const messageText =
                error instanceof Error ? error.message : String(error);
            if (!messageText.includes("Extension context invalidated")) {
                throw error;
            }
            return null;
        }
    };

    const setIndexingState = ({ progress, status, visible = true }) => {
        sidebarStore.update((state) => {
            state.indexing = {
                progress:
                    typeof progress === "number"
                        ? progress
                        : state.indexing.progress,
                status:
                    typeof status === "string" ? status : state.indexing.status,
                visible,
            };

            if (typeof status === "string" && status.trim() && visible) {
                state.uploadSummary = status;
            }
        });
    };

    const clearSearchResults = () => {
        sidebarStore.update((state) => {
            state.results = [];
            state.search.loading = false;
        });
    };

    const getWriteBackText = (text) => {
        const separatorIndex = text.indexOf(":");
        const answer =
            separatorIndex >= 0 ? text.slice(separatorIndex + 1).trim() : text;
        return `\n${answer}`;
    };

    const renderDocuments = (documents) => {
        sidebarStore.setState({ documents });
    };

    const loadDocuments = async () => {
        const response = await safeSendMessage({
            type: MSG.GET_DOCUMENTS,
        });

        if (response?.documents) {
            renderDocuments(response.documents);
        }
    };

    const renderSearchResults = (matches) => {
        sidebarStore.update((state) => {
            state.results = matches;
            state.search.loading = false;
            state.search.hasSearched = true;
        });
    };

    const handleIndexingStatus = (msg) => {
        if (msg.type !== MSG.INDEXING_STATUS) return;

        setIndexingState({
            progress: msg.progress,
            status: msg.status,
            visible: true,
        });

        if (msg.progress >= 100) {
            setTimeout(() => {
                setIndexingState({
                    status: "",
                    visible: false,
                });
            }, 1000);
        }
    };

    const startIndexingFromFile = async (text) => {
        setIndexingState({
            progress: 0,
            status: "Starting AI indexing...",
            visible: true,
        });

        const response = await safeSendMessage({
            type: MSG.START_INDEXING,
            text,
            sourceName: sidebarStore.getState().selectedFileName,
        });

        if (response?.documents) {
            renderDocuments(response.documents);
        }
        await updateUI();

        console.log("AI indexing started...");
    };

    const handleFileSelection = (file) => {
        if (!file) return;

        sidebarStore.setState({
            selectedFileName: file.name,
            uploadSummary: file.name,
        });

        setIndexingState({
            progress: 0,
            status: "Preparing upload...",
            visible: true,
        });

        const reader = new FileReader();
        reader.onload = async (event) => {
            await startIndexingFromFile(event.target.result);
        };
        reader.readAsText(file);
    };

    const handleToggleDocument = async (documentId, enabled) => {
        const response = await safeSendMessage({
            type: MSG.TOGGLE_DOCUMENT,
            documentId,
            enabled,
        });
        if (response?.documents) {
            renderDocuments(response.documents);
        }
        await updateUI();
    };

    const handleRemoveDocument = async (document) => {
        const confirmed = window.top.confirm(
            `Remove "${document.name}" from the indexed library?`,
        );
        if (!confirmed) return;

        const response = await safeSendMessage({
            type: MSG.REMOVE_DOCUMENT,
            documentId: document.id,
        });

        if (response?.documents) {
            renderDocuments(response.documents);
        }
        await updateUI();
    };

    const writeBack = (text) => {
        const el = document.querySelector(SEL);
        if (!el) {
            console.error("未找到编辑器元素");
            return;
        }

        el.focus();

        const dataTransfer = new DataTransfer();
        dataTransfer.setData("text/plain", text);
        const pasteEvent = new ClipboardEvent("paste", {
            clipboardData: dataTransfer,
            bubbles: true,
            cancelable: true,
        });
        el.dispatchEvent(pasteEvent);
    };

    const mountSidebarApp = (container) => {
        const root = createRoot(container);
        root.render(
            React.createElement(SidebarApp, {
                onFileSelect: handleFileSelection,
                onToggleDocument: handleToggleDocument,
                onRemoveDocument: handleRemoveDocument,
                onResultClick: (text) => writeBack(getWriteBackText(text)),
                onThrottleChange: handleThrottleChange,
            }),
        );
    };

    const injectUI = () => {
        if (
            targetDoc.getElementById("my-autocomplete-popup") ||
            !targetDoc.body
        ) {
            return;
        }

        const popup = targetDoc.createElement("div");
        popup.id = "my-autocomplete-popup";

        const rootContainer = targetDoc.createElement("div");
        rootContainer.id = "my-autocomplete-popup-root";
        rootContainer.style.display = "flex";
        rootContainer.style.gap = "5px";
        rootContainer.style.flexDirection = "column";
        rootContainer.style.height = "100%";

        popup.appendChild(rootContainer);

        targetDoc.body.appendChild(popup);
        mountSidebarApp(rootContainer);
    };

    const requestSearchResults = async (query) => {
        sidebarStore.update((state) => {
            state.search.loading = true;
            state.search.hasSearched = true;
        });
        const searchVersion = searchSession.issue();
        try {
            const response = await safeSendMessage({
                type: MSG.AI_SEARCH_REQUEST,
                query,
            });
            if (!searchSession.canRender(searchVersion)) return;
            searchSession.markRendered(searchVersion);

            if (response?.error) {
                console.error("AI search failed:", response.error);
                clearSearchResults();
                return;
            }

            if (!response?.matches) {
                clearSearchResults();
                return;
            }
            console.log("query", query);

            renderSearchResults(response.matches);
        } catch (error) {
            if (!searchSession.canRender(searchVersion)) return;
            searchSession.markRendered(searchVersion);
            console.error("AI search request failed:", error);
            clearSearchResults();
        }
    };

    const createThrottledRequestSearchResults = (wait) =>
        asyncThrottle(requestSearchResults, {
            wait,
            leading: true,
            trailing: true,
        });

    const syncThrottleDelay = (wait) => {
        throttledRequestSearchResults?.cancel?.();
        throttledRequestSearchResults = createThrottledRequestSearchResults(
            wait,
        );
    };

    const resetPendingSearch = () => {
        throttledRequestSearchResults.cancel?.();
        searchSession.invalidate();
        sidebarStore.update((state) => {
            state.search.hasSearched = false;
        });
        clearSearchResults();
    };

    const handleThrottleChange = (throttleMs) => {
        sidebarStore.setState({ throttleMs });
        syncThrottleDelay(throttleMs);
        if (shadowBuffer.length <= 2) {
            resetPendingSearch();
            return;
        }
        void updateUI();
    };

    const updateUI = async () => {
        sidebarStore.update((state) => {
            state.previewText = shadowBuffer;
            if (shadowBuffer.length > 0) {
                state.panels.configOpen = false;
            }
        });

        if (shadowBuffer.length <= 2) {
            resetPendingSearch();
            return;
        }

        await throttledRequestSearchResults(shadowBuffer);
    };

    const correctedSync = (el) => {
        if (!el.editContext) return;
        const ctx = el.editContext;
        const txt = ctx.text || "";
        const pos = ctx.selectionStart || 0;
        const start = txt.lastIndexOf("\n", pos - 1) + 1;
        let end = txt.indexOf("\n", pos);
        if (end === -1) end = txt.length;
        shadowBuffer = txt.substring(start, end);
        shadowCursor = pos - start;
        updateUI();
    };

    const op = {
        insert: (text) => {
            shadowBuffer =
                shadowBuffer.slice(0, shadowCursor) +
                text +
                shadowBuffer.slice(shadowCursor);
            shadowCursor += text.length;
            updateUI();
        },
        backspace: () => {
            if (shadowCursor > 0) {
                shadowBuffer =
                    shadowBuffer.slice(0, shadowCursor - 1) +
                    shadowBuffer.slice(shadowCursor);
                shadowCursor--;
                updateUI();
            }
        },
        clearAll: () => {
            shadowBuffer = "";
            shadowCursor = 0;
            updateUI();
        },
        deleteCurrentLine: () => {
            if (!shadowBuffer.length) return;

            const lineStart =
                shadowBuffer.lastIndexOf("\n", Math.max(0, shadowCursor - 1)) +
                1;
            let lineEnd = shadowBuffer.indexOf("\n", shadowCursor);

            if (lineEnd === -1) {
                lineEnd = shadowBuffer.length;
            }

            shadowBuffer =
                shadowBuffer.slice(0, lineStart) + shadowBuffer.slice(lineEnd);
            shadowCursor = lineStart;

            updateUI();
        },
        newline: () => {
            shadowBuffer =
                shadowBuffer.slice(0, shadowCursor) +
                "\n" +
                shadowBuffer.slice(shadowCursor);
            shadowCursor += 1;
            updateUI();
        },
        move: (key) => {
            if (key === "ArrowLeft") {
                shadowCursor = Math.max(0, shadowCursor - 1);
            }
            if (key === "ArrowRight") {
                shadowCursor = Math.min(shadowBuffer.length, shadowCursor + 1);
            }
            updateUI();
        },
    };

    function attachListeners(el) {
        if (el.__v57_ai_hooked) return;
        el.__v57_ai_hooked = true;

        el.addEventListener(
            "keydown",
            (event) => {
                if (event.code === "AltRight") {
                    event.preventDefault();
                    event.stopImmediatePropagation();
                    isPopupOpen = !isPopupOpen;
                    targetDoc
                        .getElementById("my-autocomplete-popup")
                        .classList.toggle("visible", isPopupOpen);
                    if (isPopupOpen) correctedSync(el);
                    return;
                }

                if (
                    (event.metaKey || event.ctrlKey) &&
                    event.key.toLowerCase() === "a"
                ) {
                    isAllSelected = true;
                    return;
                }

                if (event.keyCode !== 229) {
                    if (event.key === "Escape") {
                        op.clearAll();
                        isAllSelected = false;
                    } else if (
                        event.key === "Backspace" ||
                        event.key === "Delete"
                    ) {
                        if (isAllSelected) {
                            op.clearAll();
                            isAllSelected = false;
                        } else if (event.metaKey || event.ctrlKey) {
                            op.deleteCurrentLine();
                            isAllSelected = false;
                        } else {
                            op.backspace();
                        }
                    } else if (event.key === "Enter") {
                        op.newline();
                        isAllSelected = false;
                    } else if (
                        ["ArrowLeft", "ArrowRight"].includes(event.key)
                    ) {
                        op.move(event.key);
                        isAllSelected = false;
                    } else if (
                        event.key.length === 1 &&
                        !event.ctrlKey &&
                        !event.metaKey
                    ) {
                        op.insert(event.key);
                        isAllSelected = false;
                    }
                }
            },
            true,
        );

        if (el.editContext) {
            el.editContext.addEventListener("textupdate", (event) => {
                const text = event.updateText || event.text;
                if (text && /[^\x00-\xff]/.test(text)) {
                    op.insert(text);
                    isAllSelected = false;
                }
            });
        }

        el.addEventListener("mouseup", () => {
            setTimeout(() => {
                correctedSync(el);
                isAllSelected = false;
            }, 50);
        });
    }

    injectUI();
    syncThrottleDelay(sidebarStore.getState().throttleMs);
    loadDocuments();
    setInterval(() => {
        const target = document.querySelector(SEL);
        if (target) attachListeners(target);
    }, 1000);
    if (isExtensionContextAlive()) {
        chrome.runtime.onMessage.addListener(handleIndexingStatus);
    }
})();
