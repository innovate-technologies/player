export default class ConfigService {
  /*@ngInject*/
  constructor($http, $q) {
    this.getConfig = (username) => {
      if (!username) {
        return $q.reject();
      }
      return $http
        .get("https://itframe.unmutedte.ch/player/" + username)
        .then(response => response.data);
    };
    this.getTunein = (username) => {
      if (!username) {
        return $q.reject();
      }
      return $http
        .get("https://itframe.unmutedte.ch/tunein/" + username)
        .then(response => response.data);
    };
  }
}
