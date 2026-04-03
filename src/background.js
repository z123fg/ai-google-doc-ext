import { MSG, TARGET } from "./messages.js";

async function ensureOffscreen() {
    const existing = await chrome.runtime.getContexts({
        contextTypes: ["OFFSCREEN_DOCUMENT"],
    });
    if (existing.length > 0) return;
    await chrome.offscreen.createDocument({
        url: "src/offscreen.html",
        reasons: ["WORKERS"],
        justification: "AI Vector Search",
    });
}

let indexingTarget = null;

function toErrorResponse(error) {
    return {
        error: error instanceof Error ? error.message : String(error),
    };
}

function isStatusRelayMessage(msg) {
    return msg.type === MSG.INDEXING_STATUS && msg.target === TARGET.BACKGROUND;
}

function rememberIndexingTarget(sender) {
    if (!sender.tab?.id) return;
    indexingTarget = {
        tabId: sender.tab.id,
        frameId: sender.frameId,
    };
}

async function relayIndexingStatus(msg) {
    if (!indexingTarget?.tabId) return { delivered: false };

    await chrome.tabs.sendMessage(
        indexingTarget.tabId,
        {
            type: MSG.INDEXING_STATUS,
            status: msg.status,
            progress: msg.progress,
        },
        typeof indexingTarget.frameId === "number"
            ? { frameId: indexingTarget.frameId }
            : undefined,
    );

    return { delivered: true };
}

async function forwardToOffscreen(msg) {
    await ensureOffscreen();
    return chrome.runtime.sendMessage({
        target: TARGET.OFFSCREEN,
        ...msg,
    });
}

async function handleRuntimeMessage(msg, sender) {
    if (isStatusRelayMessage(msg)) {
        return relayIndexingStatus(msg);
    }

    if (msg.type === MSG.START_INDEXING) {
        rememberIndexingTarget(sender);
    }

    return forwardToOffscreen(msg);
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    handleRuntimeMessage(msg, sender)
        .then(sendResponse)
        .catch((error) => {
            console.error("Background message bridge failed:", error);
            sendResponse(toErrorResponse(error));
        });

    return true; // Keep channel open
});
