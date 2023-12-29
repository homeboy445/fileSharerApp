const isObject = (element: any): boolean => {
  return element && !Array.isArray(element) && typeof element === 'object';
}

export const cloneObject = (targetObject: { [props: string]: any }): ({ [props: string]: any }) => {
  const clone = Object.assign({}, targetObject);
  for (const key in clone) {
    if (isObject(clone[key])) {
      clone[key] = cloneObject(clone[key]);
    }
  }
  return clone;
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
