var rp = require('request-promise');
var fs = require('fs-sync');

var config = require('./config.json');

/* Philip Hue URL part*/
function registerBody() {
    return {
        'devicetype':'my_hue_app#iphone peter'
    };
}

function turnOnBody() {
    return {
        'on': true,
        'sat': 254,
        'bri':254,
        'hue': 10000
    };
}

function turnOffBody() {
    return {
        'on': false
    }
}

function makeRequest(method, url, entity) {
    return rp({
        method: method,
        uri: url,
        json: entity    
    });
}

function putRequest(url, entity) {
    return makeRequest('PUT', url, entity);
}

function postRequest(url, entity) {
    return makeRequest('POST', url, entity);
}

function registerUrl() {
    return config.host + config.root;
}

function rootUrl() {
    return config.host + config.root + '/' + config.token + '/lights';
}

function lightUrl(id) {
    return rootUrl() + '/' + id;
}

function stateUrl(id) {
    return lightUrl(id) + '/state';
}

function register() {
    return postRequest(registerUrl(), registerBody());
}

function checkStatus(id) {
    return rp.get(lightUrl(id));
}

function listAllStatus() {
    return rp.get(rootUrl());
}

function turnOnLight(id) {
    return putRequest(stateUrl(id), turnOnBody());
}

function turnOffLight(id) {
    return putRequest(stateUrl(id), turnOffBody());
}

function blink(id, turnOn) {
    var interval, promise;
    if (turnOn) {
        interval = config.bright;
        promise = turnOnLight(id);
    } else {
        interval = config.dark;
        promise = turnOffLight(id);
    }
    promise.then(
        function(resp) {
            console.log(resp);
            setTimeout(() => {blink(id, !turnOn);}, interval);
        }
    );
}

function shuffle(ids, isBright) {
    if (0 == ids.length)
        return;
    blink(ids.pop(), isBright);
    setTimeout(() => { shuffle(ids);},
        config.bright < config.dark ? config.bright : config.dark);
}

/* command part */
var MIN = 60 * 1000;

function usage() {
    console.log('usage: node args.js');
    console.log('   -help');
    console.log('   -register');
    console.log('   -list');
    console.log('   -check <light_id...>');
    console.log('   -turnon <light_id...>');
    console.log('   -turnoff <light_id...>');
    console.log('   -blink <light_ids...>');
    console.log('   -shuffle -[bright | -dark] <light_ids...>');
    console.log('   -timer <start> <last> <any of other command>');
}

function loopLights(callback, i) {
    for (; i < process.argv.length; i++)
        callback(process.argv[i]);
}

cmds = {
    '-help': function() {
        usage();
    },
    '-register': function() {
        register().then( function (resp) {
            console.log(resp);
            if (resp.length > 0 && resp[0].success != undefined) {
                config.token = resp[0].success.username;
                fs.write('config.json', JSON.stringify(config, null, '\t'));
                console.log('new token ' + config.token + ' saved.');
            }
        });
    },
    '-list': function() {
        return listAllStatus();
    },
    '-check': function() {
        if (process.argv.length >= 4)
            loopLights((id) => {
                checkStatus(id).then(
                    (resp) => { console.log(resp);}
                );
            }, 3);
        else
            usage();
    },
    '-turnon': function() {
        if (process.argv.length >= 4)
            loopLights((id) => {
                turnOnLight(id).then(
                    (resp) => { console.log(resp);}
                );
            }, 3);
        else
            usage();
    },
    '-turnoff': function() {
        if (process.argv.length >= 4)
            loopLights((id) => {
                turnOffLight(id).then(
                    (resp) => { console.log(resp);}
                );
            }, 3);
        else
            usage();
    },
    '-blink': function() {
        if (process.argv.length >= 4)
            loopLights((id) => {
                blink(id, true);
            }, 3);
        else
            usage();
    },
    '-shuffle': function() {
        var ids = [];
        if (process.argv.length >= 5) {
            var style = process.argv[3];
            loopLights((id) => { ids.push(id);}, 4);
            if (style == '-bright')
                shuffle(ids, true);
            else if (style == '-dark')
                shuffle(ids, false);
            else
                usage();
        } else
            usage();
    },
    '-timer': function () {
        if (process.argv.length >= 6) {
            var start = process.argv[3], last = process.argv[4];
            process.argv.splice(2, 3);
            setTimeout(function() {
                execute();
            }, start * MIN);
            setTimeout(() => { process.exit(); }, start * MIN + last * MIN);
        } else
            usage();
    }
};

function execute() {
    if (process.argv.length >= 3 && (cmd = process.argv[2]) && cmd in cmds) {
        var cmdPromise = cmds[cmd]();
        if (cmdPromise != undefined)
            cmdPromise.then((resp) => { console.log(resp) });
    } else
        usage();
}

execute();
