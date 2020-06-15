const crypto = require("crypto");
const https = require("https");
const querystring = require("querystring");

module.exports = class {
    constructor(oauth) {
        this.oauth = oauth;
    }

    GET(url, parameters, callback) {
        let contentType = "application/x-www-form-urlencoded";
        let query = Object.entries(parameters)
            .map(pair => pair.map(value => percentEncode(value)))
            .sort((a, b) => a[0].localeCompare(b[0]))
            .map(([key, value]) => `${key}=${value}`)
            .join("&");

        let fullUrl = `${url}${query ? "?" : ""}${query}`;
        let request = createRequest(this.oauth, "GET", fullUrl, contentType, callback);
        request.end();
    }

    POST(url, hasFormData, parameters, callback) {
        if (hasFormData) {
            let formDataBoundary = "---FormBoundary7MB4YWxkTrZu0gW-----";
            let contentType = `multipart/form-data; boundary=${formDataBoundary}`;

            let request = createRequest(this.oauth, "POST", url, contentType, callback);
            for (let key in parameters) {
                let value = parameters[key];
                request.write(`--${formDataBoundary}` + "\r\n");
                request.write(`Content-Disposition: form-data; name="${key}"` + "\r\n\r\n");
                request.write(Buffer.isBuffer(value) ? value : value.toString());
                request.write("\r\n");
            }
            request.end(`--${formDataBoundary}`);
        } else {
            let contentType = "application/x-www-form-urlencoded";
            let body = Object.entries(parameters)
                .map(pair => pair.map(value => percentEncode(value)))
                .sort((a, b) => a[0].localeCompare(b[0]))
                .map(([key, value]) => `${key}=${value}`)
                .join("&");

            let request = createRequest(this.oauth, "POST", url, contentType, callback, body);
            request.end(body);
        }
    }
};

function createRequest(oauth, method, url, contentType, callback, urlEncodedBody) {
    let options = {
        method: method,
        headers: {
            "accept": "application/json",
            "accept-encoding": "identity",
            "content-type": contentType,
            "authorization": createAuthorizationHeader(oauth, method, url, urlEncodedBody),
        },
    };
    return https.request(url, options, (response) => {
        let chunks = [];
        response.on("data", (chunk) => {
            chunks.push(chunk);
        });
        response.on("end", () => {
            let body = Buffer.concat(chunks).toString();
            callback(body, response.statusCode, response.headers);
        });
    });
}

// https://developer.twitter.com/en/docs/basics/authentication/oauth-1-0a/authorizing-a-request
function createAuthorizationHeader(oauth, method, url, body) {
    let nonce = "a";
    let timestamp = Math.floor(new Date().getTime() / 1000);
    let signature = createSignature(oauth, method, url, body, nonce, timestamp);

    let parameters = {
        "oauth_consumer_key": oauth.consumer_key,
        "oauth_nonce": nonce,
        "oauth_signature": signature,
        "oauth_signature_method": "HMAC-SHA1",
        "oauth_timestamp": timestamp,
        "oauth_token": oauth.access_token,
        "oauth_version": "1.0",
    };

    let pairs = Object.entries(parameters)
        .map(pair => pair.map(value => percentEncode(value)))
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([key, value]) => `${key}="${value}"`)
        .join(", ");

    return `OAuth ${pairs}`;
}

// https://developer.twitter.com/en/docs/basics/authentication/oauth-1-0a/creating-a-signature
function createSignature(oauth, method, url, body, nonce, timestamp) {
    let search = new URL(url).search;

    let urlParameters = search ? querystring.parse(search.slice(1)) : {};
    let bodyParameters = body ? querystring.parse(body) : {};
    let oauthParameters = {
        "oauth_consumer_key": oauth.consumer_key,
        "oauth_nonce": nonce,
        "oauth_signature_method": "HMAC-SHA1",
        "oauth_timestamp": timestamp,
        "oauth_token": oauth.access_token,
        "oauth_version": "1.0",
    };

    let query = [urlParameters, bodyParameters, oauthParameters]
        .map(parameters => Object.entries(parameters))
        .reduce((list, entries) => list.concat(entries), [])
        .map(pair => pair.map(value => percentEncode(value)))
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([key, value]) => `${key}=${value}`)
        .join("&");

    let baseURL = search ? url.slice(0, url.indexOf("?")) : url;
    let signatureBase = `${method.toUpperCase()}&${percentEncode(baseURL)}&${percentEncode(query)}`;
    let signingKey = `${percentEncode(oauth.consumer_secret)}&${percentEncode(oauth.access_token_secret)}`;

    let hmac = crypto.createHmac("sha1", signingKey);
    hmac.update(signatureBase);

    return hmac.digest("base64");
}

// https://developer.twitter.com/en/docs/basics/authentication/oauth-1-0a/percent-encoding-parameters
function percentEncode(input) {
    let bytes = Buffer.from(input.toString());
    let encoded = "";
    for (let value of bytes) {
        if (
            48 <= value && value <= 57 ||  // [0-9]
            65 <= value && value <= 90 ||  // [A-Z]
            97 <= value && value <= 122 ||  // [a-z]
            value === 45 ||                 // '-'
            value === 46 ||                 // '.'
            value === 95 ||                 // '_'
            value === 126                   // '~'
        ) {
            encoded += String.fromCharCode(value);
        } else {
            let hex = value.toString(16).toUpperCase();
            encoded += `%${hex.length < 2 ? "0" : ""}${hex}`;
        }
    }
    return encoded;
}
