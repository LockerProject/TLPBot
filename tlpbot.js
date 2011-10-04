var jerk = require("jerk");
var path = require("path");
var fs = require("fs");

var options = {
    server: "irc.freenode.net",
    nick:"TLPBot",
    user: {
        username:"TLPBot",
        hostname:"lockerproject.org",
        servername:"ircbot",
        realname:"TLP Bot"
    },
    channels:["#lockerproject"],
    logdir : "/home/ircbot/irc-logs"
};

jerk( function(j) {

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

}).connect(options);
