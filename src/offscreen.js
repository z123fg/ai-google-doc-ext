// src/offscreen.js
import { env, pipeline } from "@huggingface/transformers";
import Papa from "papaparse";
import { db } from "./db.js";
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

function parseCsvRows(text) {
    const result = Papa.parse(text, {
        header: true,
        skipEmptyLines: "greedy",
        transformHeader: (header) =>
            header.replace(/^\uFEFF/, "").trim().toLowerCase(),
    });

    if (result.errors.length) {
        const [firstError] = result.errors;
        throw new Error(`CSV parse failed: ${firstError.message}`);
    }

    const rows = (result.data || [])
        .map((row) => ({
            question: String(row.question ?? "").trim(),
            answer: String(row.answer ?? "").trim(),
        }))
        .filter((row) => row.question || row.answer);

    if (!rows.length) {
        throw new Error(
            "CSV must include at least one row with question or answer data.",
        );
    }

    const fields = result.meta.fields || [];
    const hasQuestionField = fields.includes("question");
    const hasAnswerField = fields.includes("answer");

    if (!hasQuestionField || !hasAnswerField) {
        throw new Error(
            'CSV must include "question" and "answer" columns.',
        );
    }

    return rows;
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

function buildMatches(queryVec, library) {
    return library
        .map((item) => ({
            text: item.text,
            documentId: item.documentId,
            documentName: item.documentName,
            score: getSemanticScore(queryVec, item.vector),
        }))
        .sort((a, b) => b.score - a.score)
        .slice(0, 10);
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
    return buildMatches(output.data, library);
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
    const rawChunks = parseCsvRows(msg.text);
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
