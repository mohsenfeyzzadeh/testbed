/* Interop testing using apprtc.appspot.com using selenium
 * Copyright (c) 2016, Philipp Hancke
 */

const test = require('tape');
const fs = require('fs');
const os = require('os');
const webdriver = require('selenium-webdriver');
const buildDriver = require('./webdriver').buildDriver;

const TIMEOUT = 30000;

// in talky, each jingle session has a single peerconnection.
// but sessions are one-way because reasons.
function waitNPeerConnectionsExist(driver, n) {
    return driver.wait(() => driver.executeScript(n => Object.keys(app.xmpp.jingle.sessions).length === n, n), TIMEOUT);
}

function waitAllPeerConnectionsConnected(driver) {
    return driver.wait(() => driver.executeScript(() => {
        var sessions = app.xmpp.jingle.sessions;
        var states = [];
        Object.keys(sessions).forEach(sid => {
            var session = sessions[sid];
            if (session.pc && session.pc.pc) {
                states.push(session.pc.pc.iceConnectionState);
            }
        });
        return states.length === states.filter((s) => s === 'connected' || s === 'completed').length;
    }), TIMEOUT);
}

// talky shows one local video, one roster and one large video per person.
function waitNVideosExist(driver, n) {
    return driver.wait(() => driver.executeScript(n => document.querySelectorAll('video').length === n, n), TIMEOUT);
}

function waitAllVideosHaveEnoughData(driver) {
    return driver.wait(() => driver.executeScript(() => {
        var videos = document.querySelectorAll('video');
        var ready = 0;
        for (var i = 0; i < videos.length; i++) {
            if (videos[i].readyState >= videos[i].HAVE_ENOUGH_DATA) {
                ready++;
            }
        }
        return ready === videos.length;
    }), TIMEOUT);
}

// Edge Webdriver resolves quit slightly too early, wait a bit.
function maybeWaitForEdge(browserA, browserB) {
    if (browserA === 'MicrosoftEdge' || browserB === 'MicrosoftEdge') {
        return new Promise(resolve => {
            setTimeout(resolve, 2000);
        });
    }
    return Promise.resolve();
}

// Helper function for basic interop test.
function interop(t, browserA, browserB) {
  var driverA = buildDriver(browserA);
  var driverB = buildDriver(browserB);

  var baseURL = 'https://talky.io/';
  var roomName = 'fippo-interop' + Math.random().toString(36).substr(2, 10);

  driverA.manage().timeouts().setScriptTimeout(TIMEOUT);

  return driverA.get(baseURL + roomName)
  .then(() => driverA.findElement(webdriver.By.id('join')).click())
  .then(() => driverB.get(baseURL + roomName))
  .then(() => driverB.findElement(webdriver.By.id('join')).click())
  .then(() => {
    t.pass('joined room');
    return waitNPeerConnectionsExist(driverA, 2);
  })
  .then(() => {
    t.pass('peerconnections exist');
    return waitAllPeerConnectionsConnected(driverA);
  })
  .then(() => {
    t.pass('peerconnections connected or completed');
    return waitNVideosExist(driverA, 3);
  })
  .then(() => {
    t.pass('videos exist');
    return waitAllVideosHaveEnoughData(driverA);
  })
  .then(() => {
    t.pass('videos are in HAVE_ENOUGH_DATA state');
    return waitNVideosExist(driverB, 3);
  })
  .then(() => {
    t.pass('videos exist');
    return waitAllVideosHaveEnoughData(driverB);
  })
  .then(() => {
    t.pass('videos are in HAVE_ENOUGH_DATA state');
  })
  .then(() => Promise.all([driverA.quit(), driverB.quit()]))
  .then(() => maybeWaitForEdge(browserA, browserB))
  .then(() => {
    t.end();
  });
}

test('Chrome-Chrome', t => {
  interop(t, 'chrome', 'chrome')
});

test('Firefox-Firefox', t => {
  interop(t, 'firefox', 'firefox')
});

test('Chrome-Firefox', t => {
  interop(t, 'chrome', 'firefox')
});

test('Firefox-Chrome', t => {
  interop(t, 'firefox', 'chrome')
});
