
declare global {
    interface Window {
        fl_store: { logs: string[], warnings: string[], errors: string[] };
    }
};
