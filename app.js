var http = require('http');
const cors = require('cors');
const morgan = require('morgan');
var express = require('express');
const { Server } = require('socket.io');
var { RtcTokenBuilder, RtmTokenBuilder, RtcRole } = require('agora-access-token');

var PORT = 3000;

// Fill the appID and appCertificate key given by Agora.io
var appID = "a0c65b1f6fa24184807f22e516bc8f6b";
var appCertificate = "dc186c44b7f94e92b5d5d9ea7ab1e602";

// Token expiration time (3600 seconds = 1 hour)
var expirationTimeInSeconds = 3000;
var role = RtcRole.PUBLISHER;

var app = express();
app.set('port', PORT);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors())
app.use(morgan("dev"));

const channels = [

];
const server = http.createServer(app);
// Set up Socket.IO
const io = new Server(server, {
    cors: {
        origin: '*',
        methods: ['GET', 'POST']
    }
});

// Store comments in memory (optional: use DB instead)
const commentsMap = {}; // { [livestreamId]: [commentObj] }

io.on('connection', (socket) => {
    console.log(`User connected: ${socket.id}`);

    socket.on('join_livestream', (livestreamId) => {
        socket.join(livestreamId);
        console.log(`User ${socket.id} joined livestream ${livestreamId}`);
    });

    socket.on('send_comment', ({ livestreamId, username, comment }) => {
        const commentData = {
            id: Date.now(),
            username,
            comment,
            timestamp: new Date().toISOString()
        };

        // Save in memory
        if (!commentsMap[livestreamId]) commentsMap[livestreamId] = [];
        commentsMap[livestreamId].push(commentData);

        // Broadcast to room
        io.to(livestreamId).emit('receive_comment', commentData);
    });

    socket.on('disconnect', () => {
        console.log(`User disconnected: ${socket.id}`);
    });
});

app.get("/updatehost/:channelName", (req, res) => {
    try {
        const { channelName } = req.params;
        const uid = req.query.uid;
        const channel = channels.find((channel) => channel.name === channelName);
        if (!channel) {
            return res.status(400).json({ error: 'Channel not found' });
        }
        channel.host = uid;
        channel.members.unshift(uid);
        return res.status(200).json({ channel });

    } catch (error) {
        res.json({ error: error.message });
    }
})

app.get('/joinChannel', (req, res) => {
    try {
        const { channelName, uid } = req.body;
        const channel = channels.find((channel) => channel.name === channelName);
        if (!channel) {
            return res.status(400).json({ error: 'Channel not found' });
        }
        if (channel.members.includes(uid)) {
            return res.status(200).json({ channel });
        }
        channel.members.push(uid);
        return res.status(200).json({ channel });
    } catch (error) {
        res.json({ error: error.message });
    }
})
app.get('/getChannels', (req, res) => {
    try {

        return res.status(200).json({ channels });
    } catch (error) {
        res.json({ error: error.message });
    }
})
app.get('/getChannel/:channelName', (req, res) => {
    try {
        const { channelName } = req.params;
        console.log(channelName)
        const channel = channels.find((channel) => channel.name === channelName);
        console.log(channel)
        if (!channel) {
            return res.status(400).json({ error: 'Channel not found' });
        }
        return res.status(200).json({ channel });
    } catch (error) {
        res.json({ error: error.message });
    }
})
app.get('/leaveChannel', (req, res) => {
    try {
        const { channelName, uid } = req.query;
        const channel = channels.find((channel) => channel.name === channelName);
        if (!channel) {
            return res.status(400).json({ error: 'Channel not found' });
        }
        if (channel.members.includes(uid)) {
            const index = channel.members.indexOf(uid);
            channel.members.splice(index, 1);
            if (channel.members.length === 0) {
                const index = channels.indexOf(channel);
                channels.splice(index, 1);
            }
            return res.status(200).json({ channel });
        }
    } catch (error) {
        res.json({ error: error.message });
    }
})
app.get("/removeChannel/:channelName", (req, res) => {
    try {
        const { channelName } = req.params;
        const channel = channels.find((channel) => channel.name === channelName);
        console.log("removing")
        if (!channel) {
            return res.status(400).json({ error: 'Channel not found' });
        }
        const index = channels.indexOf(channel);

        console.log("removing",channel)
        channels.splice(index, 1);
        return res.status(200).json({ channels });
    } catch (error) {
        console.log(error)
        res.json({ error: error.message });
    }
})

var generateRtcToken = function (req, resp) {

    try {

        var currentTimestamp = Math.floor(Date.now() / 1000);
        var privilegeExpiredTs = currentTimestamp + expirationTimeInSeconds;
        var channelName = req.query.channelName;
        const userId = req.query.id;
        if (!userId) {
            return resp.status(400).json({ error: "user id is required" })
        }
        var uid = 0;

        if (!channelName) {
            return resp.status(400).json({ error: 'Channel name is required' });
        }
        if (channels.map((channel) => channel.name).includes(channelName)) {
            return resp.status(400).json({ error: 'Channel name is already in use' });
        }

        var key = RtcTokenBuilder.buildTokenWithUid(
            appID,
            appCertificate,
            channelName,
            uid,
            role,
            privilegeExpiredTs
        );

        channels.push({ name: channelName, key: key, host: uid, members: [uid], hostId: userId });
        resp.header("Access-Control-Allow-Origin", "*");
        return resp.json({ name: channelName, key: key, host: uid });
    } catch (error) {
        resp.json({ error: error.message });
    }
};

var generateRtmToken = function (req, resp) {
    var currentTimestamp = Math.floor(Date.now() / 1000);
    var privilegeExpiredTs = currentTimestamp + expirationTimeInSeconds;
    var account = req.query.account;

    if (!account) {
        return resp.status(400).json({ error: 'Account is required' });
    }

    var key = RtmTokenBuilder.buildToken(appID, appCertificate, account, RtcRole, privilegeExpiredTs);

    resp.header("Access-Control-Allow-Origin", "*");
    return resp.json({ key });
};

app.get('/createChannnel', generateRtcToken);
// app.get('/rtmToken', generateRtmToken);

server.listen(app.get('port'), function () {
    console.log('AgoraSignServer starts at port ' + app.get('port'));
});
