import React from "react";

export function Button({ className = "", variant = "default", ...props }) {
    return (
        <button
            {...props}
            className={`ui-button ui-button-${variant} ${className}`.trim()}
        />
    );
}
