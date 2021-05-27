/* global io */
export default /*@ngInject*/ function PlayerCtrl(
  $rootScope,
  $timeout,
  $location,
  $scope,
  ConfigService) {

  ///////////////////////////////////////////////////////////////////////////////////////////////
  // Config
  ///////////////////////////////////////////////////////////////////////////////////////////////

  this.shadeColour = (color, percent) => {
    // from http://stackoverflow.com/a/13542669/1636285, with minor changes
    // pass a negative number to darken, positive to lighten
    let f = parseInt(color.slice(1), 16);
    let t = percent < 0 ? 0 : 255;
    let p = percent < 0 ? percent * -1 : percent;
    let R = f >> 16;
    let G = f >> 8 & 0x00FF;
    let B = f & 0x0000FF;
    return "#" + (0x1000000 + (Math.round((t - R) * p) + R) * 0x10000 + (Math.round((t - G) * p) + G) * 0x100 + (Math.round((t - B) * p) + B)).toString(16).slice(1);
  };

  this.getTheme = (backgroundColour, threshold = 128) => {
    let r;
    let g;
    let b;
    let yiq;
    try {
      r = parseInt(backgroundColour.slice(1).substr(0, 2), 16);
      g = parseInt(backgroundColour.slice(1).substr(2, 2), 16);
      b = parseInt(backgroundColour.slice(1).substr(4, 2), 16);
      yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000;

      return (yiq >= threshold) ? "light" : "dark";
    } catch (e) {
      return "dark";
    }
  };

  this.states = {
    loading: 0,
    loaded: 1,
    error: 2,
  };

  this.state = this.states.loading;

  let initialise = this.initialise = (config, streamUrl) => {
    this.state = this.states.loaded;
    this.config = config;
    if (!this.config.streamUrl) {
      this.config.streamUrl = streamUrl;
    }
    this.theme = this.getTheme(this.config.backgroundColour);
    if (typeof this.config.logo === "string") {
      if (this.config.logo.indexOf("photon.shoutca.st") === -1) {
        this.config.logo = "https://photon.shoutca.st/" + this.config.logo.replace(/http(s)?:\/\//, "");
      } else {
        this.config.logo = this.config.logo;
      }
    }

    const shadeMultiplier = 0.15;
    let lightenOrDarken = (this.getTheme(this.config.backgroundColour, 64) === "light") ? -1 : 1;
    this.shadedBackgroundColour = this.shadeColour(this.config.backgroundColour,
      shadeMultiplier * lightenOrDarken);

    // Determine the image's aspect ratio.
    // If the image is nearly square, then apply the CSS class square to it
    // in order to fix display issues.
    let logo = new Image();
    logo.onload = () => {
      let ratio = logo.width / logo.height;
      if (ratio >= 0.9 && ratio <= 1.1) {
        this.logoClass = "square";
      }
    };
    logo.src = this.config.logo;

    this.player.state = this.player.states.stopped;
    // Disable auto play.
    // if (this.config.autoPlay) {
    //   this.player.toggle(this.config.streamUrl);
    // }

    $rootScope.pageTitle = this.config.name;
  };

  let username = $location.search().username;

  ConfigService.getTunein(username).then((data) => {
    ConfigService.getConfig(username).then((config) => initialise(config, data.streamUrl), () => this.state = this.states.error);
  }, () => this.state = this.states.error);

  $scope.$on("message::reloadConfig", (event, config) => initialise(config));

  ///////////////////////////////////////////////////////////////////////////////////////////////
  // Player
  ///////////////////////////////////////////////////////////////////////////////////////////////

  const ONE_SECOND = 1000;
  const TIMEOUT = 20 * ONE_SECOND;

  let audio;
  this.player = {};
  this.player.states = {
    stopped: 0,
    buffering: 1,
    playing: 2,
  };
  this.player.state = this.player.states.stopped;
  let timeoutIntervalRef;

  let stopPlayer = () => {
    audio.removeEventListener("playing", playingListener);
    audio.removeEventListener("error", errorListener);
    audio.pause();
    audio.src = "";
    audio = null;
    this.player.state = this.player.states.stopped;
  };

  let errorListener = (message) => {
    /* global MediaError */
    if (message) {
      flashMessage(message);
    }
    if (!message && !audio.error || audio.error.code !== MediaError.MEDIA_ERR_ABORTED) {
      flashMessage("Couldn't play; please try again");
    }
    stopPlayer();
    $scope.$apply();
  };
  let playingListener = () => {
    this.player.state = this.player.states.playing;
    clearInterval(timeoutIntervalRef);
    $scope.$apply();
  };

  this.player.toggle = (streamUrl) => {
    if (this.player.state === this.player.states.buffering || this.shouldFlashMessage) {
      return;
    }
    if (this.player.state === this.player.states.playing && audio !== null) {
      stopPlayer();
      return;
    }
    audio = new Audio(streamUrl);
    audio.play();
    audio.addEventListener("playing", playingListener);
    audio.addEventListener("error", errorListener);
    this.player.state = this.player.states.buffering;
    timeoutIntervalRef = setTimeout(errorListener, TIMEOUT);
    // Some mobile browsers refuse to play() the stream unless the action was initiated
    // by the user themselves; in such a case, audio.paused will be true just after calling
    // audio.play(). We can check this to fail early and tell the user to try again.
    if (audio.paused) {
      errorListener("Tap the Play button to play");
      clearInterval(timeoutIntervalRef);
    }
  };

  ///////////////////////////////////////////////////////////////////////////////////////////////
  // Bottom bar
  ///////////////////////////////////////////////////////////////////////////////////////////////

  let flashMessage = (message, durationInSeconds = 5) => {
    this.bottomBarMessage = message;
    this.shouldFlashMessage = true;
    $timeout(() => {
      this.bottomBarMessage = (this.songs[0]) ? formatSong(this.songs[0]) : "";
      this.shouldFlashMessage = false;
    }, durationInSeconds * 1000);
  };

  let formatSong = ({ artist, song } = {}) => `${artist} - ${song}`;

  let initBottomBarMessage = () => {
    if (!this.shouldFlashMessage) {
      this.bottomBarMessage = (this.songs[0]) ? formatSong(this.songs[0]) : "";
    }
  };

  let socket = io.connect("https://np-rt.unmutedte.ch/");

  this.songs = [];

  socket.emit("subscribe", username);
  socket.on("metadata", (songs) => {
    this.songs = songs;
    for (let song of songs) {
      if (song.cover.indexOf("photon.shoutca.st") === -1) {
        song.cover = song.cover.replace(/http(s)?:\/\//, "https://photon.shoutca.st/");
      }
    }
    initBottomBarMessage();
    $scope.$apply();
  });

  initBottomBarMessage();

  const fallbackImageUrl = "https://photon.shoutca.st/cdn.shoutca.st/noalbum.png?w=200";
  this.fallbackImageUrl = fallbackImageUrl;
}
