export const fetchIpAddress = async () => {
    return fetch("https://geolocation-db.com/json/")
    .then(response => {
      if (response.status >= 400) {
        throw false;
      }
      return response;
    })
    .then(response => response.text())
    .then(response => JSON.parse(response))
    .then(({ IPv4 }) => IPv4)
    .catch(() => '-1');
}

class BrowserAPIWrapper {

  timeoutStore: { [id: number]: NodeJS.Timeout } = {};

  /**
   * This is a wrapper function over the native setTimeout function & this will auto-clear the previous
   * setTimeout if the previously invoked one is not complete while a new one is invoked. Note, it will only
   * clear the timeout for the unique id passed to the params.
   */
  public selfClearingTimeOut(callback: (...args: any[]) => void, timeout: number, id: number) {
    if (this.timeoutStore[id]) {
      // console.log("clearing the TIMEOUT for id: ", id);
      clearTimeout(this.timeoutStore[id]);
    }
    this.timeoutStore[id] = setTimeout(callback, timeout);
  }
}

export const apiWrapper = new BrowserAPIWrapper();
