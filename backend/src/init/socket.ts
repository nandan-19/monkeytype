import { Server as HttpServer } from "http";
import { Server as SocketIoServer } from "socket.io";
import Logger from "../utils/logger";
import { registerRaceHandlers } from "../api/socket/race-handlers";

let io: SocketIoServer | null = null;

export function initSocketIo(httpServer: HttpServer): void {
  io = new SocketIoServer(httpServer, {
    cors: {
      origin: process.env["FRONTEND_URL"] ?? "http://localhost:3000",
      methods: ["GET", "POST"],
    },
    transports: ["websocket", "polling"],
  });

  io.on("connection", (socket) => {
    Logger.info(`Socket connected: ${socket.id}`);
    registerRaceHandlers(io as SocketIoServer, socket);

    socket.on("disconnect", () => {
      Logger.info(`Socket disconnected: ${socket.id}`);
    });
  });

  Logger.success("Socket.io initialized");
}

export function getIo(): SocketIoServer | null {
  return io;
}
