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

module.exports = app;
