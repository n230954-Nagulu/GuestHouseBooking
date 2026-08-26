import { Router } from "express";
import { availableRooms, listRooms } from "../controller/roomController.js";

const roomRouter = Router();

// GET /api/rooms/available?inDate=YYYY-MM-DD&outDate=YYYY-MM-DD
// Public: allows every visitor to view currently available rooms.
roomRouter.get("/available", availableRooms);

// GET /api/rooms - public list of all physical guest rooms.
roomRouter.get("/", listRooms);

export default roomRouter;
