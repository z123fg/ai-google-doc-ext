import test from "node:test";
import assert from "node:assert/strict";
import {
    buildBoundaryPattern,
    collectCanonicalTerms,
    expandDocumentText,
    formatDocumentText,
    expandQueryText,
} from "../src/normalization.mjs";

test("buildBoundaryPattern matches alias with punctuation boundaries", () => {
    const pattern = buildBoundaryPattern("js");

    assert.equal(pattern.test("js)"), true);
    pattern.lastIndex = 0;
    assert.equal(pattern.test("(js"), true);
    pattern.lastIndex = 0;
    assert.equal(pattern.test("learn js fast"), true);
});

test("buildBoundaryPattern does not match alias inside longer alphanumeric words", () => {
    const pattern = buildBoundaryPattern("js");

    assert.equal(pattern.test("json"), false);
    pattern.lastIndex = 0;
    assert.equal(pattern.test("myjsontool"), false);
});

test("collectCanonicalTerms finds simple shorthand canonical terms", () => {
    assert.deepEqual(collectCanonicalTerms("js promise"), ["javascript"]);
    assert.deepEqual(collectCanonicalTerms("ts basics"), ["typescript"]);
    assert.deepEqual(collectCanonicalTerms("k8s deployment"), ["kubernetes"]);
});

test("collectCanonicalTerms handles punctuation-wrapped aliases", () => {
    assert.deepEqual(collectCanonicalTerms("(js)"), ["javascript"]);
    assert.deepEqual(collectCanonicalTerms("ui/ux"), [
        "user interface",
        "user experience",
    ]);
});

test("collectCanonicalTerms handles known compound variants", () => {
    assert.deepEqual(collectCanonicalTerms("nodejs streams"), ["node.js"]);
    assert.deepEqual(collectCanonicalTerms("next js routing"), ["next.js"]);
    assert.deepEqual(collectCanonicalTerms("reactjs hooks"), ["react"]);
});

test("collectCanonicalTerms handles multiple independent aliases in one string", () => {
    assert.deepEqual(collectCanonicalTerms("js with k8s and db"), [
        "javascript",
        "kubernetes",
        "database",
    ]);
});

test("collectCanonicalTerms prefers longest non-overlapping match", () => {
    assert.deepEqual(collectCanonicalTerms("node js"), ["node.js"]);
    assert.deepEqual(collectCanonicalTerms("front end team"), ["frontend"]);
});

test("collectCanonicalTerms avoids cascading replacement corruption", () => {
    assert.deepEqual(collectCanonicalTerms("react.js"), []);
    assert.deepEqual(collectCanonicalTerms("nextjs uses js"), [
        "next.js",
        "javascript",
    ]);
});

test("collectCanonicalTerms preserves unrelated text", () => {
    assert.deepEqual(collectCanonicalTerms("java immutable"), []);
    assert.deepEqual(collectCanonicalTerms("support experience"), []);
});

test("expandQueryText appends canonical terms after the original query", () => {
    assert.equal(expandQueryText("js promise"), "js promise (javascript)");
    assert.equal(
        expandQueryText("ui/ux review"),
        "ui/ux review (user interface, user experience)",
    );
});

test("expandDocumentText appends canonical terms after the question only", () => {
    assert.equal(
        expandDocumentText("what is js", "a language"),
        "what is js (javascript): a language",
    );
    assert.equal(
        expandDocumentText("nodejs streams", ""),
        "nodejs streams (node.js)",
    );
});

test("formatDocumentText joins question and multiline answer with the first colon", () => {
    assert.equal(
        formatDocumentText("what is js", "line one\nline two"),
        "what is js: line one\nline two",
    );
});
