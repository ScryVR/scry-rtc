"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.WebRtcClient = void 0;
// @ts-ignore
const lodash_throttle_1 = __importDefault(require("lodash.throttle"));
const IceServers_1 = require("./IceServers");
class WebRtcClient {
    constructor(props) {
        this.reopenSocket = (0, lodash_throttle_1.default)(() => {
            this.emit("socketClosed");
            console.warn("Websocket connection was closed - trying to reopen");
            this.createSocket();
        }, 2000);
        Object.assign(this, applyDefaultProps(props));
        this.createSocket();
    }
    // WebRTC network management
    addPeerConnection(id, connectionId) {
        var _a, _b;
        return __awaiter(this, void 0, void 0, function* () {
            const connection = new RTCPeerConnection({
                iceServers: WebRtcClient.ICE_SERVERS,
                iceTransportPolicy: "all",
                iceCandidatePoolSize: 0,
            });
            connection.onicecandidate = (event) => {
                if (event.candidate) {
                    this.sendSocketMessage({
                        type: "ice_candidate",
                        ice: event.candidate,
                        offererId: this.id,
                    }, connectionId);
                }
            };
            // Open data channels
            const sendChannel = connection.createDataChannel("sendChannel");
            sendChannel.onopen = () => {
                this.emit("sendChannelOpen", { peerId: id, sendChannel });
            };
            connection.ondatachannel = ({ channel: receiveChannel }) => {
                receiveChannel.onopen = () => {
                    this.emit("receiveChannelOpen", { peerId: id, receiveChannel });
                };
            };
            // Add handlers for audio/video
            if ((_a = this.video) === null || _a === void 0 ? void 0 : _a.el) {
                if (this.videoInitialized) {
                    try {
                        const stream = yield navigator.mediaDevices.getUserMedia({ video: true, audio: true });
                        this.video.el.srcObject = stream;
                    }
                    catch (err) {
                        try {
                            console.warn("Failed to get video/audio media device. Trying to get just audio...");
                            const stream = yield navigator.mediaDevices.getUserMedia({ video: false, audio: true });
                            this.video.el.srcObject = stream;
                        }
                        catch (err) {
                            console.warn("Unable to get audio or video media devices.");
                            this.emit("noMedia", { err });
                        }
                    }
                }
                // @ts-ignore
                (_b = this.video.el.srcObject) === null || _b === void 0 ? void 0 : _b.getTracks().forEach((track) => {
                    if (this.video) {
                        // @ts-ignore
                        if (!this.video[track.kind]) {
                            console.log(`disabled ${track.kind} track due to initial settings`);
                            track.enabled = false;
                        }
                    }
                    // @ts-ignore
                    connection.addTrack(track, this.video.el.srcObject);
                });
            }
            connection.ontrack = (event) => {
                this.emit("trackAdded", { event, connectionId: id });
            };
            this.peerConnections[id] = connection;
            connection.onconnectionstatechange = (event) => {
                var _a;
                if (((_a = event === null || event === void 0 ? void 0 : event.target) === null || _a === void 0 ? void 0 : _a.connectionState) === "failed") {
                    console.warn("A WebRTC connection entered the failed status. Removing connection.");
                    delete this.peerConnections[id];
                    delete this.peerInfo[id];
                }
                this.emit("peerConnectionStateChange", event);
            };
            return connection;
        });
    }
    toggleTracks(connectionId, settings) {
        var _a;
        return __awaiter(this, void 0, void 0, function* () {
            // @ts-ignore
            (_a = settings.el.srcObject) === null || _a === void 0 ? void 0 : _a.getTracks().forEach((track) => {
                // @ts-ignore
                track.enabled = settings[track.kind];
            });
        });
    }
    // Signalling server interactions
    createSocket() {
        this.socket = new WebSocket(`${this.signallingServer}?token=${this.getToken()}&client=${this.clientId}`);
        this.socket.onopen = () => this.onSocketOpen();
        this.socket.onmessage = (event) => this.dispatchSocketMessageToHandlers(JSON.parse(event.data));
        this.socket.onclose = () => this.reopenSocket();
        this.socket.onerror = (err) => this.emit("socketError", err);
    }
    onSocketOpen() {
        this.emit("socketOpen");
        this.socket.send(JSON.stringify({
            action: "join-room",
            roomId: this.sessionId,
            name: this.name,
            id: this.id, // Used to uniquely identify users. Can be a disposable session ID or some account ID.
        }));
    }
    dispatchSocketMessageToHandlers(event) {
        return __awaiter(this, void 0, void 0, function* () {
            switch (event.type) {
                case "first_to_join":
                    break;
                case "someone_joined":
                    // Received an SDP offer - create an answer
                    const offerConnection = yield this.addPeerConnection(event.data.offererId, event.data.connectionId);
                    const offer = yield offerConnection.createOffer();
                    yield offerConnection.setLocalDescription(offer);
                    this.sendSocketMessage({ type: "offer", offererId: event.data.ownId, offer, name: this.name }, event.data.connectionId);
                    break;
                case "offer":
                    console.log("Got an offer");
                    const answerConnection = yield this.addPeerConnection(event.data.offererId, event.data.connectionId);
                    yield answerConnection.setRemoteDescription(event.data.offer);
                    const answer = yield answerConnection.createAnswer();
                    yield answerConnection.setLocalDescription(answer);
                    this.peerInfo[event.data.offererId] = {
                        name: event.data.name,
                        hasVideo: false,
                        hasAudio: false,
                        id: event.data.offererId,
                        socketConnectionId: event.data.connectionId
                    };
                    this.sendSocketMessage({ type: "answer", offererId: this.id, answer, name: this.name }, event.data.connectionId);
                    break;
                case "answer":
                    yield this.peerConnections[event.data.offererId].setRemoteDescription(event.data.answer);
                    this.peerInfo[event.data.offererId] = {
                        name: event.data.name,
                        hasVideo: false,
                        hasAudio: false,
                        id: event.data.offererId,
                        socketConnectionId: event.data.connectionId
                    };
                    break;
                case "ice_candidate":
                    try {
                        yield this.peerConnections[event.data.offererId].addIceCandidate(event.data.ice);
                    }
                    catch (err) {
                        console.error("Error while adding ICE candidate", err);
                    }
                    break;
                default:
                    console.warn("Received an unexpected socket event type.", event);
                    break;
            }
            this.emit(event.type, event.data);
        });
    }
    sendSocketMessage(payload, target) {
        this.socket.send(JSON.stringify({ action: "send-payload", target, payload }));
    }
    addEventListener(event, listener) {
        if (!this.eventListeners[event]) {
            this.eventListeners[event] = [];
        }
        this.eventListeners[event].push(listener);
    }
    emit(event, detail = {}) {
        var _a;
        (_a = this.eventListeners[event]) === null || _a === void 0 ? void 0 : _a.forEach(listener => listener({ detail }));
    }
}
exports.WebRtcClient = WebRtcClient;
WebRtcClient.ICE_SERVERS = IceServers_1.IceServers.servers;
const DEFAULT_PROPS = {
    videoInitialized: true,
    peerConnections: {},
    peerInfo: {},
    eventListeners: {},
    signallingServer: "wss://1ga4klxvh3.execute-api.eu-central-1.amazonaws.com/dev",
    name: `User #${Math.floor(Math.random() * 10000)}`,
    // @ts-ignore
    id: crypto.randomUUID(),
};
function applyDefaultProps(props) {
    return Object.assign(Object.assign({}, DEFAULT_PROPS), props);
}
