// @ts-ignore
import throttle from "lodash.throttle";
import { IceServers } from "./IceServers";

type videoSettings = {
  el: HTMLVideoElement,
  audio: boolean,
  video: boolean
}

type IWebRtcClientProps = {
  signallingServer?: string;
  sessionId: string;
  getToken: Function;
  clientId: string;
  video?: videoSettings;
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

type PeerInfo = {
  name: string;
  id: string;
  hasVideo: boolean;
  hasAudio: boolean;
  socketConnectionId?: string;
}

export class WebRtcClient {
  static ICE_SERVERS = IceServers.servers;
  signallingServer: string;
  getToken: Function;
  sessionId: string;
  clientId: string;
  socket: WebSocket;
  name: string;
  id: string;
  video?: videoSettings
  videoInitialized: boolean;
  peerConnections: Record<string, RTCPeerConnection>;
  peerInfo: Record<string, PeerInfo>;
  eventListeners: Record<string, Array<Function>>;

  constructor(props: IWebRtcClientProps) {
    Object.assign(this, applyDefaultProps(props));
    this.createSocket();
  }
  // WebRTC network management
  async addPeerConnection(id: string, connectionId: string) {
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
    connection.ondatachannel = ({ channel: receiveChannel }: { channel: RTCDataChannel }) => {
      receiveChannel.onopen = () => {
        this.emit("receiveChannelOpen", { peerId: id, receiveChannel });
      };
    }
    // Add handlers for audio/video
    if (this.video?.el) {
      if (this.videoInitialized) {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true })
        this.video.el.srcObject = stream;
      }
      // @ts-ignore
      this.video.el.srcObject?.getTracks().forEach((track: any) => {
        if (this.video) {
          // @ts-ignore
          if (!this.video[track.kind]) {
            console.log(`disabled ${track.kind} track due to initial settings`)
            track.enabled = false
          } 
        }
        // @ts-ignore
        connection.addTrack(track, this.video.el.srcObject)
      })
    }

    connection.ontrack = (event: RTCTrackEvent) => {
      this.emit("trackAdded", { event, connectionId: id})
    }

    this.peerConnections[id] = connection;

    connection.onconnectionstatechange = (event: any) => {
      if (event?.target?.connectionState === "failed") {
        console.warn("A WebRTC connection entered the failed status. Removing connection.")
        delete this.peerConnections[id]
        delete this.peerInfo[id]
      }
      this.emit("peerConnectionStateChange", event)
    }
    return connection;
  }
  
  async toggleTracks(connectionId: string, settings: videoSettings) {
    // @ts-ignore
    settings.el.srcObject?.getTracks().forEach((track: any) => {
      // @ts-ignore
      track.enabled = settings[track.kind]
    })
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
    this.socket.onerror = (err: any) => this.emit("socketError", err)
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
        const offerConnection = await this.addPeerConnection(
          event.data.offererId,
          event.data.connectionId
        );
        const offer = await offerConnection.createOffer();
        await offerConnection.setLocalDescription(offer);
        this.sendSocketMessage(
          { type: "offer", offererId: event.data.ownId, offer, name: this.name },
          event.data.connectionId
        );
        break;
      case "offer":
        console.log("Got an offer")
        const answerConnection = await this.addPeerConnection(
          event.data.offererId,
          event.data.connectionId
        );
        await answerConnection.setRemoteDescription(event.data.offer);
        const answer = await answerConnection.createAnswer();
        await answerConnection.setLocalDescription(answer);
        this.peerInfo[event.data.offererId] = {
          name: event.data.name,
          hasVideo: false,
          hasAudio: false,
          id: event.data.offererId,
          socketConnectionId: event.data.connectionId
        }
        this.sendSocketMessage(
          { type: "answer", offererId: this.id, answer, name: this.name },
          event.data.connectionId
        );
        break;
      case "answer":
        await this.peerConnections[event.data.offererId].setRemoteDescription(
          event.data.answer
        );
        this.peerInfo[event.data.offererId] = {
          name: event.data.name,
          hasVideo: false,
          hasAudio: false,
          id: event.data.offererId,
          socketConnectionId: event.data.connectionId
        }
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
  videoInitialized: true,
  peerConnections: {},
  peerInfo: {},
  eventListeners: {},
  signallingServer:
    "wss://1ga4klxvh3.execute-api.eu-central-1.amazonaws.com/dev",
  name: `User #${Math.floor(Math.random() * 10000)}`, // Should be totally fine for differention between users by humans in sharded networks.
  id: crypto.randomUUID(),
};

function applyDefaultProps(props: IWebRtcClientProps): IWebRtcClientProps {
  return { ...DEFAULT_PROPS, ...props };
}

