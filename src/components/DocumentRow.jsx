import React from "react";
import { Button } from "./Button.jsx";

export function DocumentRow({ document, onToggle, onRemove }) {
    return (
        <div className="document-row">
            <input
                type="checkbox"
                checked={Boolean(document.enabled)}
                onChange={(event) => onToggle(document.id, event.target.checked)}
            />
            <div className="document-label">{document.name}</div>
            <Button
                type="button"
                variant="ghost"
                className="document-remove"
                onClick={() => onRemove(document)}
            >
                Remove
            </Button>
        </div>
    );
}
