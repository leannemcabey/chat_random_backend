const app = require('express')()
const http = require('http').Server(app)
const io = require('socket.io')(http)
const index = require("./routes/index");

app.use(index)

let unmatchedSocketIds = []
const matches = new Map()

function matchSocketIds(socket1Id, socket2Id) {
  matches.set(socket1Id, socket2Id)
  matches.set(socket2Id, socket1Id)

  io.to(socket1Id).emit('match')
  io.to(socket2Id).emit('match')

  console.log('matched ' + socket1Id + 'with ' + socket2Id)
}

function unmatchSocketId(socketId, isHop=false) {
  let matchedSocketId = matches.get(socketId)

  if (matchedSocketId) {
    matches.delete(socketId)
    matches.delete(matchedSocketId)

    io.to(matchedSocketId).emit('unmatch')
    findMatch(matchedSocketId, socketId)
  }

  if (isHop) {
    io.to(socketId).emit('unmatch')
    findMatch(socketId, matchedSocketId)
  }
}

function findMatch(socketId, avoidSocketId=null) {
  console.log('trying to match socket id: ' + socketId)

  if (!unmatchedSocketIds.length) {
    unmatchedSocketIds.push(socketId)
    return
  }

  let acceptableSocketIds = unmatchedSocketIds
  if (avoidSocketId) {
    acceptableSocketIds = acceptableSocketIds.filter(socketId => socketId !== avoidSocketId)
  }

  if (!acceptableSocketIds.length) {
    unmatchedSocketIds.push(socketId)
    return
  }

  let selectedSocketId = acceptableSocketIds.shift()
  unmatchedSocketIds = unmatchedSocketIds.filter(socketId => socketId !== selectedSocketId)

  matchSocketIds(socketId, selectedSocketId)
}

function sendMessage(socket, msg) {
  let match = matches.get(socket.id)

  io.to(match).emit('chat message', msg)
  socket.emit('chat message', msg)
}

io.on("connection", socket => {

  socket.on('disconnect', () => {
    unmatchSocketId(socket.id)
    console.log('umatched socket id: ' + socket.id)
  })

  socket.on('chat message', msg => {
    if (msg.slice(-17) === '/delay 1000 hello') {
      setTimeout(() => sendMessage(socket, msg.slice(0, -17) + 'hello'), 1000)
    }
    else if (msg.slice(-4) === '/hop') {
      unmatchSocketId(socket.id, true)
    }
    else {
      sendMessage(socket, msg)
    }
  })

  findMatch(socket.id)
})

http.listen(9000, () => console.log('listening on *:9000'))


// If a user types /delay 1000 hello, then the message hello should be relayed to their chat partner with a delay of 1000 ms.
// If a user types /hop then attempt to repair with another user or wait until another is available.

module.exports = app;
