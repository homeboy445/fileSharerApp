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
