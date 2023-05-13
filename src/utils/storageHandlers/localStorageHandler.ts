
// class LocalStorageManager {
//     flushExpiredKeys() {
//         Object.keys(localStorage).forEach((key) => {
//             const storageTiming = Number(localStorage.getItem(key));
//             if (typeof storageTiming !== "number" || ((Date.now() - storageTiming) / 1000) > 600) {
//             }
//         })
//     }
// }

export default {};
