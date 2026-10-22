import { LIMITS, type Ack } from "@mun/shared";
import { verifySocketToken, type AppUser } from "./auth.js";
import type { IO, RoomManager } from "./game/RoomManager.js";

declare module "socket.io" {
  interface SocketData {
    user: AppUser;
  }
}

const safeAck = (ack: unknown): ((res: Ack<never> | Ack) => void) =>
  typeof ack === "function" ? (ack as (res: Ack) => void) : () => {};

export function registerSocketHandlers(io: IO, manager: RoomManager) {
  // Every socket must carry a valid Clerk session token.
  io.use(async (socket, next) => {
    const user = await verifySocketToken(socket.handshake.auth?.token as string | undefined);
    if (!user) return next(new Error("unauthorized"));
    socket.data.user = user;
    next();
  });

  io.on("connection", (socket) => {
    const user = socket.data.user;

    const currentRoom = () => manager.roomForSocket(socket.id);
    const guard =
      <A extends unknown[]>(handler: (...args: A) => void | Promise<void>) =>
      async (...args: A) => {
        try {
          await handler(...args);
        } catch (err) {
          console.error(`[socket] ${user.id}:`, err);
          socket.emit("toast", { kind: "error", message: "Something went wrong. Please try again." });
        }
      };

    socket.on(
      "room:join",
      guard(async (payload, ack) => {
        const reply = safeAck(ack);
        const code = String(payload?.code ?? "").trim().toUpperCase();
        const room = manager.get(code);
        if (!room) return reply({ ok: false, error: "Room not found. Check the code - rooms close when everyone leaves." });

        // One room per socket: leaving the old one first keeps seats tidy.
        const previous = manager.unbindSocket(socket.id);
        if (previous && previous !== room) previous.disconnect(socket.id);

        const result = await room.join(
          { id: user.id, displayName: user.displayName.slice(0, LIMITS.displayName), imageUrl: user.imageUrl },
          socket.id,
        );
        if (result.ok) manager.bindSocket(socket.id, room.code);
        reply(result);
      }),
    );

    socket.on("room:leave", () => {
      const room = manager.unbindSocket(socket.id);
      room?.leave(socket.id);
    });

    socket.on("room:ready", (payload) => currentRoom()?.setReady(socket.id, !!payload?.ready));

    socket.on(
      "room:start",
      guard(async (ack) => {
        const reply = safeAck(ack);
        const room = currentRoom();
        if (!room) return reply({ ok: false, error: "You are not in a room." });
        reply(await room.start(socket.id));
      }),
    );

    socket.on("room:kick", (payload) => currentRoom()?.kick(socket.id, String(payload?.playerId ?? "")));

    socket.on(
      "room:rematch",
      guard(async (ack) => {
        const reply = safeAck(ack);
        const room = currentRoom();
        if (!room || room.phase !== "finished") return reply({ ok: false, error: "The game has not finished yet." });
        if (!room.isHostSocket(socket.id)) return reply({ ok: false, error: "Only the host can call a rematch." });
        const { config } = room;
        const next = await manager.createRoom(user, {
          name: config.name,
          visibility: config.visibility,
          agendaMode: config.agendaMode,
          category: config.category,
          customAgendas: config.customAgendas,
          roundsTotal: config.roundsTotal,
          maxPlayers: config.maxPlayers,
        });
        room.broadcast("room:rematch", { code: next.code });
        reply({ ok: true, data: { code: next.code } });
      }),
    );

    socket.on("chat:send", (payload) => currentRoom()?.sendChat(socket.id, String(payload?.text ?? "")));
    socket.on("speech:update", (payload) => currentRoom()?.updateSpeech(socket.id, String(payload?.text ?? "")));
    socket.on("speech:yield", () => currentRoom()?.yieldFloor(socket.id));
    socket.on("speech:react", (payload) =>
      currentRoom()?.react(socket.id, String(payload?.playerId ?? ""), payload?.reaction),
    );
    socket.on("speech:poi", (payload) => currentRoom()?.raisePoi(socket.id, String(payload?.text ?? "")));

    socket.on("resolution:submit", (payload, ack) => {
      const room = currentRoom();
      safeAck(ack)(room ? room.submitResolution(socket.id, String(payload?.text ?? "")) : { ok: false, error: "You are not in a room." });
    });

    socket.on("vote:cast", (payload, ack) => {
      const room = currentRoom();
      safeAck(ack)(room ? room.castVote(socket.id, String(payload?.resolutionId ?? "")) : { ok: false, error: "You are not in a room." });
    });

    socket.on("lobby:subscribe", () => {
      void socket.join("lobby");
      socket.emit("lobby:rooms", manager.publicRooms());
    });
    socket.on("lobby:unsubscribe", () => void socket.leave("lobby"));

    socket.on("disconnect", () => {
      const room = manager.unbindSocket(socket.id);
      room?.disconnect(socket.id);
    });
  });
}
