const TwitterRequester = require("./TwitterRequester.js");

let twitter = new TwitterRequester({
    consumer_key: process.env.CONSUMER_KEY,
    consumer_secret: process.env.CONSUMER_SECRET,
    access_token: process.env.ACCESS_TOKEN,
    access_token_secret: process.env.ACCESS_TOKEN_SECRET,
});

module.exports = {
    fetchTweet,
    fetchUser,
    fetchMentions,
    postReply,
};

function fetchTweet(id, callback) {
    twitter.GET(
        "https://api.twitter.com/1.1/statuses/show.json",
        {
            id: id,
        },
        (json, status, headers) => {
            let data = JSON.parse(json);
            if (data.errors) {
                callback(data.errors, []);
                return;
            }
            callback(null, data);
        }
    );
}

function fetchUser(id, name, callback) {
    twitter.GET(
        "https://api.twitter.com/1.1/users/show.json",
        id ? {
            user_id: id
        } : {
                screen_name: name
            },
        (json, status, headers) => {
            let data = JSON.parse(json);
            if (data.errors) {
                callback(data.errors, []);
                return;
            }
            callback(null, data);
        }
    );
}

function fetchMentions(sinceId, callback) {
    twitter.GET(
        "https://api.twitter.com/1.1/statuses/mentions_timeline.json",
        {
            since_id: sinceId
        },
        (json, status, headers) => {
            let data = JSON.parse(json);
            if (data.errors) {
                callback(data.errors, []);
                return;
            }
            callback(null, data);
        }
    );
}

function postReply(id, text, imageBuffer, callback) {
    uploadFile(imageBuffer, "image/png", (mediaId) => {
        if (!mediaId) {
            callback(true);
            return;
        }

        twitter.POST(
            "https://api.twitter.com/1.1/statuses/update.json",
            false,
            {
                status: text,
                in_reply_to_status_id: id,
                media_ids: mediaId,
            },
            (json, status, headers) => {
                callback(status >= 300);
            }
        );
    });
}

function uploadFile(buffer, mediaType, callback) {
    let totalBytes = buffer.length;
    let chunkSize = 1000000;

    let uploadChunk = (mediaId, segmentIndex) => {
        let offset = segmentIndex * chunkSize;
        let length = Math.min(totalBytes - offset, chunkSize);
        console.log("uploading chunk...");

        if (length <= 0) {
            finalize(mediaId);
            return;
        }

        let media = buffer.slice(offset, offset + length);

        twitter.POST("https://upload.twitter.com/1.1/media/upload.json", true, {
            "command": "APPEND",
            "media_id": mediaId,
            "segment_index": segmentIndex,
            "media": media,//.toString("base64"),
        }, (json, status) => {
            uploadChunk(mediaId, segmentIndex + 1);
        });
    };

    let finalize = (mediaId) => {
        twitter.POST("https://upload.twitter.com/1.1/media/upload.json", true, {
            "command": "FINALIZE",
            "media_id": mediaId,
        }, (json, status) => {
            let data = JSON.parse(json);
            let info = data.processing_info;
            if (info) {
                let timeout = info.check_after_secs;
                setTimeout(checkStatus, timeout * 1000, mediaId);
            } else {
                callback(data.media_id_string);
            }
        });
    };

    let checkStatus = (mediaId) => {
        twitter.GET("https://upload.twitter.com/1.1/media/upload.json", {
            "command": "STATUS",
            "media_id": mediaId,
        }, (json, status) => {
            let data = JSON.parse(json);
            let info = data.processing_info;
            if (info.state === "in_progress") {
                let timeout = info.check_after_secs;
                setTimeout(checkStatus, timeout * 1000, mediaId);
            } else if (info.state === "failed") {
                callback("");
            } else if (info.state === "succeeded") {
                callback(data.media_id_string);
            }
        });
    };

    twitter.POST("https://upload.twitter.com/1.1/media/upload.json", true, {
        "command": "INIT",
        "total_bytes": totalBytes,
        "media_type": mediaType,
    }, (json, status) => {
        let data = JSON.parse(json);
        uploadChunk(data.media_id_string, 0);
    });
}
