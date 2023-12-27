import { createContext } from "react";
export const globalDataContext = createContext<{
    logToUI: (...args: any[]) => void,
    queueMessagesForReloads: (...args: any[]) => void,
    getUserId: () => string,
    isDebugMode: () => boolean,
    isNonDesktopDevice: boolean,
    serverUrl: string,
    isInitiator: boolean,
    currentTransmissionMode: 1 | 2, // 1 -> P2P, 2 -> SERVER
}>({
    logToUI: (...args: any[]) => {},
    queueMessagesForReloads: (...args: any[]) => {},
    getUserId: () => '',
    isDebugMode: () => false,
    isNonDesktopDevice: false,
    serverUrl: "",
    isInitiator: false,
    currentTransmissionMode: 1
});
