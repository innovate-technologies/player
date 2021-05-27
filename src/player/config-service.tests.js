/* global angular, inject */

describe("ConfigService", function () {
  beforeEach(angular.mock.module("player"));
  beforeEach(inject(function (ConfigService, $httpBackend) {
    this.service = ConfigService;
    this.$httpBackend = $httpBackend;
  }));

  describe("the service", function () {
    it("should provide a getConfig method", function () {
      expect(this.service.getConfig).toEqual(jasmine.any(Function));
    });
  });

  describe("getConfig", function () {
    it("should return a promise which resolves to the config", function () {
      const username = "opencast";
      const testResponse = {
        name: "OPENcast",
        autoPlay: false,
        backgroundColour: "#232a31",
        logo: "https://cdn.shoutca.st/iOS/opencast/logo.png",
        streamUrl: "https://opencast.radioca.st/streams/128kbps",
        tint: "#ffffff",
        username,
      };

      let config;
      this.$httpBackend.expectGET("https://itframe.unmutedte.ch/player/" + username).respond(200, testResponse);
      this.service.getConfig(username).then(function (_config_) {
        config = _config_;
      });
      this.$httpBackend.flush();
      expect(config).toEqual(jasmine.any(Object));
      expect(config.username).toBe(username);
    });
    it("should return a rejected promise if the server returns a 500", function () {
      const username = "doesnotexist";
      let calledFailureFn = false;
      this.$httpBackend.expectGET("https://itframe.unmutedte.ch/player/" + username).respond(500, {});
      this.service.getConfig(username).then(function () { }, function () {
        calledFailureFn = true;
      });
      this.$httpBackend.flush();
      expect(calledFailureFn).toBe(true);
    });
  });
});
