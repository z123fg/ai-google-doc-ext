export const NORMALIZATION_GROUPS = [
    ["javascript", "js"],
    ["typescript", "ts"],
    ["node.js", "nodejs", "node js"],
    ["next.js", "nextjs", "next js"],
    ["react", "reactjs", "react js"],
    ["kubernetes", "k8s"],
    ["database", "db"],
    ["frontend", "fe", "front end"],
    ["backend", "be", "back end"],
    ["user interface", "ui"],
    ["user experience", "ux"],
    ["authentication", "auth"],
    ["infrastructure", "infra"],
];

function escapeRegExp(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function buildBoundaryPattern(term) {
    return new RegExp(
        `(^|[^a-z0-9.])(${escapeRegExp(term.toLowerCase())})(?=$|[^a-z0-9])`,
        "gi",
    );
}

function collectCanonicalMatches(text) {
    const matches = [];

    for (const [canonical, ...variants] of NORMALIZATION_GROUPS) {
        for (const variant of variants) {
            const pattern = buildBoundaryPattern(variant);

            for (const match of text.matchAll(pattern)) {
                const prefix = match[1] ?? "";
                const matchedText = match[2];
                const start = (match.index ?? 0) + prefix.length;
                const end = start + matchedText.length;

                matches.push({
                    start,
                    end,
                    canonical,
                    length: end - start,
                });
            }
        }
    }

    const selectedMatches = [];

    for (const candidate of matches.sort((a, b) => {
        if (b.length !== a.length) return b.length - a.length;
        return a.start - b.start;
    })) {
        const overlaps = selectedMatches.some(
            (selected) =>
                candidate.start < selected.end && candidate.end > selected.start,
        );

        if (!overlaps) {
            selectedMatches.push(candidate);
        }
    }

    return selectedMatches.sort((a, b) => a.start - b.start);
}

export function collectCanonicalTerms(text) {
    const seen = new Set();
    const canonicalTerms = [];

    for (const match of collectCanonicalMatches(text)) {
        if (seen.has(match.canonical)) continue;
        seen.add(match.canonical);
        canonicalTerms.push(match.canonical);
    }

    return canonicalTerms;
}

export function expandQueryText(text) {
    const canonicalTerms = collectCanonicalTerms(text);

    if (!canonicalTerms.length) return text;

    return `${text} (${canonicalTerms.join(", ")})`;
}

export function formatDocumentText(question, answer) {
    const normalizedQuestion = question.trim();
    const normalizedAnswer = answer.trim();

    if (!normalizedAnswer) return normalizedQuestion;
    return `${normalizedQuestion}: ${normalizedAnswer}`;
}

export function expandDocumentText(question, answer) {
    const canonicalTerms = collectCanonicalTerms(question);

    if (!canonicalTerms.length) {
        return formatDocumentText(question, answer);
    }

    const expandedQuestion = `${question.trim()} (${canonicalTerms.join(", ")})`;
    return formatDocumentText(expandedQuestion, answer);
}
