import { createContext } from "react";
export const globalDataContext = createContext<{
    logToUI: (...args: any[]) => void,
    queueMessagesForReloads: (...args: any[]) => void,
    getUserId: () => string,
    isDebugMode: () => boolean,
    isNonDesktopDevice: boolean,
    serverUrl: string
}>({
    logToUI: (...args: any[]) => {},
    queueMessagesForReloads: (...args: any[]) => {},
    getUserId: () => '',
    isDebugMode: () => false,
    isNonDesktopDevice: false,
    serverUrl: ""
});
