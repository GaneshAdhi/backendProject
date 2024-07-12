// Sqlite Import Code:

const {open} = require('sqlite')
const sqlite3 = require('sqlite3')

// path import code:

const path = require('path')

const dbPath = path.join(__dirname, 'twitterClone.db')

// express import code:

const express = require('express')

const app = express()

app.use(express.json())

// bcrypt import code:

const bcrypt = require('bcrypt')

// jsonwebtoken import code:

const jwt = require('jsonwebtoken')

// Database And Server Connecting Function code:
let db = null

const initilazieDbAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    })
    app.listen(3000, () => {
      console.log('Server Running at http://localhost:3000/')
    })
  } catch (e) {
    console.log(`DB Error ${e.message}`)
    process.exit(1)
  }
}

initilazieDbAndServer()

// Authentication with JWT Token

const authunticationToken = (request, response, next) => {
  let jwtToken
  const authHeader = request.headers['authorization']

  if (authHeader) {
    jwtToken = authHeader.split(' ')[1]
  }
  if (jwtToken) {
    jwt.verify(jwtToken, 'MY SECRET KEY', (error, payLoad) => {
      if (error) {
        response.status(401)
        response.send('Invalid JWT Token')
      } else {
        request.username = payLoad.username
        request.userId = payLoad.userId
        next()
      }
    })
  } else {
    response.status(401)
    response.send('Invalid JWT Token')
  }
}

// getFoolowingPeoplesIdOfUser

const getPeopleIdOfUser = async username => {
  const followingUserDetail = `
     SELECT
      follower.following_user_id
     FROM
      user INNER JOIN follower ON user.user_id=follower.follower_user_id
     WHERE
      user.username="${username}";
    `
  const followingDetailsListResponse = await db.all(followingUserDetail)
  const arrOfId = followingDetailsListResponse.map(
    each => each.following_user_id,
  )
  return arrOfId
}

// TweetVerification Function;
const tweetAccessVerfication = async (request, response, next) => {
  const {userId} = request
  const {tweetId} = request.params
  const getTweetQuery = `
   SELECT *
   FROM tweet INNER JOIN follower ON tweet.user_id=follower.following_user_id
   WHERE
    tweet.tweet_id=${tweetId} AND follower.follower_user_id
  `
  const tweet = await db.get(getTweetQuery)
  if (tweet === undefined) {
    response.status(401)
    response.send('Invalid Request')
  } else {
    next()
  }
}

//API 1 register;

app.post('/register/', async (request, response) => {
  const {username, password, name, gender} = request.body
  const getUserDetailQuery = `
   SELECT *
   FROM user
   WHERE username="${username}";
  `
  const getUserDetailResponse = await db.get(getUserDetailQuery)
  if (getUserDetailResponse === undefined) {
    if (password.length < 6) {
      response.status(400)
      response.send('Password is too short')
    } else {
      const hasedPassword = await bcrypt.hash(password, 10)
      const createNewUserDetailQuery = `
       INSERT INTO user(username,password,name,gender)
       VALUES(
        "${username}",
        "${hasedPassword}",
        "${name}",
        "${gender}"
       );
      `
      const createNewUserDetailResponse = await db.run(createNewUserDetailQuery)
      response.status(200)
      response.send('User created successfully')
    }
  } else {
    response.status(400)
    response.send('User already exists')
  }
})

//  API 2 login

app.post('/login/', async (request, response) => {
  const {username, password} = request.body
  const userDetailCheckQuery = `
    SELECT *
    FROM user
    WHERE username="${username}"
  `

  const userDetailCheckResponse = await db.get(userDetailCheckQuery)
  if (userDetailCheckResponse !== undefined) {
    const isPasswordCheck = await bcrypt.compare(
      password,
      userDetailCheckResponse.password,
    )
    if (isPasswordCheck) {
      const payLoad = {
        username: username,
        userId: userDetailCheckResponse.user_id,
      }
      const jwtToken = jwt.sign(payLoad, 'MY SECRET KEY')
      response.send({jwtToken})
    } else {
      response.status(400)
      response.send('Invalid password')
    }
  } else {
    response.status(400)
    response.send('Invalid user')
  }
})

// API 3   user tweets feed

app.get(
  '/user/tweets/feed/',
  authunticationToken,
  async (request, response) => {
    const {username} = request
    const arrOfId = await getPeopleIdOfUser(username)
    const getUserTweetQuery = `
     SELECT user.username,tweet.tweet,tweet.date_time AS dateTime
     FROM user INNER JOIN tweet ON user.user_id=tweet.user_id
     WHERE user.user_id IN (${arrOfId})
     ORDER BY tweet.date_time DESC
     LIMIT 4;
    `
    const followingTweetResponse = await db.all(getUserTweetQuery)
    response.send(followingTweetResponse)
  },
)

//API 4 user following
app.get('/user/following/', authunticationToken, async (request, response) => {
  const {userId} = request
  const getFollowingUserQuery = `
   SELECT user.name
   FROM user INNER JOIN follower ON user.user_id=follower.follower_user_id
   WHERE follower.following_user_id =${userId};
  `
  const followingResponse = await db.all(getFollowingUserQuery)
  response.send(followingResponse)
})

//API 5 user followers

app.get('/user/followers/', authunticationToken, async (request, response) => {
  const {userId} = request
  const getFollowingUserQuery = `
   SELECT user.name
   FROM user INNER JOIN follower ON user.user_id=follower.following_user_id
   WHERE follower.follower_user_id =${userId};
  `
  const followingResponse = await db.all(getFollowingUserQuery)
  response.send(followingResponse)
})

//API 6 tweets tweetId

app.get(
  '/tweets/:tweetId/',
  authunticationToken,
  tweetAccessVerfication,
  async (request, response) => {
    const {tweetId} = request.params
    const tweetQuery = `
     SELECT tweet,(SELECT COUNT() FROM like WHERE tweet_id=${tweetId}) AS likes,(SELECT COUNT() FROM reply WHERE tweet_id=${tweetId}) AS replies,tweet.date_time AS dateTime
     FROM tweet
     WHERE tweet.tweet_id=${tweetId}
    `
    const tweet = await db.get(tweetQuery)
    response.send(tweet)
  },
)

//API 7 Path: /tweets/:tweetId/likes/

app.get(
  '/tweets/:tweetId/likes/',
  authunticationToken,
  tweetAccessVerfication,
  async (request, response) => {
    const {tweetId} = request.params
    const likesQuery = `
     SELECT user.username
     FROM user INNER JOIN like ON user.user_id=like.user_id
     WHERE like.tweet_id=${tweetId}
    `
    const likeListResponse = await db.all(likesQuery)
    response.send({likes: likeListResponse})
  },
)

//API 8 /tweets/:tweetId/replies/

app.get(
  '/tweets/:tweetId/replies/',
  authunticationToken,
  tweetAccessVerfication,
  async (request, response) => {
    const {tweetId} = request.params
    const replayTweetQuery = `
     SELECT user.name,reply.reply
     FROM user INNER JOIN reply ON user.user_id=reply.user_id
     WHERE reply.tweet_id=${tweetId}
    `
    const tweetReplyResponse = await db.all(replayTweetQuery)
    response.send({replies: tweetReplyResponse})
  },
)

//API 9 /user/tweets/

app.get('/user/tweets/', authunticationToken, async (request, response) => {
  const {userId} = request
  const tweetReply = `
   SELECT tweet.tweet,(SELECT COUNT(DISTINCT like_id) FROM like WHERE like.user_id=${userId}) AS likes,(SELECT COUNT(DISTINCT reply_id) FROM reply WHERE reply.user_id=${userId}) AS replies,tweet.date_time AS dateTime
   FROM tweet LEFT JOIN reply ON tweet.tweet_id=reply.tweet_id LEFT JOIN like ON tweet.tweet_id=like.tweet_id
   WHERE tweet.user_id =${userId}
   GROUP BY tweet.tweet_id
  `
  const tweetReplyResponse = await db.all(tweetReply)
  response.send(tweetReplyResponse)
})

//API 10 /user/tweets/

app.post('/user/tweets/', authunticationToken, async (request, response) => {
  const {tweet} = request.body
  const userId = parseInt(request.userId)
  const dateTime = new Date().toJSON().substring(0, 19).replace('T', ' ')
  console.log(dateTime)
  const createNewTweetQuery = `
   INSERT INTO tweet(tweet,user_id,date_time)
   VALUES ("${tweet}",${userId},"${dateTime}");
  `
  const createNewTweetResponse = await db.run(createNewTweetQuery)
  response.send('Created a Tweet')
})

//API 11 DELETE

app.delete(
  '/tweets/:tweetId/',
  authunticationToken,
  async (request, response) => {
    const {userId} = request
    const {tweetId} = request.params
    const getTweetQuery = `
     SELECT * FROM tweet
     WHERE user_id=${userId} AND tweet_id=${tweetId};
    `
    const tweetResponse = await db.get(getTweetQuery)
    if (tweetResponse === undefined) {
      response.status(401)
      response.send('Invalid Request')
    } else {
      const deleteTweetQuery = `
       DELETE FROM tweet WHERE tweet_id=${tweetId}
      `
      const deleteResponse = await db.run(deleteTweetQuery)
      response.send('Tweet Removed')
    }
  },
)

module.exports = app
