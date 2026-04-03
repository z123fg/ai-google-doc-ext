import React, { useEffect, useState } from "react";
import { DocumentRow } from "./components/DocumentRow.jsx";
import { Panel } from "./components/Panel.jsx";
import { SearchResultItem } from "./components/SearchResultItem.jsx";
import { sidebarStore } from "./sidebarStore.js";

export function SidebarApp({
    onFileSelect,
    onToggleDocument,
    onRemoveDocument,
    onResultClick,
    onThrottleChange,
}) {
    const [state, setState] = useState(sidebarStore.getState());

    useEffect(
        () => sidebarStore.subscribe((nextState) => setState({ ...nextState })),
        [],
    );

    const enabledCount = state.documents.filter(
        (document) => document.enabled,
    ).length;
    const configSummary = `${enabledCount}/${state.documents.length} enabled · ${state.throttleMs}ms`;
    const showEmptyState =
        state.previewText.trim().length > 2 &&
        state.search.hasSearched &&
        !state.search.loading &&
        !state.results.length;
    //console.log("test", state, showEmptyState);

    return (
        <>
            <div className="sidebar-title">实时搜索助手 (带回写功能)</div>

            <Panel
                title="Config"
                summary={configSummary}
                open={state.panels.configOpen}
                onToggle={(open) =>
                    sidebarStore.update((draft) => {
                        draft.panels.configOpen = open;
                    })
                }
            >
                <div className="config-group">
                    <div className="config-group-title">Upload Document</div>
                    <input
                        type="file"
                        accept=".csv,text/csv"
                        className="file-input"
                        onChange={(event) =>
                            onFileSelect(event.target.files?.[0])
                        }
                    />
                    <div className="file-name">{state.selectedFileName}</div>
                    <div className="indexing-status">{state.indexing.status}</div>
                    <div
                        className="indexing-bar-container"
                        style={{
                            display: state.indexing.visible ? "block" : "none",
                        }}
                    >
                        <div
                            className="indexing-bar-fill"
                            style={{ width: `${state.indexing.progress}%` }}
                        />
                    </div>
                </div>

                <div className="config-group">
                    <div className="config-group-header">
                        <div className="config-group-title">Throttle Delay</div>
                        <div className="throttle-value">
                            {state.throttleMs}ms
                        </div>
                    </div>
                    <input
                        type="range"
                        min="0"
                        max="2000"
                        step="100"
                        value={state.throttleMs}
                        className="throttle-slider"
                        onChange={(event) =>
                            onThrottleChange(Number(event.target.value))
                        }
                    />
                </div>

                <div className="config-group">
                <div className="document-section-title">Indexed Documents</div>
                <div className="document-list">
                    {state.documents.length ? (
                        state.documents.map((document) => (
                            <DocumentRow
                                key={document.id}
                                document={document}
                                onToggle={onToggleDocument}
                                onRemove={onRemoveDocument}
                            />
                        ))
                    ) : (
                        <div className="document-empty">
                            No indexed documents yet.
                        </div>
                    )}
                </div>
                </div>
            </Panel>

            <div className="line-preview">{state.previewText}</div>

            <div
                className={`search-res-list ${
                    state.search.loading ? "is-loading" : "is-ready"
                }`}
            >
                {showEmptyState ? (
                    <div className="results-placeholder">
                        No matching result yet. Keep typing or enable more
                        documents.
                    </div>
                ) : null}
                {state.results.map((match, index) => (
                    <SearchResultItem
                        key={`${match.text}-${index}`}
                        match={match}
                        onClick={onResultClick}
                    />
                ))}
            </div>
        </>
    );
}
