var jerk = require("jerk");
var path = require("path");
var fs = require("fs");
var express = require("express");
var request = require("request");
var qs = require("querystring");
var util = require("util");

var app = express.createServer()
app.configure(function() {
    app.use(express.bodyParser());
});

var options = JSON.parse(fs.readFileSync("config.json"));

var singletons = ['quartzjer', 'temas', 'othiym23', 'smurthas', 'mdz', 'erictj', 'merc3po', "kristjan"];

if (process.env.NODE_ENV === 'test') {
    options.nick = 'tlpbottest';
    options.channels = ['#tlp-bot'];
    options.logdir = './';
    singletons = ['temas'];
    console.log("Launching in test mode");
}

var bot = jerk( function(j) {

j.watch_for(/.*/, function(message) {
    if (options.channels.indexOf(message.source) < 0) return;

    var now = new Date();
    var location = path.join(options.logdir, message.source);
    var file = path.join(location, now.strftime("%Y-%m-%d.json"));

    path.exists(location, function (exists) {
        if (!exists) fs.mkdirSync(location, 0755);
        var log = fs.createWriteStream(file, {flags:"a"});
        log.write(JSON.stringify({timestamp:now, user:message.user, text:message.text}) + "\n");
        log.end();
    })
})

j.watch_for(/@all.*/, function(message) {
    var text = message.text.toString();
    text = text.split(' ').slice(1).join(' ');
    for (var i = 0; i < singletons.length; i++) {
        bot.say(singletons[i], 'Message in ' + message.source + ' from ' + message.user + ' to all:');
        bot.say(singletons[i], message.text.toString().substring(5));
    }
})

j.watch_for(/#(\d+)/, function(message) {
    if (options.baseUser && options.baseRepo) {
        sayBug(options.baseUser, options.baseRepo, message.match_data[1], message);
    }
});

j.watch_for(/github\.com\/(.*)\/(.*)\/issues\/(\d+)/, function(message) {
    sayBug(message.match_data[1], message.match_data[2], message.match_data[3], message);
})

}).connect(options);

function sayBug(user, repo, number, message) {
    request.get({url:"https://api.github.com/repos/" + user + "/" + repo + "/issues/" + number, json:true}, 
        function(err, resp, body) {
            // TODO:  Rate limit checks
            if (err) {
                console.error("Error getting bug: " + err);
                return;
            }
            var msg = "#\u0002" + body.number + "\u0002\u0003 - ";
            if (body.pull_request) {
                msg += "Pull Request - ";
            }
            if (body.state == "open") {
                msg += "\u00033";
            } else if (body.state == "closed") {
                msg += "\u00034";
            } else {
                msg += "\u00038";
            }
            msg += body.state + "\u0003: " + body.title;
            message.say(msg);
        }
    );
}

function issue(body, short) {
    var issueStr = body.repository.name + "#\u0002" + body.issue.number + "\u0002\u0003";
    if (!short) {
        issueStr += " - ";
        if (body.issue.pull_request) {
            issueStr += "Pull Request - ";
        }
        if (body.issue.state == "open") {
            issueStr += "\u00033";
        } else if (body.issue.state == "closed") {
            issueStr += "\u00034";
        } else {
            issueStr += "\u00038";
        }
        issueStr +=  body.issue.state;
    }
    issueStr += "\u0003";
    return issueStr;
}

var eventHandlers = {
    "issue_comment":function(body) {
        bot.say(options.channels[0], body.sender.login + " commented on issue " + issue(body) + " (" + body.issue.html_url + ")");
    },
    "issues": function(body) {
        bot.say(options.channels[0], body.sender.login + " " + body.action + " " + issue(body, true) + ": " + body.issue.title + " (" + body.issue.html_url + ")");
    }
};

app.post("/github", function(req, res) {
    var payload = JSON.parse(req.body.payload);
    var handler = eventHandlers[req.headers["x-github-event"]];
    if (handler && req.body && req.body.payload) {
        console.log("Handling event.");
        handler(payload);
    } else {
        console.log("Should handle (" + req.headers["x-github-event"] + "): " + JSON.stringify(payload, null, "    "));
    }
    res.send(200);
});

app.get("*", function(req, res) {
    console.log("Other stuff");
    res.send(200);
});

app.listen(8888, function() {
    if (!options.githubUsername) return;

    var tty = require("tty");
    var stdin = process.openStdin();

    var password = "";

    tty.setRawMode();
    process.stdout.write("Github password: ");
    stdin.on("data", function(c) {
        c = c + "";
        switch (c) {
            case "\n": case "\r": case "\u0004":
                tty.setRawMode(false);
                stdin.pause();
                function subToHub(type) {
                    request.post({url:"https://" + options.githubUsername + ":" + password + "@api.github.com/hub", form:{
                        "hub.mode":"subscribe", 
                        "hub.topic":"https://github.com/" + options.baseUser + "/" + options.baseRepo + "/events/" + type, 
                        "hub.callback":options.hubBubCallback + "/github"}},
                        function(err, resp, body) {
                            if (err) {
                                console.error("ERROR setting up hub: " + err);
                                return;
                            }
                            console.dir(resp);
                            console.log("Setup issue hub: " + body);
                        }
                    );
                }
                subToHub("issues");
                subToHub("issue_comment");
                return;
            case "\u0003":
                tty.setRawMode(false);
                stdin.pause();
                return;
            default:
                password += c;
                break;
        };
    });
    setTimeout(function() {
        if (!password) {
            console.log("Cancelled github password request");
            tty.setRawMode(false);
            stdin.pause();
        }
    }, 10000);
});
