const listeners = new Set();

const state = {
    previewText: "",
    selectedFileName: "No file chosen",
    uploadSummary: "No file selected",
    documents: [],
    results: [],
    search: {
        loading: false,
        hasSearched: false,
    },
    indexing: {
        progress: 0,
        status: "",
        visible: false,
    },
    panels: {
        configOpen: true,
    },
    throttleMs: 400,
};

function emit() {
    listeners.forEach((listener) => listener(state));
}

export const sidebarStore = {
    getState() {
        return state;
    },

    setState(partial) {
        Object.assign(state, partial);
        emit();
    },

    update(updater) {
        updater(state);
        emit();
    },

    subscribe(listener) {
        listeners.add(listener);
        return () => listeners.delete(listener);
    },
};
