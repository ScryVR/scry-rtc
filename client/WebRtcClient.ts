// @ts-ignore
import throttle from "lodash.throttle";
import { IceServers } from "./IceServers";

type IWebRtcClientProps = {
  signallingServer?: string;
  sessionId: string;
  getToken: Function;
  clientId: string;
};

type socketEventType =
  | "first_to_join"
  | "someone_joined"
  | "offer"
  | "answer"
  | "ice_candidate";

type socketEvent = {
  type: socketEventType;
  data: Record<string, any>;
};

export class WebRtcClient {
  static ICE_SERVERS = IceServers.servers;
  signallingServer: string;
  getToken: Function;
  sessionId: string;
  clientId: string;
  socket: WebSocket;
  name: string;
  id: string;

  peerConnections: Record<string, RTCPeerConnection>;
  dataChannels: Record<string, Record<string, RTCDataChannel>>;
  eventListeners: Record<string, Array<Function>>;

  constructor(props: IWebRtcClientProps) {
    Object.assign(this, applyDefaultProps(props));
    this.createSocket();
  }
  // WebRTC network management
  addPeerConnection(id: string, connectionId: string) {
    const connection = new RTCPeerConnection({
      iceServers: WebRtcClient.ICE_SERVERS,
      iceTransportPolicy: "all",
      iceCandidatePoolSize: 0,
    });
    connection.onicecandidate = (event) => {
      if (event.candidate) {
        this.sendSocketMessage(
          {
            type: "ice_candidate",
            ice: event.candidate,
            offererId: this.id,
          },
          connectionId
        );
      }
    };
    // Open data channels
    const sendChannel = connection.createDataChannel("sendChannel");
    sendChannel.onopen = () => {
      this.emit("sendChannelOpen", { peerId: id, sendChannel });
    };
    const receiveChannel = connection.createDataChannel("receiveChannel");
    receiveChannel.onopen = () => {
      this.emit("receiveChannelOpen", { peerId: id, receiveChannel });
    };
    this.dataChannels[id] = {
      sendChannel,
      receiveChannel,
    };
    // TODO: Add handlers for audio/video
    this.peerConnections[id] = connection;

    connection.onconnectionstatechange = (event: any) => {
      if (event?.target?.connectionState === "failed") {
        console.warn("A WebRTC connection entered the failed status. Removing connection.")
        delete this.peerConnections[id]
      }
      this.emit("peerConnectionStateChange", event)
    }
    return connection;
  }

  // Signalling server interactions
  createSocket() {
    this.socket = new WebSocket(
      `${this.signallingServer}?token=${this.getToken()}&client=${
        this.clientId
      }`
    );
    this.socket.onopen = () => this.onSocketOpen();
    this.socket.onmessage = (event: any) =>
      this.dispatchSocketMessageToHandlers(JSON.parse(event.data));
    this.socket.onclose = () => this.reopenSocket();
  }
  onSocketOpen() {
    this.emit("socketOpen");
    this.socket.send(
      JSON.stringify({
        action: "join-room",
        roomId: this.sessionId,
        name: this.name, // Can be used for humans to identify each other
        id: this.id, // Used to uniquely identify users. Can be a disposable session ID or some account ID.
      })
    );
  }
  async dispatchSocketMessageToHandlers(event: socketEvent) {
    switch (event.type) {
      case "first_to_join":
        break;
      case "someone_joined":
        // Received an SDP offer - create an answer
        const offerConnection = this.addPeerConnection(
          event.data.offererId,
          event.data.connectionId
        );
        const offer = await offerConnection.createOffer();
        await offerConnection.setLocalDescription(offer);
        this.sendSocketMessage(
          { type: "offer", offererId: event.data.ownId, offer },
          event.data.connectionId
        );
        break;
      case "offer":
        const answerConnection = this.addPeerConnection(
          event.data.offererId,
          event.data.connectionId
        );
        await answerConnection.setRemoteDescription(event.data.offer);
        const answer = await answerConnection.createAnswer();
        await answerConnection.setLocalDescription(answer);
        this.sendSocketMessage(
          { type: "answer", offererId: this.id, answer },
          event.data.connectionId
        );
        break;
      case "answer":
        await this.peerConnections[event.data.offererId].setRemoteDescription(
          event.data.answer
        );
        break;
      case "ice_candidate":
        try {
          await this.peerConnections[event.data.offererId].addIceCandidate(
            event.data.ice
          );
        } catch (err) {
          console.error("Error while adding ICE candidate", err);
        }
        break;
      default:
        console.warn("Received an unexpected socket event type.", event);
        break;
    }
    this.emit(event.type, event.data);
  }
  reopenSocket = throttle(() => {
    this.emit("socketClosed");
    console.warn("Websocket connection was closed - trying to reopen");
    this.createSocket();
  }, 2000);
  sendSocketMessage(payload: any, target: string) {
    this.socket.send(
      JSON.stringify({ action: "send-payload", target, payload })
    );
  }
  addEventListener(event: string, listener: Function) {
    if (!this.eventListeners[event]) {
      this.eventListeners[event] = []
    }
    this.eventListeners[event].push(listener)
  }
  emit(event: string, detail: any = {}) {
    this.eventListeners[event]?.forEach(listener => listener({ detail }))
  }
}

const DEFAULT_PROPS = {
  peerConnections: {},
  dataChannels: {},
  eventListeners: {},
  signallingServer:
    "wss://1ga4klxvh3.execute-api.eu-central-1.amazonaws.com/dev",
  name: `User #${Math.floor(Math.random() * 10000)}`, // Should be totally fine for differention between users by humans in sharded networks.
  id: crypto.randomUUID(),
};

function applyDefaultProps(props: IWebRtcClientProps): IWebRtcClientProps {
  return { ...DEFAULT_PROPS, ...props };
}

