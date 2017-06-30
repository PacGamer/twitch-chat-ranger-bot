var tmi = require("tmi.js");
var wordfilter = require('wordfilter');
var _ = require('lodash');
var http = require('http');
var request = require('request');



//Authentication Info
var TWITCH_BOT_USERNAME = "";
var TWITCH_BOT_OAUTH = "";
var TWITCH_TARGET_CHANNEL = ""; //In format of #channel. Comma separated + no spaces, if joining more than 1 channel.



var options = {
	options: {
		debug: true
	},
	connection: {
		reconnect: true
	},
	identity: {
		username: TWITCH_BOT_USERNAME,
		password: TWITCH_BOT_OAUTH
	},
	channels: [TWITCH_TARGET_CHANNEL]
};

var client = new tmi.client(options);

var debug_enabled = (options["options"]["debug"]);

if (debug_enabled) {
	console.log("Debug enabled: " + debug_enabled);
}

var broadcaster = [];

// Connect the client to the server
client.connect();

// Initialize chat buffer
var max_lines = 100; //Number of lines to be stored
var max_lines_reached = 0; //Nuke status (0 = disabled, 1 = enabled)

var chat_buffer = []; //Chat buffer array
var buf_user = 0; //Index of username in buffer
var buf_msg = 1; //Index of message in buffer

var i = 0; // Line count

// Initialize nuke
var aegis_names = []; //Nuked usernames array
var aegis_index = 0; //Index of aegis array
var nuke_count = 0; //Number of messages nuked
var nuke_msg = ""; //Message to nuke
var nuke_armed = 0; //Nuke status

var strMsg = []; //Snapshot of user messages
var strUsr = []; //Snapshot of users (0 = disabled, 1 = enabled)

//Initialize lockdown
var lockdown_state = 0; //Lockdown status (0 = disabled, 1 = enabled)

var channel_arr = []; //Channel name
var user_arr = []; //User object
var message_arr = []; //Message contents
var self_arr = []; //Check if self

function msgTest() {

	console.log("channel_arr: " + channel_arr)
	console.log("user_arr: " + user_arr.username)
	console.log("message_arr: " + message_arr)
	console.log("self_arr: " + self_arr)
	console.log("isMod: " + isMod())

}

function isMod() {

	//Check if user is mod
	if ((user_arr["user-type"] === "mod" || user_arr.username === broadcaster || user_arr.username === self_arr)) {
		// User is a mod.
		return true;
	} else
		return false;

}

client.on('chat', function (channel, user, message, self) {
	// Get info from message

	channel_arr = channel; //Channel (includes #)
	user_arr = user; //Full user object
	message_arr = message; //Message contents
	self_arr = self; //If self
	broadcaster = channel.replace("#", ""); //Broadcaster name (no #)
});

client.on('chat', function (channel, user, message, self) {

	// 100 line buffer
	// Output contents of chat buffer to console

	if (message.toLowerCase() !== '!output') {
		while (i < max_lines) {
			chat_buffer[buf_user] = user.username;
			chat_buffer[buf_msg] = message;
			console.log('i: ' + i + ' user: ' + buf_user + ' ' + chat_buffer[buf_user] + ' and msg: ' + buf_msg + ' ' + chat_buffer[buf_msg]);

			break;
		}
		i++;
		buf_user = buf_user + 2;
		buf_msg = buf_msg + 2;
		if (i == max_lines) {
			max_lines_reached = max_lines;
			i = 0;
			buf_user = 0;
			buf_msg = 1;
		}

	}

	// Check if word contains blacklisted word
	if (wordfilter.blacklisted(message)) {
		client.timeout(channel, user.username, 300);
		client.say(channel, '@' + user["display-name"] + ': Please keep your hateful words to yourself. Thanks! NoBully');
	} else

		if (new RegExp("([a-zA-Z0-9]+://)?([a-zA-Z0-9_]+:[a-zA-Z0-9_]+@)?([a-zA-Z0-9.-]+\\.[A-Za-z]{2,4})(:[0-9]+)?(/.*)?").test(message)) {
			// Check if message contains URL
			if (!(user["user-type"] === "mod" || user.username === channel.replace("#", "") || user.username === self)) {
				// User is a mod.
				client.timeout(channel, user.username, 300);
				client.say(channel, '@' + user["display-name"] + ': Posting links without permission is considered bullying. NoBully');
			}
		}

	//Random cat from The Cat API
	if (message.toLowerCase() == '!randomcat') {
		var url = 'http://thecatapi.com/api/images/get';

		var r = request.get(url, function (err, res, body) {
				client.say(channel, r.uri.href);
			});
	}

	/* -----------------------
	BEGIN NUKE CODE
	------------------------ */

	if (message[0] == "!" && message.length > 1) {
		var cmd = message.match(/[a-z]+\b/)[0];
		var arg = message.substr(cmd.length, message.length);
		var chan = channel;

		if (cmd == 'nuke') {

			// Get nuke message and arm nuke
			var to = arg.match(/[a-z]+\b/)[0];

			nuke_msg = arg.substr(to.length, arg.length);
			nuke_armed = 1;
			client.say(channel, 'Launching anti-bully nukes!');

			var chat_snapshot = [];
			var buf_user_b = 0;
			var buf_msg_b = 1;

			var j = 0;
			chat_snapshot = chat_buffer; //Take snapshot of lines
			if (max_lines_reached != max_lines) {
				max_lines_reached = i;
			}
			while (j < max_lines) {

				strMsg = chat_snapshot[buf_msg_b];
				strUsr = chat_snapshot[buf_user_b];

				if (strMsg !== undefined) {
					nuke_msg = nuke_msg.replace(/\s+/g, ''); //Remove spaces
					strMsg = strMsg.replace(/\s+/g, '');
					if (strMsg.indexOf(nuke_msg) > -1) {

						client.timeout(channel, strUsr, 300);
						aegis_names.push(strUsr);

						aegis_index++;
						nuke_count++;

					}

				}

				buf_user_b = buf_user_b + 2;
				buf_msg_b = buf_msg_b + 2;
				j++;

			}

		}

		//Nuke by regular expression
		if (cmd == 'nukeregex') {

			// Get nuke message and arm nuke
			var to = arg.match(/[a-z]+\b/)[0];

			nuke_msg = arg.substr(to.length, arg.length);
			nuke_msg = nuke_msg.replace(/\s+/g, '');

			var flags = nuke_msg.replace(/.*\/([gimy]*)$/, '$1');
			var pattern = nuke_msg.replace(new RegExp('^/(.*?)/' + flags + '$'), '$1');
			var regex = new RegExp(pattern, flags);

			client.say(channel, 'Launching anti-bully nukes!');

			var chat_snapshot = [];
			var buf_user_b = 0;
			var buf_msg_b = 1;

			var j = 0;
			chat_snapshot = chat_buffer; //Take snapshot of lines
			if (max_lines_reached != max_lines) {
				max_lines_reached = i;
			}
			while (j < max_lines) {

				strMsg = chat_snapshot[buf_msg_b];
				strUsr = chat_snapshot[buf_user_b];

				if (strMsg !== undefined) {

					if (strMsg.match(regex)) {

						client.timeout(channel, strUsr, 300);
						aegis_names.push(strUsr);

						aegis_index++;
						nuke_count++;

					}

				}

				buf_user_b = buf_user_b + 2;
				buf_msg_b = buf_msg_b + 2;
				j++;

			}

		}

		if (cmd == 'aegis') {
			var strUsr_aegis = [];
			var k = 0;
			aegis_index = 0;

			if (aegis_names.length !== 0) {

				nuke_armed = 0;
				client.say(channel, 'Nukes disarmed. Reviving!');
				console.log('aegis');
				console.log("aegis_names: " + aegis_names);
				console.log("aegis_index: " + aegis_index);
				console.log("nuke_count: " + nuke_count);
				do {
					if (_.first(aegis_names) !== undefined) {
						client.unban(channel, _.first(aegis_names));
						console.log(_.first(aegis_names) + ' revived');
						_.pull(aegis_names, _.first(aegis_names))
					}
				} while (aegis_names.length !== 0)

				nuke_count = 0;

			}

		}

	}

	//Check if nuke armed
	if (nuke_armed == 1) {
		if (message.indexOf(nuke_msg) > -1) {

			//Ban user and add to aegis array
			client.timeout(channel, user.username, 300);
			aegis_names.push(user.username);

			console.log("aegis_names[aegis_index]: " + aegis_names[aegis_index]);
			console.log("aegis_index: " + aegis_index);
			aegis_index++;
			nuke_count++;

		}
	}

	/* -----------------------
	END NUKE CODE
	------------------------ */

	//Kill bot connection
	if (user["user-type"] === "mod" || user.username === channel.replace("#", "") || (user.username === self)) {
		// User is a mod.
		if (message.toLowerCase() == '!leave') {
			client.say(channel, 'Leaving :(');
			client.disconnect();
		}
	}

	/* -----------------------
	BEGIN LOCKDOWN CODE
	------------------------ */

	if ((message.toLowerCase() == '!lockdown on')
		 && (lockdown_state == 0)) {
		lockdown_state = 1;
		client.say(channel, 'Lockdown initiated. ALL chat messages will now result in a timeout.');

	}

	if ((message.toLowerCase() == '!lockdown off')
		 && (lockdown_state == 1)) {
		lockdown_state = 0;
		client.say(channel, 'Lockdown disabled. Have fun!');

	}

	if (lockdown_state == 1) {
		if (user["user-type"] != "mod" || user.username != channel.replace("#", "")) {
			client.timeout(channel, user.username, 300);
		}

	}

	/* -----------------------
	END LOCKDOWN CODE
	------------------------ */

});

// Check for '!' commands
client.on('chat', function (channel, user, message, self) {
	if (message[0] == "!" && message.length > 1) {
		var cmd = message.match(/[a-z]+\b/)[0];
		var arg = message.substr(cmd.length, message.length);
		var chan = channel;
		chat_command(cmd, arg);

	} else {
		// Ignore
	}

	// Excecute '!' commands
	function chat_command(cmd, arg) {

		switch (cmd) {

		case 'bully':
			var to = arg.match(/[a-z]+\b/)[0];
			var message = arg.substr(to.length, arg.length);
			client.say(channel, message);
			break;

		case 'time':
			var to = arg.match(/[a-z]+\b/)[0];
			var message = arg.substr(to.length, arg.length);

			var len = 0;
			message = getDateTime();

			client.say(channel, message);
			break;

		default:
			break;
			//console.log("That is not a valid command.");

		}
	}

});

function getDateTime() {

	var date = new Date();

	var hour = date.getHours();
	hour = (hour < 10 ? "0" : "") + hour;

	if (hour > 11) {
		var daytime = "PM"
	} else {
		var daytime = "AM"
	};

	if (hour > 12) {
		hour = hour - 12
	};

	var min = date.getMinutes();
	min = (min < 10 ? "0" : "") + min;

	var sec = date.getSeconds();
	sec = (sec < 10 ? "0" : "") + sec;

	var year = date.getFullYear();

	var months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
	var month = months[date.getMonth()];

	var days = ['Sun', 'Mon', 'Tues', 'Weds', 'Thurs', 'Fri', 'Sat'];
	var day = days[date.getDay()];

	return "time" + " | " + hour + ":" + min + " " + daytime + " EST";

}
