import express from "express";
import { createServer } from "http";
import { WebSocketServer } from "ws";
import { randomUUID } from "crypto";

const app = express();

const server = createServer(app);

const wss = new WebSocketServer({
  server
});

const rooms = new Map();

function send(socket, data) {
  if (socket.readyState === 1) {
    socket.send(JSON.stringify(data));
  }
}

function broadcast(room, data) {
  for (const player of room.players) {
    send(player.socket, data);
  }
}

function createRoomCode() {
  const chars =
    "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

  let code;

  do {
    code = "";

    for (let i = 0; i < 5; i++) {
      code += chars[
        Math.floor(Math.random() * chars.length)
      ];
    }
  } while (rooms.has(code));

  return code;
}

function roomData(room) {
  return {
    code: room.code,
    hostId: room.hostId,
    state: room.state,
    round: room.round,

    players: room.players.map(player => ({
      id: player.id,
      name: player.name,
      status: player.status,
      isHost: player.id === room.hostId
    }))
  };
}

function updateRoom(room) {
  broadcast(room, {
    type: "ROOM_UPDATE",
    room: roomData(room)
  });
}

function removePlayer(player) {
  const code = player.roomCode;

  if (!code) return;

  const room = rooms.get(code);

  if (!room) return;

  room.players = room.players.filter(
    p => p.id !== player.id
  );

  player.roomCode = null;

  if (room.players.length === 0) {
    rooms.delete(code);
    return;
  }

  if (room.hostId === player.id) {
    room.hostId = room.players[0].id;
  }

  updateRoom(room);
}

wss.on("connection", socket => {

  const player = {
    id: randomUUID(),
    name: "",
    socket,
    roomCode: null,
    status: "alive"
  };

  send(socket, {
    type: "CONNECTED",
    playerId: player.id
  });

  socket.on("message", raw => {

    let data;

    try {
      data = JSON.parse(raw.toString());
    } catch {
      send(socket, {
        type: "ERROR",
        message: "Invalid request."
      });

      return;
    }

    if (data.type === "CREATE_ROOM") {

      const name =
        String(data.name || "").trim();

      if (!name) {
        send(socket, {
          type: "ERROR",
          message: "Enter your name first."
        });

        return;
      }

      if (player.roomCode) {
        send(socket, {
          type: "ERROR",
          message: "You are already in a room."
        });

        return;
      }

      const code = createRoomCode();

      const room = {
        code,
        hostId: player.id,
        state: "lobby",
        round: 0,
        players: []
      };

      player.name = name;
      player.roomCode = code;
      player.status = "alive";

      room.players.push(player);

      rooms.set(code, room);

      send(socket, {
        type: "ROOM_CREATED",
        room: roomData(room)
      });

      updateRoom(room);

      return;
    }

    if (data.type === "JOIN_ROOM") {

      const name =
        String(data.name || "").trim();

      const code =
        String(data.roomCode || "")
          .trim()
          .toUpperCase();

      if (!name) {
        send(socket, {
          type: "ERROR",
          message: "Enter your name first."
        });

        return;
      }

      if (code.length !== 5) {
        send(socket, {
          type: "ERROR",
          message: "Room code must be 5 characters."
        });

        return;
      }

      const room = rooms.get(code);

      if (!room) {
        send(socket, {
          type: "ERROR",
          message: "Room not found."
        });

        return;
      }

      if (room.players.length >= 30) {
        send(socket, {
          type: "ERROR",
          message: "Room is full."
        });

        return;
      }

      if (room.state !== "lobby") {
        send(socket, {
          type: "ERROR",
          message: "Game already started."
        });

        return;
      }

      player.name = name;
      player.roomCode = code;
      player.status = "alive";

      room.players.push(player);

      send(socket, {
        type: "ROOM_JOINED",
        room: roomData(room)
      });

      updateRoom(room);

      return;
    }

    if (data.type === "START_GAME") {

      const room =
        rooms.get(player.roomCode);

      if (!room) return;

      if (room.hostId !== player.id) {
        send(socket, {
          type: "ERROR",
          message: "Only the host can start."
        });

        return;
      }

      if (room.players.length < 2) {
        send(socket, {
          type: "ERROR",
          message: "At least 2 players are required."
        });

        return;
      }

      room.state = "playing";
      room.round = 1;

      broadcast(room, {
        type: "GAME_STARTED",
        room: roomData(room)
      });

      return;
    }

    if (data.type === "LEAVE_ROOM") {
      removePlayer(player);
      return;
    }
  });

  socket.on("close", () => {
    removePlayer(player);
  });
});

app.get("/health", (req, res) => {
  res.json({
    status: "MR REAPER SERVER ONLINE",
    rooms: rooms.size
  });
});

export default server;    "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

  let code;

  do {

    code = "";

    for (let i = 0; i < 5; i++) {

      code += characters[
        Math.floor(
          Math.random() * characters.length
        )
      ];

    }

  } while (rooms.has(code));

  return code;
}


function getRoomState(room) {

  return {
    code: room.code,

    hostId: room.hostId,

    state: room.state,

    round: room.round,

    players: room.players.map(player => ({

      id: player.id,

      name: player.name,

      status: player.status,

      isHost:
        player.id === room.hostId

    }))

  };

}


function updateRoom(room) {

  broadcast(room, {

    type: "ROOM_UPDATE",

    room: getRoomState(room)

  });

}


// ─────────────────────────────
// CONNECTION
// ─────────────────────────────

wss.on("connection", socket => {

  const player = {

    id: crypto.randomUUID(),

    name: "",

    socket,

    roomCode: null,

    status: "alive"

  };


  send(socket, {

    type: "CONNECTED",

    playerId: player.id

  });


  // ───────────────────────────
  // MESSAGE
  // ───────────────────────────

  socket.on("message", raw => {

    let data;

    try {

      data = JSON.parse(
        raw.toString()
      );

    } catch {

      send(socket, {

        type: "ERROR",

        message: "Invalid request."

      });

      return;

    }


    // ─────────────────────────
    // CREATE ROOM
    // ─────────────────────────

    if (data.type === "CREATE_ROOM") {

      const name =
        String(data.name || "").trim();


      if (!name) {

        send(socket, {

          type: "ERROR",

          message:
            "Enter your name first."

        });

        return;

      }


      if (player.roomCode) {

        send(socket, {

          type: "ERROR",

          message:
            "You are already in a room."

        });

        return;

      }


      const code =
        generateRoomCode();


      const room = {

        code,

        hostId: player.id,

        state: "lobby",

        round: 0,

        players: []

      };


      player.name = name;

      player.roomCode = code;

      player.status = "alive";


      room.players.push(player);

      rooms.set(code, room);


      send(socket, {

        type: "ROOM_CREATED",

        room: getRoomState(room)

      });


      updateRoom(room);

      return;

    }


    // ─────────────────────────
    // JOIN ROOM
    // ─────────────────────────

    if (data.type === "JOIN_ROOM") {

      const name =
        String(data.name || "").trim();


      const code =
        String(data.roomCode || "")
          .trim()
          .toUpperCase();


      if (!name) {

        send(socket, {

          type: "ERROR",

          message:
            "Enter your name first."

        });

        return;

      }


      if (code.length !== 5) {

        send(socket, {

          type: "ERROR",

          message:
            "Room code must be 5 characters."

        });

        return;

      }


      const room =
        rooms.get(code);


      if (!room) {

        send(socket, {

          type: "ERROR",

          message:
            "Room not found."

        });

        return;

      }


      if (room.players.length >= 30) {

        send(socket, {

          type: "ERROR",

          message:
            "This room is full."

        });

        return;

      }


      if (room.state !== "lobby") {

        send(socket, {

          type: "ERROR",

          message:
            "This game has already started."

        });

        return;

      }


      player.name = name;

      player.roomCode = code;

      player.status = "alive";


      room.players.push(player);


      send(socket, {

        type: "ROOM_JOINED",

        room: getRoomState(room)

      });


      updateRoom(room);

      return;

    }


    // ─────────────────────────
    // START GAME
    // ─────────────────────────

    if (data.type === "START_GAME") {

      const room =
        rooms.get(player.roomCode);


      if (!room) return;


      if (room.hostId !== player.id) {

        send(socket, {

          type: "ERROR",

          message:
            "Only the host can start the game."

        });

        return;

      }


      if (room.players.length < 2) {

        send(socket, {

          type: "ERROR",

          message:
            "At least 2 players are required."

        });

        return;

      }


      room.state = "playing";

      room.round = 1;


      broadcast(room, {

        type: "GAME_STARTED",

        room: getRoomState(room)

      });


      return;

    }


    // ─────────────────────────
    // LEAVE ROOM
    // ─────────────────────────

    if (data.type === "LEAVE_ROOM") {

      const room =
        rooms.get(player.roomCode);


      if (!room) return;


      removePlayer(
        room,
        player
      );

      return;

    }

  });


  // ───────────────────────────
  // DISCONNECT
  // ───────────────────────────

  socket.on("close", () => {

    const room =
      rooms.get(player.roomCode);


    if (!room) return;


    removePlayer(
      room,
      player
    );

  });


  // ───────────────────────────
  // REMOVE PLAYER
  // ───────────────────────────

  function removePlayer(
    room,
    target
  ) {

    room.players =
      room.players.filter(
        p => p.id !== target.id
      );


    if (room.players.length === 0) {

      rooms.delete(room.code);

      return;

    }


    // Give host role to
    // another player if necessary.

    if (
      room.hostId === target.id
    ) {

      room.hostId =
        room.players[0].id;

    }


    updateRoom(room);

  }

});


// ─────────────────────────────
// HEALTH CHECK
// ─────────────────────────────

app.get(
  "/health",
  (req, res) => {

    res.json({

      status:
        "MR REAPER ONLINE",

      rooms:
        rooms.size

    });

  }
);


// VERCEL EXPORT

export default server;
