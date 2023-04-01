import { io } from "socket.io-client";
import CONSTANTS from "../consts/index";

const socketIO = io(CONSTANTS.serverURL);

export default socketIO;

