const SUPABASE_URL =
  "https://hyyevttvizxlsyuylbgm.supabase.co";

const SUPABASE_KEY =
  "sb_publishable_ks2EQ7mWi7jTQvrdO-ftUA_1_IRys4S";

let supabaseClient = null;
let currentPlayer = null;
let currentRoom = null;
let roomChannel = null;


// LOAD SUPABASE

const script = document.createElement("script");

script.src =
  "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2";

script.onload = startApp;

script.onerror = () => {
  setStatus("SUPABASE FAILED TO LOAD", true);
};

document.head.appendChild(script);


// START APP

function startApp() {

  supabaseClient =
    window.supabase.createClient(
      SUPABASE_URL,
      SUPABASE_KEY
    );

  setStatus("REAPER CONNECTION ONLINE");

  document
    .getElementById("createRoom")
    .addEventListener(
      "click",
      createRoom
    );

  document
    .getElementById("joinRoom")
    .addEventListener(
      "click",
      joinRoom
    );

  document
    .getElementById("roomCode")
    .addEventListener(
      "input",
      event => {

        event.target.value =
          event.target.value
            .toUpperCase()
            .replace(/[^A-Z0-9]/g, "")
            .slice(0, 5);

      }
    );
}


// STATUS

function setStatus(message, error = false) {

  const element =
    document.getElementById(
      "connectionStatus"
    );

  if (!element) return;

  element.textContent = message;

  element.style.color =
    error ? "#a00000" : "#666666";
}


// PLAYER ID

function getPlayerId() {

  let id =
    sessionStorage.getItem(
      "mr_reaper_player_id"
    );

  if (!id) {

    id = crypto.randomUUID();

    sessionStorage.setItem(
      "mr_reaper_player_id",
      id
    );
  }

  return id;
}



// ROOM CODE

function generateRoomCode() {

  const characters =
    "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

  let code = "";

  for (let i = 0; i < 5; i++) {

    code +=
      characters[
        Math.floor(
          Math.random() *
          characters.length
        )
      ];

  }

  return code;
}
// ==========================================
// CREATE ROOM
// ==========================================

async function createRoom() {

  const name =
    document
      .getElementById("playerName")
      .value
      .trim();

  if (!name) {

    setStatus(
      "ENTER YOUR NAME FIRST",
      true
    );

    return;
  }

  const button =
    document.getElementById(
      "createRoom"
    );

  button.disabled = true;

  setStatus(
    "CREATING REAPER ROOM..."
  );

  try {

    const playerId =
      getPlayerId();

    let roomCode = null;


    // Find an unused room code

    for (
      let attempt = 0;
      attempt < 10;
      attempt++
    ) {

      const code =
        generateRoomCode();

      const {
        data,
        error
      } =
        await supabaseClient
          .from("rooms")
          .select("code")
          .eq("code", code)
          .maybeSingle();

      if (error) {
        throw error;
      }

      if (!data) {

        roomCode = code;

        break;
      }
    }


    if (!roomCode) {

      throw new Error(
        "COULD NOT GENERATE ROOM CODE"
      );
    }


    // Create room

    const {
      data: room,
      error: roomError
    } =
      await supabaseClient
        .from("rooms")
        .insert({
          code: roomCode,
          host_id: playerId,
          state: "lobby",
          round: 0
        })
        .select()
        .single();


    if (roomError) {
      throw roomError;
    }


    // Add host as player

    const {
      error: playerError
    } =
      await supabaseClient
        .from("players")
        .insert({
          id: playerId,
          room_code: roomCode,
          name: name,
          status: "alive"
        });


    if (playerError) {
      throw playerError;
    }


    currentPlayer = {
      id: playerId,
      name: name,
      roomCode: roomCode
    };

    currentRoom = room;


    await connectToRoom(
      roomCode
    );


    showLobby();


    setStatus(
      "ROOM CREATED • " +
      roomCode
    );

  } catch (error) {

    console.error(
      "CREATE ROOM ERROR:",
      error
    );

    setStatus(
      error.message ||
      "FAILED TO CREATE ROOM",
      true
    );

  } finally {

    button.disabled = false;
  }
}


// ==========================================
// JOIN ROOM
// ==========================================

async function joinRoom() {

  const name =
    document
      .getElementById("playerName")
      .value
      .trim();

  const code =
    document
      .getElementById("roomCode")
      .value
      .trim()
      .toUpperCase();


  if (!name) {

    setStatus(
      "ENTER YOUR NAME FIRST",
      true
    );

    return;
  }


  if (code.length !== 5) {

    setStatus(
      "ROOM CODE MUST BE 5 CHARACTERS",
      true
    );

    return;
  }


  const button =
    document.getElementById(
      "joinRoom"
    );

  button.disabled = true;


  setStatus(
    "SEARCHING FOR ROOM..."
  );


  try {

    const {
      data: room,
      error: roomError
    } =
      await supabaseClient
        .from("rooms")
        .select("*")
        .eq("code", code)
        .maybeSingle();


    if (roomError) {
      throw roomError;
    }


    if (!room) {

      setStatus(
        "ROOM NOT FOUND",
        true
      );

      return;
    }


    if (room.state !== "lobby") {

      setStatus(
        "GAME HAS ALREADY STARTED",
        true
      );

      return;
    }


    const {
      count,
      error: countError
    } =
      await supabaseClient
        .from("players")
        .select("*", {
          count: "exact",
          head: true
        })
        .eq(
          "room_code",
          code
        );


    if (countError) {
      throw countError;
    }


    if (count >= 30) {

      setStatus(
        "ROOM IS FULL",
        true
      );

      return;
    }


    const playerId =
      getPlayerId();


    const {
      error: playerError
    } =
      await supabaseClient
        .from("players")
        .insert({
          id: playerId,
          room_code: code,
          name: name,
          status: "alive"
        });


    if (playerError) {
      throw playerError;
    }


    currentPlayer = {
      id: playerId,
      name: name,
      roomCode: code
    };

    currentRoom = room;


    await connectToRoom(
      code
    );


    showLobby();


    setStatus(
      "JOINED ROOM • " +
      code
    );

  } catch (error) {

    console.error(
      "JOIN ROOM ERROR:",
      error
    );

    setStatus(
      error.message ||
      "FAILED TO JOIN ROOM",
      true
    );

  } finally {

    button.disabled = false;
  }
}
// ==========================================
// SUPABASE REALTIME
// ==========================================

async function connectToRoom(roomCode) {

  if (roomChannel) {

    await supabaseClient
      .removeChannel(roomChannel);

  }

  roomChannel =
    supabaseClient
      .channel(
        "reaper-room-" + roomCode
      )

      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "players",
          filter:
            "room_code=eq." + roomCode
        },
        () => {

          refreshRoom();

        }
      )

      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "rooms",
          filter:
            "code=eq." + roomCode
        },
        () => {

          refreshRoom();

        }
      )

      .subscribe(status => {

        console.log(
          "REAPER REALTIME:",
          status
        );

      });

  await refreshRoom();
}


// ==========================================
// REFRESH ROOM
// ==========================================

async function refreshRoom() {

  if (
    !currentPlayer ||
    !currentRoom
  ) {
    return;
  }

  const {
    data: room,
    error: roomError
  } =
    await supabaseClient
      .from("rooms")
      .select("*")
      .eq(
        "code",
        currentPlayer.roomCode
      )
      .maybeSingle();

  if (roomError) {

    console.error(
      "ROOM REFRESH ERROR:",
      roomError
    );

    return;
  }

  if (!room) {

    setStatus(
      "ROOM NO LONGER EXISTS",
      true
    );

    return;
  }

  const {
    data: players,
    error: playersError
  } =
    await supabaseClient
      .from("players")
      .select("*")
      .eq(
        "room_code",
        currentPlayer.roomCode
      )
      .order(
        "created_at",
        {
          ascending: true
        }
      );

  if (playersError) {

    console.error(
      "PLAYER REFRESH ERROR:",
      playersError
    );

    return;
  }

  currentRoom = room;

  renderPlayers(
    players || []
  );

  if (room.state === "playing") {

    showGame(
      room,
      players || []
    );
  }
}


// ==========================================
// SHOW LOBBY
// ==========================================

function showLobby() {

  const card =
    document.querySelector(
      ".login-card"
    );

  if (!card) return;

  card.innerHTML = `

    <div>

      <div
        style="
          color:#666;
          font-size:10px;
          letter-spacing:3px;
        "
      >
        ROOM CODE
      </div>

      <div
        id="displayRoomCode"
        style="
          margin-top:8px;
          color:#fff;
          font-size:38px;
          font-weight:bold;
          letter-spacing:8px;
        "
      >
        ${escapeHtml(
          currentPlayer.roomCode
        )}
      </div>

      <div
        style="
          margin-top:25px;
          color:#666;
          font-size:10px;
          letter-spacing:3px;
        "
      >
        PLAYERS
      </div>

      <div
        id="playerList"
        style="
          margin-top:10px;
          text-align:left;
        "
      >
        LOADING...
      </div>

      <button
        id="startGame"
        style="margin-top:20px;"
      >
        START GAME
      </button>

      <button
        id="leaveRoom"
        style="
          margin-top:10px;
          background:#222;
        "
      >
        LEAVE ROOM
      </button>

    </div>

  `;

  document
    .getElementById("startGame")
    .addEventListener(
      "click",
      startGame
    );

  document
    .getElementById("leaveRoom")
    .addEventListener(
      "click",
      leaveRoom
    );

  refreshRoom();
}


// ==========================================
// PLAYER LIST
// ==========================================

function renderPlayers(players) {

  const list =
    document.getElementById(
      "playerList"
    );

  if (!list) return;

  if (players.length === 0) {

    list.innerHTML =
      "NO PLAYERS";

    return;
  }

  list.innerHTML =
    players
      .map(player => {

        const isHost =
          currentRoom &&
          player.id ===
          currentRoom.host_id;

        const isYou =
          currentPlayer &&
          player.id ===
          currentPlayer.id;

        return `

          <div
            style="
              padding:12px 5px;
              border-bottom:1px solid #222;
              color:#ddd;
            "
          >

            ${escapeHtml(
              player.name
            )}

            ${
              isYou
                ? `
                  <span
                    style="
                      color:#555;
                      font-size:9px;
                      margin-left:6px;
                    "
                  >
                    YOU
                  </span>
                `
                : ""
            }

            ${
              isHost
                ? `
                  <span
                    style="
                      float:right;
                      color:#800000;
                      font-size:9px;
                      font-weight:bold;
                    "
                  >
                    HOST
                  </span>
                `
                : ""
            }

          </div>

        `;

      })
      .join("");
}
// ==========================================
// START GAME
// ==========================================

async function startGame() {

  if (
    !currentRoom ||
    !currentPlayer
  ) {
    return;
  }

  if (
    currentRoom.host_id !==
    currentPlayer.id
  ) {

    setStatus(
      "ONLY THE HOST CAN START",
      true
    );

    return;
  }

  const {
    count,
    error
  } =
    await supabaseClient
      .from("players")
      .select("*", {
        count: "exact",
        head: true
      })
      .eq(
        "room_code",
        currentPlayer.roomCode
      );

  if (error) {

    setStatus(
      error.message,
      true
    );

    return;
  }

  if (count < 2) {

    setStatus(
      "AT LEAST 2 PLAYERS REQUIRED",
      true
    );

    return;
  }

  const {
    error: updateError
  } =
    await supabaseClient
      .from("rooms")
      .update({
        state: "playing",
        round: 1
      })
      .eq(
        "code",
        currentPlayer.roomCode
      );

  if (updateError) {

    setStatus(
      updateError.message,
      true
    );

    return;
  }

  setStatus(
    "THE REAPER HAS AWAKENED"
  );
}


// ==========================================
// GAME SCREEN
// ==========================================

function showGame(
  room,
  players
) {

  const card =
    document.querySelector(
      ".login-card"
    );

  if (!card) return;

  card.innerHTML = `

    <div>

      <div
        style="
          color:#800000;
          font-size:11px;
          font-weight:bold;
          letter-spacing:4px;
        "
      >
        MR REAPER
      </div>

      <div
        style="
          margin-top:15px;
          font-size:34px;
          font-weight:bold;
        "
      >
        ROUND ${room.round}
      </div>

      <div
        style="
          margin-top:8px;
          color:#555;
          font-size:9px;
          letter-spacing:2px;
        "
      >
        THE ELIMINATION GAME
      </div>

      <div
        style="
          margin-top:25px;
          color:#666;
          font-size:9px;
          letter-spacing:3px;
        "
      >
        PLAYERS
      </div>

      <div
        style="
          margin-top:10px;
          text-align:left;
        "
      >

        ${players
          .map(
            player => `

              <div
                style="
                  padding:12px 5px;
                  border-bottom:1px solid #222;
                "
              >
                ${escapeHtml(
                  player.name
                )}
              </div>

            `
          )
          .join("")}

      </div>

    </div>

  `;
}


// ==========================================
// LEAVE ROOM
// ==========================================

async function leaveRoom() {

  if (!currentPlayer) {
    return;
  }

  try {

    const playerId =
      currentPlayer.id;

    const roomCode =
      currentPlayer.roomCode;

    const {
      error: deleteError
    } =
      await supabaseClient
        .from("players")
        .delete()
        .eq(
          "id",
          playerId
        );

    if (deleteError) {
      throw deleteError;
    }

    if (
      currentRoom &&
      currentRoom.host_id ===
      playerId
    ) {

      const {
        data: remaining,
        error
      } =
        await supabaseClient
          .from("players")
          .select("id")
          .eq(
            "room_code",
            roomCode
          )
          .order(
            "created_at",
            {
              ascending: true
            }
          )
          .limit(1);

      if (error) {
        throw error;
      }

      if (
        remaining &&
        remaining.length > 0
      ) {

        await supabaseClient
          .from("rooms")
          .update({
            host_id:
              remaining[0].id
          })
          .eq(
            "code",
            roomCode
          );

      } else {

        await supabaseClient
          .from("rooms")
          .delete()
          .eq(
            "code",
            roomCode
          );
      }
    }

    if (roomChannel) {

      await supabaseClient
        .removeChannel(
          roomChannel
        );
    }

  } catch (error) {

    console.error(
      "LEAVE ERROR:",
      error
    );
  }

  currentPlayer = null;
  currentRoom = null;
  roomChannel = null;

  location.reload();
}


// ==========================================
// HTML SECURITY
// ==========================================

function escapeHtml(value) {

  return String(value)
    .replaceAll(
      "&",
      "&amp;"
    )
    .replaceAll(
      "<",
      "&lt;"
    )
    .replaceAll(
      ">",
      "&gt;"
    )
    .replaceAll(
      '"',
      "&quot;"
    )
    .replaceAll(
      "'",
      "&#039;"
    );
}
