/**
 * Helps in managing cookies.
 */
class CookieManager {
    constructor() {}
    get(key: string): string {
        const regex = new RegExp(`(?:(?:^|.*;\\s*)${key}\\s*\\=\\s*([^;]*).*$)|^.*$`);
        return document.cookie.replace(regex, "$1");
    }
    /**
     * sets the cookie value, default expiry is 1h.
     * @param key 
     * @param value 
     * @param expireAfter 
     */
    set(key: string, value: string, expireAfter = 60 * 60 * 1000) {
        const expirationDate = new Date();
        expirationDate.setTime(expirationDate.getTime() + expireAfter);
        window.document.cookie = `${key}=${value}; expires=${expirationDate.toUTCString()}`;
    }
    getAll() {
        return window.document.cookie.split(";").reduce((cookieObj: { [key: string]: string }, currValue) => {
            const [name, value] = currValue.split("=").map(i => i.trim());
            cookieObj[name] = value;
            return cookieObj;
        }, {});
    }
    delete(key: string) {
        window.document.cookie = `${key}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
    }
}

export default new CookieManager();
