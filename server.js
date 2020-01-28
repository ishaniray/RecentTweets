require('dotenv').config();

const express = require('express');
const app = express();
const http = require('http').Server(app);
const cookieParser =  require('cookie-parser');
const fs = require('fs');

const Twitter = require('twitter');
const apiKeys = {
    consumer_key: process.env.CONSUMER_KEY,
    consumer_secret: process.env.CONSUMER_SECRET,
    access_token_key: process.env.ACCESS_TOKEN_KEY,
    access_token_secret: process.env.ACCESS_TOKEN_SECRET
}
const T = new Twitter(apiKeys);

app.use(cookieParser());
app.use(express.static(__dirname + '/css'));

app.get('/favicon.ico', (req, res) => res.sendStatus(204)); // No content

app.get('/:parameters?', function(req, res) {  // '?' indicates the hashtag param is optional
    //res.cookie('rails-theme','light');
    //res.send
    const searchParams = {
        count: 10,
        lang: 'en'
    };

    var searchedParams = `${req.params.parameters}`;
    var theme;
    //{
        //style : fs.readFileSync('C:\Users\\twitter.css','utf8')
    //    style = 
    //};

    if(req.params.parameters == undefined) {
        searchParams.q = '#Cerner';
        searchParams.result_type = 'recent';
        theme = 'light';
    } else {
        var splitSearchedParams = searchedParams.split("-");
        var hashtag = splitSearchedParams[0];
        var type = splitSearchedParams[1];
        var reqTheme = splitSearchedParams[2];

        searchParams.result_type = type;
        searchParams.q = `#${hashtag}`;

        if(reqTheme.length == 0) {
            theme = 'light';
        }

        theme = reqTheme;
    }

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

        var oembedParams = {};
        var embeddedTweets = [];
        var count = 0;   
            
        for(var i = 0; i < tweets.length; ++i) {        
            var id = tweets[i].id;
            var username = tweets[i].username;
            var fullUrl = `https://twitter.com/${username}/status/${id}`;
            oembedParams.url = fullUrl;
            oembedParams.theme = theme;

            T.get('statuses/oembed', oembedParams , (err, oembedData, response) => {
                count = count + 1;

                if(err) {
                    return console.log(err);
                }

                embeddedTweets.push(oembedData.html);

                if(count == tweets.length) {  // render index.ejs only when all callbacks but the current one have finished executing 
                    const uniqueEmbeddedTweets = new Set(embeddedTweets);
                    res.cookie('rails-theme','light').render('index.ejs', {
                        embeddedTweets: uniqueEmbeddedTweets,
                        searchParams: searchParams,
                        theme: theme
                    });
                }
            });
        }
    });
});

const server = http.listen(8080, function() {
    console.log('listening on *:8080');
});
