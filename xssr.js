var program = require('commander')
  , request = require('request')
  , jsdom = require("jsdom")
  , _ = require("underscore");

var default_events = 'click,keyup,keydown,mouseover,mousein,mouseout';

program
  .version('0.0.1')
  .option('-u, --url [url]', 'URL to be scanned')
  .option('-t, --tags [tags]', 'HTML tags with handler to be scanned', 'button,a')
  .option('-e, --events [events]', 'Javascript handler events to be scanned', default_events)
  .parse(process.argv);

jsdom.defaultDocumentFeatures = {
  FetchExternalResources   : ['script', 'img'],
  ProcessExternalResources : ['script'],
  MutationEvents           : '2.0',
  QuerySelector            : false
};

if (!program.url) {
  throw new Error('The url argument is mandatory');
}

program.events = program.events.split(',');

var issues = [];

function addVulnerability(target, step, error) {
  issues.push({
    target: target
  , step: step
  , stack: error.stack
  });
}

function printVulnerabilities() {
  console.log('\nReport:\n\nFound ' + issues.length + ' vulnerabilities!');

  if (issues.length) {
    console.log('\nIssues in:\n');

    issues.forEach(function (issue) {
      console.log(' · Element:' + issue.target + ' in ' + issue.step + ' handler');
    });
  }

  console.log('\n');
}

request({url: program.url}, function (error, response, body) {
  if (!error && response.statusCode === 200) {

    var document
      , window;

    document = jsdom.jsdom(body, null, {
      url: 'http://127.0.0.1:8000'
    });

    window = document.createWindow();
    //window = document.parentWindow;

    // Handle to detect XSS issues
    window.xss = function (target, step) {
      addVulnerability(target, step, new Error());
    };

    window.onerror = function (errorMsg, url, lineNumber) {
      console.log("Uncaught error " + errorMsg + " in " + url + ", line " + lineNumber);
    };

    // Listener to execute the test suite after load all the page
    window.addEventListener('load',  function (a, b, c) {

      window.$('input[type=text]').val('<script>xss(this, "STEP1"); </script>');

      console.log('Checking ' + window.$(program.tags).length + ' DOM elements...\n');

      window.$(program.tags).each(function () {
        var handlers
          , handlers_keys
          , message;

        handlers = window.$._data(this, 'events') || {};
        handlers_keys = _.intersection(Object.keys(handlers), program.events);

        message = ' · Checking element "' + window.$(this).html() + '" with ';

        if (handlers_keys && handlers_keys.length) {
          // Iterate for each handler in this DOM element
          handlers_keys.forEach(function (handlers_key) {
            console.log(message + handlers_key + ' handlers...');
            handlers[handlers_key][0].handler();
          });
        } else {
          console.log(message + 'no handlers...');
        }

      });

      process.nextTick(function () {
        printVulnerabilities();
      });
    });
  } else {
    console.log('Error fetching the url. (' + error + ' and code ' + response.statusCode + ')');
  }
});
