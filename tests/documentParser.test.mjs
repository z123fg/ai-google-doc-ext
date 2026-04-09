import test from "node:test";
import assert from "node:assert/strict";
import { parseOutlineRows } from "../src/documentParser.mjs";

test("parseOutlineRows converts outline text into question/answer rows", () => {
    const rows = parseOutlineRows(`
* What is Node.js?
   * Single-threaded for main JS execution
   * Uses libuv for async work
* What is a stream?
   * Data flows in chunks
`);

    assert.deepEqual(rows, [
        {
            question: "What is Node.js?",
            answer: "- Single-threaded for main JS execution\n- Uses libuv for async work",
        },
        {
            question: "What is a stream?",
            answer: "- Data flows in chunks",
        },
    ]);
});

test("parseOutlineRows strips first answer indent but keeps deeper indent", () => {
    const [row] = parseOutlineRows(`
* What is event emitter?
   * Common in streams
      * on()
      * emit()
`);

    assert.equal(
        row.answer,
        "- Common in streams\n   - on()\n   - emit()",
    );
});

test("parseOutlineRows ignores blank lines and leading BOM", () => {
    const [row] = parseOutlineRows(`\uFEFF* What is buffer?

   * Raw binary data

   * Common in file and network I/O
`);

    assert.equal(
        row.answer,
        "- Raw binary data\n- Common in file and network I/O",
    );
});

test("parseOutlineRows throws when there are no top-level questions", () => {
    assert.throws(
        () => parseOutlineRows("just some loose text"),
        /top-level '\* question' entry/,
    );
});
