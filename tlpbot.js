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

var singletons = ['ctide', 'quartzjer', 'temas', 'othiym23', 'smurthas', 'smurthas1', 'smurthas2', 'mdz', 'erictj', 'merc3po'];


if (process.env.NODE_ENV === 'test') {
    options.nick = 'tlpbottest';
    options.channels = ['#tlp-bot'];
    options.logdir = './';
    singletons = ['ctide'];
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

}).connect(options);
