# Serverless Websockets --> WebRTC connections

This project can be used to deploy an AWS Lambda which creates Serverless Websocket connections. These websocket connections are used to exchange SDP offers, answers, ICE candidates, and any other information required to initialize WebRTC connections.

This project also contains a client written in TypeScript which makes it easy to use the backend service.

**IMPORTANT**: The client references an endpoint which is not meant for public use. The signalling server requires an access token, else it will reject attempts to connect. The intent is for you to fork this repo and provide your own URL. Alternatively, reach out to me about getting a token.

**ALSO IMPORTANT**: The TURN server provided free of charge by the [Open Relay Project](https://www.metered.ca/tools/openrelay/) isn't meant for production usage, as far as I am aware. If you plan on forking this repository for use in a prod environment, please take this into consideration.

## Using the client

This snippet shows how to create a WebRTC connection and some of the events you can listen for.
It assumes that you're using my signalling server rather than forking the repo and deploying your own.

```typescript
const webRtcClient = new WebRtcClient({
    getToken: () => {
      // Some function that gets a token.
      // I am personally adding a cookie to a header via a Lambda@Edge function.
      return "some_token"
    },
    // Each user that submits the same connection ID will be added to the same p2p network
    sessionId: id,
    // Used during the auth process
    clientId: "YOUR_CLIENT_ID",
    // Required for streaming video/audio, otherwise optional
    video,
    name: "Some username"
  })
  webRtcClient.addEventListener("first_to_join", () => {
    // If you want some special behavior for the first user in a network, use this event
  })
  webRtcClient.addEventListener("socketError", () => {
    // Handle errors here
  })
  webRtcClient.addEventListener("peerConnectionStateChange", () => {
    // Triggers whenever the number of peers changes
  })
  webRtcClient.addEventListener("socketOpen", () => {
    // Triggers when the connection to the signalling server opens
  })
  webRtcClient.addEventListener("socketClosed", () => {
    // Triggers if the connection to the signalling server closes
  })
  webRtcClient.addEventListener("noMedia", () => {
    // Triggers if users try to stream audio/video but the device does not support this
  })
  webRtcClient.addEventListener("sendChannelOpen", (event: any) => {
    // Triggers every time the user connects to another peer and is able to send data
  })
  webRtcClient.addEventListener("receiveChannelOpen", (event: any) => {
    // Triggers every time the user connects to another peer and is able to receive data
  })
  webRtcClient.addEventListener("trackAdded", (props: any) => {
    // Triggers every time a peer starts sending audio/video
  })
```
