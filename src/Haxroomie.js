const { RoomController } = require('./room');
const puppeteer = require('puppeteer');
const path = require('path');

/**
 * Class for spawning the headless chrome browser and getting 
 * [sessions]{@link Session} for the browser instance.
 * 
 * Each [session]{@link Session} controls a tab in the headless chrome.
 * 
 * After creating the Haxroomie instance it is required to launch the browser
 * with the [createBrowser method]{@link Haxroomie#createBrowser} before 
 * requesting sessions with the 
 * [getSession method]{@link Haxroomie#getSession}.
 * @memberof module:haxroomie
 */
class Haxroomie {

  /**
   * Constructor for Haxroomie.
   * 
   * @param {object} opt - options
   * @param {object} [opt.viewport={ width: 400, height: 500 }] - Viewport 
   *    size settings for the browser.
   * @param {number} [opt.port=3066] - Port that the headless browser will use
   *    as the remote-debugging-port to communicate with Haxroomie. Use a
   *    port that is not open outside your LAN!
   * @param {boolean} [opt.noSandbox=false] - Makes the browser run without
   *    sandbox. Useful only if it gives you error in sandboxed mode. It is
   *    not recommended to set this true for security reasons.
   * @param {boolean} [opt.headless=true] - Setting this to false will make
   *    puppeteer try to spawn a browser window. Useful for debugging.
   * @param {boolean} [opt.userDataDir] - Path to where
   *    browser should store data like localStorage. Defaults to [project
   *    root directory]/user-data-dir.
   */
  constructor(opt) {
    this.browser = null;
    this.roomSessions = {};

    opt = opt || {};

    this.viewport = opt.viewport || { width: 400, height: 500 };

    this.port = opt.port || 3066;
    if (this.port === 0) {
      throw new Error('INVALID_PORT: 0');
    }

    this.noSandbox = opt.noSandbox || false;
    this.headless = opt.hasOwnProperty('headless') ? opt.headless : true;
    this.userDataDir = opt.userDataDir 
      || path.resolve(path.join(__dirname, '..', 'user-data-dir'));
  }

  /**
   * Launches the puppeteer controlled browser using the remote-debugging-port
   * given in Haxroomie classes constructor. It is only possible to launch one
   * browser.
   */
  async createBrowser() {
    // make sure there isnt a browser running already
    let browser = await this.getRunningBrowser();
    // if there is a browser running throw an error
    if (browser) {
      throw new Error(
        `BROWSER_RUNNING: http://localhost:${this.port}.
        Use another port or close the browser.`
      )
    }

    if (!this.browser) {
      this.browser = await puppeteer.launch({
        headless: this.headless,
        devtools: !this.headless,
        userDataDir: this.userDataDir,
        args: [
          `--remote-debugging-port=${this.port}`,
          `--no-sandbox=${this.noSandbox}`
        ]
      });
    }
    return this.browser;
  }

  /**
   * @private
   */
  async getRunningBrowser() {
    try {
      this.browser = await puppeteer.connect({
        browserURL: `http://localhost:${this.port}`
      });
    } catch (err) {
      return null;
    }
    return this.browser;
  }

  /**
   * Closes the puppeteer controlled browser.
   */
  async closeBrowser() {
    if (this.browser) await this.browser.close();
  }

  /**
   * Returns an existing session or creates a new one with the given session
   * id. Each session controls a tab in the browser instance.
   * 
   * @param {object|string|number} sessionID - id of the session to receive
   * @returns {Session} - session object with the given id
   */
  async getSession(sessionID) {
    if (!this.browser) {
      throw new Error(`Browser is not running!`)
    }
    if (!sessionID && sessionID !== 0) {
      throw new Error('Missing required argument: sessionID');
    }
    // if there are no sessions get the default page
    if (Object.keys(this.roomSessions).length === 0) {
      let pages = await this.browser.pages();
      let page = pages[0];
      let session = await this.initSession(page, sessionID);
      return session;
    }

    // if the session does not exist, create a new page
    if (!this.roomSessions[sessionID]) {
      let page = await this.browser.newPage();
      let session = this.initSession(page, sessionID);
      return session;
    }

    // if the session exists then return it
    return this.roomSessions[sessionID].session;
  }

  /**
   * @private
   */
  async initSession(page, sessionID) {

    const device = {
      'name': 'Galaxy S5',
      'userAgent': 'Mozilla/5.0 (Linux; Android 5.0; SM-G900P Build/LRX21T) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/69.0.3452.0 Mobile Safari/537.36',
      'viewport': {
        'width': this.viewport.width,
        'height': this.viewport.height,
        'deviceScaleFactor': 1,
        'isMobile': false,
        'hasTouch': false,
        'isLandscape': false
      }
    }

    await page.emulate(device);

    let room = new RoomController({
      page: page,
      id: sessionID,
    });

    this.roomSessions[sessionID] = room;

    return room.session;
  }
}

module.exports = Haxroomie;