// src/offscreen.js
import { env, pipeline } from "@huggingface/transformers";
import { db } from "./db.js";
import { parseOutlineRows } from "./documentParser.mjs";
import { MSG, TARGET } from "./messages.js";
import {
    expandDocumentText,
    expandQueryText,
    formatDocumentText,
} from "./normalization.mjs";

env.allowLocalModels = true;
env.backends.onnx.wasm.wasmPaths = chrome.runtime.getURL("transformers-bin/");

const EMBEDDING_MODEL = "BAAI/bge-base-en-v1.5";
let embedder;
let embedderPromise;

function sendStatus(status, progress = null) {
    chrome.runtime.sendMessage({
        type: MSG.INDEXING_STATUS,
        target: TARGET.BACKGROUND,
        status,
        progress,
    });
}

function createDocumentId() {
    if (globalThis.crypto?.randomUUID) {
        return globalThis.crypto.randomUUID();
    }
    return `doc-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function getSemanticScore(queryVec, vector) {
    return queryVec.reduce((acc, v, i) => acc + v * vector[i], 0);
}

function splitQuestionAndAnswer(text) {
    const separatorIndex = text.indexOf(":");

    if (separatorIndex < 0) {
        return {
            question: text.trim(),
            answer: "",
        };
    }

    return {
        question: text.slice(0, separatorIndex).trim(),
        answer: text.slice(separatorIndex + 1).trim(),
    };
}

function splitAnswerClauses(answer) {
    return answer
        .split("\n")
        .flatMap((line) =>
            line
                .split(/(?<=[.!?;:])\s+/)
                .map((part) => part.trim())
                .filter(Boolean),
        )
        .map((part) => part.replace(/^-+\s*/, "").trim())
        .filter((part) => part.length >= 8);
}

function buildMatches(queryVec, library) {
    return library
        .map((item) => ({
            text: item.text,
            documentId: item.documentId,
            documentName: item.documentName,
            score: getSemanticScore(queryVec, item.vector),
        }))
        .sort((a, b) => b.score - a.score)
        .slice(0, 4);
}

async function findBestAnswerHighlight(pipe, queryVec, text) {
    const { answer } = splitQuestionAndAnswer(text);
    const clauses = splitAnswerClauses(answer);

    if (!clauses.length) return "";

    const outputs = await Promise.all(
        clauses.map((clause) => runEmbedding(pipe, clause)),
    );

    let bestClause = "";
    let bestScore = Number.NEGATIVE_INFINITY;

    outputs.forEach((output, index) => {
        const score = getSemanticScore(queryVec, output.data);
        if (score > bestScore) {
            bestScore = score;
            bestClause = clauses[index];
        }
    });

    return bestClause;
}

async function addAnswerHighlights(pipe, queryVec, matches) {
    const enriched = await Promise.all(
        matches.map(async (match, index) => ({
            ...match,
            highlight: await findBestAnswerHighlight(pipe, queryVec, match.text),
        })),
    );

    return enriched;
}

function toChunkRecords(outputs, batch, documentRecord, startIndex) {
    return batch.map((row, index) => ({
        id: `${documentRecord.id}:${startIndex + index}`,
        documentId: documentRecord.id,
        documentName: documentRecord.name,
        text: formatDocumentText(row.question, row.answer),
        vector: Array.from(outputs[index].data),
    }));
}

function calculateIndexingProgress(doneCount, totalCount) {
    return 15 + Math.round((doneCount / totalCount) * 85);
}

async function createEmbedderFor(device) {
    return pipeline("feature-extraction", EMBEDDING_MODEL, { device });
}

async function createEmbedder() {
    sendStatus("Loading embedding model...", 5);

    try {
        return await createEmbedderFor("webgpu");
    } catch (error) {
        console.warn("WebGPU backend init failed, falling back to WASM:", error);
        sendStatus("WebGPU unavailable, falling back to WASM...", 10);
        return createEmbedderFor("wasm");
    }
}

async function getEmbedder() {
    if (embedder) return embedder;

    if (!embedderPromise) {
        embedderPromise = createEmbedder()
            .then((instance) => {
                embedder = instance;
                sendStatus("Embedding model ready", 15);
                return instance;
            })
            .catch((error) => {
                embedderPromise = null;
                sendStatus("Embedding model load failed", null);
                throw error;
            });
    }

    return embedderPromise;
}

async function runEmbedding(pipe, text) {
    return pipe(text, { pooling: "mean", normalize: true });
}

async function buildSemanticMatches(pipe, query, library) {
    const output = await runEmbedding(pipe, query);
    const queryVec = output.data;
    const matches = buildMatches(queryVec, library);
    return addAnswerHighlights(pipe, queryVec, matches);
}

async function handleSearchRequest(msg) {
    const library = await db.getEnabledChunks();
    const pipe = await getEmbedder();
    const query = expandQueryText(msg.query.trim());
    const matches = await buildSemanticMatches(pipe, query, library);

    return { matches };
}

async function handleGetDocumentsRequest() {
    return {
        documents: await db.getDocuments(),
    };
}

async function handleToggleDocumentRequest(msg) {
    await db.setDocumentEnabled(msg.documentId, msg.enabled);
    return {
        documents: await db.getDocuments(),
    };
}

async function handleRemoveDocumentRequest(msg) {
    await db.removeDocument(msg.documentId);
    return {
        documents: await db.getDocuments(),
    };
}

async function handleIndexingRequest(msg) {
    sendStatus("Preparing AI...", 0);

    const sourceName = msg.sourceName || "Unnamed document";
    const rawChunks = parseOutlineRows(msg.text);
    const batchSize = 10;
    const pipe = await getEmbedder();
    const existingDocument = await db.getDocumentByName(sourceName);
    const documentRecord = {
        id: existingDocument?.id || createDocumentId(),
        name: sourceName,
        enabled: true,
        chunkCount: rawChunks.length,
        updatedAt: Date.now(),
    };
    const chunkRecords = [];

    sendStatus("Indexing document...", 15);

    for (let i = 0; i < rawChunks.length; i += batchSize) {
        const batch = rawChunks.slice(i, i + batchSize);
        const outputs = await Promise.all(
            batch.map((row) =>
                runEmbedding(
                    pipe,
                    expandDocumentText(row.question, row.answer),
                ),
            ),
        );
        chunkRecords.push(...toChunkRecords(outputs, batch, documentRecord, i));

        sendStatus(
            "Indexing document...",
            calculateIndexingProgress(
                Math.min(i + batch.length, rawChunks.length),
                rawChunks.length,
            ),
        );
    }

    await db.replaceDocument(documentRecord, chunkRecords);

    sendStatus("Indexing complete", 100);
    return {
        success: true,
        documents: await db.getDocuments(),
    };
}

function toErrorResponse(error) {
    return {
        error: error instanceof Error ? error.message : String(error),
    };
}

async function handleOffscreenMessage(msg) {
    if (msg.target !== TARGET.OFFSCREEN) return null;

    if (msg.type === MSG.AI_SEARCH_REQUEST) {
        return handleSearchRequest(msg);
    }

    if (msg.type === MSG.GET_DOCUMENTS) {
        return handleGetDocumentsRequest();
    }

    if (msg.type === MSG.START_INDEXING) {
        return handleIndexingRequest(msg);
    }

    if (msg.type === MSG.TOGGLE_DOCUMENT) {
        return handleToggleDocumentRequest(msg);
    }

    if (msg.type === MSG.REMOVE_DOCUMENT) {
        return handleRemoveDocumentRequest(msg);
    }

    return { error: `Unsupported message type: ${msg.type}` };
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    handleOffscreenMessage(msg)
        .then((response) => {
            if (response !== null) {
                sendResponse(response);
            }
        })
        .catch((error) => {
            console.error("Offscreen processing failed:", error);
            sendResponse(toErrorResponse(error));
        });

    return true;
});
