import React from "react";

export function SearchResultItem({ match, onClick }) {
    return (
        <div className="search-item" onClick={() => onClick(match.text)}>
            [{Math.round(match.score * 100)}%] {match.text}
        </div>
    );
}
