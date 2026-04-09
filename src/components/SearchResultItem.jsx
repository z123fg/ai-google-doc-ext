import React from "react";

function splitQuestionAndAnswer(text) {
    const separatorIndex = text.indexOf(":");

    if (separatorIndex < 0) {
        return {
            question: text,
            answer: "",
        };
    }

    return {
        question: text.slice(0, separatorIndex).trim(),
        answer: text.slice(separatorIndex + 1).trim(),
    };
}

function renderHighlightedAnswer(answer, highlight) {
    if (!answer) return null;
    if (!highlight || !answer.includes(highlight)) {
        return <div className="search-item-answer">{answer}</div>;
    }

    const startIndex = answer.indexOf(highlight);
    const before = answer.slice(0, startIndex);
    const after = answer.slice(startIndex + highlight.length);

    return (
        <div className="search-item-answer">
            {before}
            <mark className="search-item-highlight">{highlight}</mark>
            {after}
        </div>
    );
}

export function SearchResultItem({ match, onClick }) {
    const { question, answer } = splitQuestionAndAnswer(match.text);

    return (
        <div className="search-item" onClick={() => onClick(match.text)}>
            <div className="search-item-question">
                [{Math.round(match.score * 100)}%] {question}
            </div>
            {renderHighlightedAnswer(answer, match.highlight)}
        </div>
    );
}
