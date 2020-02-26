require('dotenv').config();

const express = require('express');
const app = express();
const http = require('http').Server(app);
const cookieParser =  require('cookie-parser');
const bodyParser = require('body-parser');
const mysql = require('mysql');

const Twitter = require('twitter');
const apiKeys = {
    consumer_key: process.env.CONSUMER_KEY,
    consumer_secret: process.env.CONSUMER_SECRET,
    access_token_key: process.env.ACCESS_TOKEN_KEY,
    access_token_secret: process.env.ACCESS_TOKEN_SECRET
}
const T = new Twitter(apiKeys);

var connection = mysql.createConnection({
    host: process.env.RDS_HOSTNAME,
    port: process.env.RDS_PORT,
    database: process.env.RDS_DB_NAME,
    user: process.env.RDS_USERNAME,
    password: process.env.RDS_PASSWORD
});

app.use(bodyParser.json());
app.use(cookieParser());
app.use(express.static(__dirname + '/resources'));

app.get('/favicon.ico', (req, res) => res.sendStatus(204)); // No content

app.get('/:parameters?', function(req, res) {  // '?' indicates parameters are optional

    const searchParams = {
        q: '#Cerner',
        count: 10,
        lang: 'en',
        result_type: 'recent'
    };  // defaults

    var railsTheme = req.cookies['rails-theme'];
    if(railsTheme == undefined) {   // no cookie
        railsTheme = 'light';    // default theme
    }

    var userParams = req.params.parameters;
    if(userParams != undefined) {
        var splitUserParams = userParams.split("-");

        searchParams.q = `#${splitUserParams[0]}`;  // first parameter - hashtag - passed; default value to be overridden

        if(splitUserParams.length > 1) {   // second parameter - result type - passed; default value to be overridden
            searchParams.result_type = splitUserParams[1];
        }

        if(splitUserParams.length > 2) {    // third parameter - theme - passed; default value / previous cookie value to be overridden
            railsTheme = splitUserParams[2];
        }

        // TODO: Validate user params
    }

    var createTable = `create table if not exists SearchedTerms (
                          Id int primary key auto_increment,
                          Hashtag varchar(255) not null,
                          ResultType varchar(255) not null,
                          SearchedAt timestamp not null
                       )`;
    connection.query(createTable, function (err, result, fields) {
      if (err) throw err;
    });

    var recordSearchedTerms = `insert into SearchedTerms (Hashtag, ResultType, SearchedAt) values ('${searchParams.q}', '${searchParams.result_type}', CURRENT_TIMESTAMP)`;
    connection.query(recordSearchedTerms, function (err, result, fields) {
      if (err) throw err;
      console.log("Search parameters recorded in the database.");
    });

    T.get('search/tweets', searchParams, (err, data, response) => {
		// In case of an error, return
        if(err) {
            return console.log(err);
        }

        // Loop through the returned tweets and extract relevant information
        const tweets = data.statuses.map(tweet => ({
            id: tweet.id_str,
            username: tweet.user.screen_name
        }));

        var oembedParams = {
            theme: railsTheme
        };
        var embeddedTweets = [];
        var count = 0;

        for(var i = 0; i < tweets.length; ++i) {
            var id = tweets[i].id;
            var username = tweets[i].username;

            oembedParams.url = `https://twitter.com/${username}/status/${id}`;

            T.get('statuses/oembed', oembedParams , (err, oembedData, response) => {
                count = count + 1;

                if(err) {
                    return console.log(err);
                }

                embeddedTweets.push(oembedData.html);

                if(count == tweets.length) {  // render index.ejs only when all callbacks but the current one have finished executing
                    const uniqueEmbeddedTweets = new Set(embeddedTweets);

                    res.cookie('rails-theme', railsTheme, { maxAge: 2592000000 }).render('index.ejs', {
                        embeddedTweets: uniqueEmbeddedTweets,
                        searchParams: searchParams,
                        theme: railsTheme
                    }); // maxAge = 30 days
                }
            });
        }
    });
});

app.post('/rating', function(req, res) {
    var rating = JSON.parse(JSON.stringify(req.body)).rating;

    var createTable = `create table if not exists UserRatings (
                          Id int primary key auto_increment,
                          Rating int not null,
                          PostedAt timestamp not null
                       )`;
    connection.query(createTable, function (err, result, fields) {
      if (err) throw err;
    });

    var postRating = `insert into UserRatings (Rating, PostedAt) values (${rating}, CURRENT_TIMESTAMP)`;
    connection.query(postRating, function (err, result, fields) {
      if (err) throw err;
      console.log("User rating recorded in database.");
    });
});

const server = http.listen(8080, function() {
    console.log('listening on *:8080');
});
