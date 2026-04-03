import fs from "node:fs";
import path from "node:path";

function usage() {
    console.error(
        "Usage: node scripts/outline_to_csv.mjs <input.txt> [output.csv]",
    );
    process.exit(1);
}

function getIndentWidth(line) {
    let width = 0;
    for (const char of line) {
        if (char === " ") {
            width += 1;
        } else if (char === "\t") {
            width += 4;
        } else {
            break;
        }
    }
    return width;
}

function stripBom(text) {
    return text.replace(/^\uFEFF/, "");
}

function parseBulletContent(line) {
    const match = line.match(/^(\s*)\*\s?(.*)$/);
    if (!match) return null;
    return {
        indent: getIndentWidth(match[1]),
        content: match[2].trimEnd(),
    };
}

function findQuestionIndent(lines) {
    const bulletIndents = lines
        .map((line) => parseBulletContent(line))
        .filter(Boolean)
        .map((item) => item.indent);

    if (!bulletIndents.length) {
        throw new Error("No bullet lines found in input.");
    }

    return Math.min(...bulletIndents);
}

function normalizeAnswerLine(line, baseIndent) {
    const currentIndent = getIndentWidth(line);
    const relativeIndent = Math.max(0, currentIndent - baseIndent);
    const trimmed = line.trimStart();
    const content = trimmed.startsWith("* ") ? trimmed.slice(2) : trimmed;

    return `${" ".repeat(relativeIndent)}${content.trimEnd()}`;
}

function toRows(text) {
    const lines = stripBom(text).split(/\r?\n/);
    const questionIndent = findQuestionIndent(lines);
    const rows = [];

    let currentQuestion = null;
    let answerLines = [];
    let answerBaseIndent = null;
    function flushCurrent() {
        if (!currentQuestion) return;
        rows.push({
            question: currentQuestion.trim(),
            answer: answerLines.join("\n").trimEnd(),
        });
        currentQuestion = null;
        answerLines = [];
        answerBaseIndent = null;
    }

    for (const line of lines) {
        if (!line.trim()) {
            if (currentQuestion && answerLines.length) {
                answerLines.push("");
            }
            continue;
        }

        const bullet = parseBulletContent(line);

        if (bullet && bullet.indent === questionIndent) {
            flushCurrent();
            currentQuestion = bullet.content.trim();
            continue;
        }

        if (!currentQuestion) {
            continue;
        }

        if (answerBaseIndent === null) {
            answerBaseIndent = getIndentWidth(line);
        }

        answerLines.push(normalizeAnswerLine(line, answerBaseIndent));
    }

    flushCurrent();

    if (!rows.length) {
        throw new Error("No question/answer rows were parsed.");
    }

    return rows;
}

function csvEscape(value) {
    const text = String(value ?? "");
    if (/[",\n\r]/.test(text)) {
        return `"${text.replace(/"/g, '""')}"`;
    }
    return text;
}

function toCsv(rows) {
    const header = "question,answer";
    const body = rows
        .map((row) => [csvEscape(row.question), csvEscape(row.answer)].join(","))
        .join("\n");
    return `${header}\n${body}\n`;
}

function main() {
    const [, , inputPath, outputPathArg] = process.argv;
    if (!inputPath) usage();

    const outputPath =
        outputPathArg ||
        path.join(
            path.dirname(inputPath),
            `${path.basename(inputPath, path.extname(inputPath))}.csv`,
        );

    const inputText = fs.readFileSync(inputPath, "utf8");
    const rows = toRows(inputText);
    const csvText = toCsv(rows);

    fs.writeFileSync(outputPath, csvText, "utf8");
    console.log(`Wrote ${rows.length} rows to ${outputPath}`);
}

main();
