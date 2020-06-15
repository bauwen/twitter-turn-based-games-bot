const fs = require("fs");
const https = require("https");
const zlib = require("zlib");
const twitter = require("./twitter.js");
const turngames = require("./turngames.js");

let LAST_MENTION_ID_FILENAME = "last_mention_id.txt";
let MY_ID_STRING = "1082387659220271104";

let lastMentionId = "1241485136262311943";
loadLastMentionId();

setTimeout(() => {
    setInterval(() => {
        intervalExecution();
    }, 15000);  // 15 seconds (i.e. 60 requests per 15 minutes)

    intervalExecution();
}, 2000);

function intervalExecution() {
    twitter.fetchMentions(lastMentionId, (err, tweets) => {
        if (err) {
            console.log(err);
            return;
        }

        console.log("checking mentions... (" + tweets.length + ")");

        if (tweets.length > 0) {
            updateLastMentionId(tweets[0].id_str);
        }

        for (let tweet of tweets) {
            if (!tweet.in_reply_to_status_id_str) {
                console.log("HANDLING_NEW_REQUEST");
                handleNewRequest(tweet);
            }
            else if (tweet.in_reply_to_user_id_str === MY_ID_STRING) {
                console.log("HANDLING_REPLY");
                handleReply(tweet);
            }
            else {
                console.log("UNHANDLED MENTION");
            }
        }
    });
}

function loadLastMentionId() {
    if (fs.existsSync(LAST_MENTION_ID_FILENAME)) {
        lastMentionId = fs.readFileSync(LAST_MENTION_ID_FILENAME, "utf8");
    }
}

function updateLastMentionId(id) {
    lastMentionId = id;
    fs.writeFileSync(LAST_MENTION_ID_FILENAME, id.toString(), "utf8");
}

function handleNewRequest(tweet) {
    let text = tweet.text.trim();
    let parts = text.split(" ");

    let foundGameName = false;
    let opponentName = "";

    for (let part of parts) {
        if (foundGameName && part.startsWith("@")) {
            opponentName = part.slice(1);
        }
        if (part === "tictactoe") {
            foundGameName = true;
        }
    }

    if (!opponentName) {
        return;
    }

    twitter.fetchUser(undefined, opponentName, (err, opponent) => {
        if (err) {
            if (err[0].code === 50) {
                // error: user does not exist
                // TODO: post reply
                console.log("opponent name does not exist: ", opponentName);
            }
            return;
        }

        // TODO: make amount of "players" not tictactoe-dependent (i.e. 2)
        // e.g. parse more than one name, if game can be played with more

        let game = turngames.getGame("tictactoe");
        let state = game.getInitialState();
        let rgba = game.getImageData(state);
        let gameData = {
            type: game.getType(),
            players: [
                tweet.user.id_str,
                opponent.id_str,
            ],
            state: state,
        };
        let reply = game.getTweetText(state, [
            tweet.user.screen_name,
            opponent.screen_name,
        ]);

        turngames.encodeImage(rgba, gameData, (png) => {
            twitter.postReply(tweet.id_str, reply, png, (err) => { console.log("posted new request"); });
        });
    });
}

function handleReply(tweet) {
    let text = tweet.text.trim();
    let parts = text.split(" ");

    let command = "";

    for (let part of parts) {
        if (!part.startsWith("@")) {
            command = part;
            break;
        }
    }

    if (!command) {
        // error: no command
        // TODO: post reply
        console.log("no input");
        return;
    }
    console.log("COMMAND:", command);

    twitter.fetchTweet(tweet.in_reply_to_status_id_str, (err, previousTweet) => {
        if (err) {
            console.log("couldnt fetch prev tweet");
            return;
        }

        let imageUrl = previousTweet.extended_entities.media[0].media_url_https;

        downloadImage(imageUrl, (err, png) => {
            if (err) {
                console.log(err);
                return;
            }

            turngames.decodeImage(png, (gameData) => {
                if (!gameData) {
                    // error: somehow image does not (correctly) encode data
                    console.log("uh-oh, decoding problem!");
                    return;
                }

                let game = turngames.getGame(gameData.type);
                let currentPlayerIndex = game.getCurrentPlayer(gameData.state);
                let currentPlayerId = gameData.players[currentPlayerIndex];

                if (currentPlayerId !== tweet.user.id_str) {
                    // error: reply is not from player that is supposed to play
                    console.log("reply is not from correct player...");
                    return;
                }

                let gameOver = game.getWinner(gameData.state) >= 0;
                if (gameOver) {
                    // error: game is already over
                    return;
                }

                if (!game.isValidInput(command)) {
                    // error: invalid command
                    // TODO: post reply
                    console.log("not valid input");
                    return;
                }

                let playerNames = gameData.players.slice();
                playerNames[currentPlayerIndex] = tweet.user.screen_name;

                fetchPlayerNames(playerNames, currentPlayerIndex, 0, gameData.players, (err) => {
                    if (err) {
                        if (err[0].code === 50) {
                            // error: a user does not exist (anymore)
                            // TODO: post reply
                            console.log("yow user not exist mon!");
                        }
                        return;
                    }

                    let state = game.getNextState(gameData.state, command);
                    if (!state) {
                        // error: command not applicable for this state
                        return;
                    }

                    let rgba = game.getImageData(state);
                    let newGameData = {
                        type: gameData.type,
                        players: gameData.players,
                        state: state,
                    };
                    let reply = game.getTweetText(state, playerNames);

                    turngames.encodeImage(rgba, newGameData, (png) => {
                        twitter.postReply(tweet.id_str, reply, png, (err) => { console.log("posted reply"); });
                    });
                });
            });
        });
    });
}

function downloadImage(url, callback) {
    let options = {
        method: "GET",
        headers: {
            "accept": "image/png",
            "accept-encoding": "br,gzip,deflate",
        },
    };
    let request = https.request(url, options, (response) => {
        let decompressor;
        switch (response.headers["content-encoding"]) {
            case "br":
                decompressor = zlib.createBrotliDecompress();
                break;
            case "gzip":
                decompressor = zlib.createGunzip();
                break;
            case "deflate":
                decompressor = zlib.createInflate();
                break;
        }
        if (decompressor) {
            response.pipe(decompressor);
        } else {
            decompressor = response;
        }

        let chunks = [];
        decompressor.on("data", (chunk) => {
            chunks.push(chunk);
        });
        decompressor.on("end", () => {
            let body = Buffer.concat(chunks);
            callback(null, body);
        });
        decompressor.on("error", (err) => {
            callback(err, null);
        });
    });
    request.end();
}

function fetchPlayerNames(playerNames, tweetIndex, index, playerIds, callback) {
    if (index >= playerIds.length) {
        callback(null);
        return;
    }

    if (index == tweetIndex) {
        setTimeout(fetchPlayerNames, 200, playerNames, tweetIndex, index + 1, playerIds, callback);
    } else {
        let id = playerIds[index];
        twitter.fetchUser(id, undefined, (err, user) => {
            if (err) {
                callback(err);
                return;
            }
            playerNames[index] = user.screen_name;
            setTimeout(fetchPlayerNames, 200, playerNames, tweetIndex, index + 1, playerIds, callback);
        });
    }
}
