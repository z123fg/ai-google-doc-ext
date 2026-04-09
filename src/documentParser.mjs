function normalizeNewlines(text) {
    return text.replace(/\r\n?/g, "\n").replace(/^\uFEFF/, "");
}

function toAnswerBullet(line, baseIndent) {
    const match = line.match(/^(\s*)\*\s+(.*)$/);

    if (!match) return null;

    const indent = match[1].length;
    const content = match[2].trim();

    if (!content) return null;

    const relativeIndent = Math.max(0, indent - baseIndent);
    return `${" ".repeat(relativeIndent)}- ${content}`;
}

export function parseOutlineRows(text) {
    const lines = normalizeNewlines(text).split("\n");
    const rows = [];
    let currentQuestion = "";
    let answerLines = [];
    let firstAnswerIndent = null;

    const flushRow = () => {
        if (!currentQuestion) return;

        rows.push({
            question: currentQuestion.trim(),
            answer: answerLines.join("\n").trimEnd(),
        });

        currentQuestion = "";
        answerLines = [];
        firstAnswerIndent = null;
    };

    for (const rawLine of lines) {
        const questionMatch = rawLine.match(/^\*\s+(.*)$/);

        if (questionMatch) {
            flushRow();
            currentQuestion = questionMatch[1].trim();
            continue;
        }

        if (!currentQuestion) {
            continue;
        }

        if (!rawLine.trim()) {
            continue;
        }

        const answerMatch = rawLine.match(/^(\s*)\*\s+(.*)$/);

        if (!answerMatch) {
            continue;
        }

        if (firstAnswerIndent === null) {
            firstAnswerIndent = answerMatch[1].length;
        }

        const bulletLine = toAnswerBullet(rawLine, firstAnswerIndent);

        if (bulletLine) {
            answerLines.push(bulletLine);
        }
    }

    flushRow();

    const normalizedRows = rows.filter((row) => row.question || row.answer);

    if (!normalizedRows.length) {
        throw new Error(
            "Text document must include at least one top-level '* question' entry.",
        );
    }

    return normalizedRows;
}
