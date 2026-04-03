import React, { useState } from "react";

export function Panel({
    title,
    summary,
    defaultOpen = true,
    open: controlledOpen,
    onToggle,
    children,
}) {
    const [uncontrolledOpen, setUncontrolledOpen] = useState(defaultOpen);
    const open = controlledOpen ?? uncontrolledOpen;

    const handleToggle = () => {
        const nextOpen = !open;
        if (typeof controlledOpen !== "boolean") {
            setUncontrolledOpen(nextOpen);
        }
        onToggle?.(nextOpen);
    };

    return (
        <div className="panel">
            <button
                type="button"
                className="panel-header"
                onClick={handleToggle}
            >
                <span className="panel-title">{title}</span>
                <span className="panel-summary">{summary}</span>
                <span className={`panel-chevron ${open ? "open" : ""}`}>›</span>
            </button>
            <div className={`panel-body ${open ? "" : "closed"}`}>
                <div className="panel-body-inner">{children}</div>
            </div>
        </div>
    );
}
