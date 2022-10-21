import json
from functions.src.utils.add_member_to_room import add_member_to_room
from functions.src.utils.get_room_members import get_room_members
from functions.src.utils.websocket_event import websocket_event
from functions.src.utils.http_response import http_response
from functions.src.utils.send_payload_to_connection import send_payload_to_connection


def handler(event, context):
    """
    This handler is triggered when a user wants to establish a WebRTC connections with a set of peers.
    """
    print("Got a request to join a room", event)

    # Load relevant info from request payload
    body = json.loads(event["body"])
    room_id = body.get("roomId")
    sdp = body.get("sdp")
    peer_id = body.get("id")
    name = body.get("name")
    connection_id = event["requestContext"]["connectionId"]

    # Add self to room. Must happen before getting room members to avoid certain race conditions
    new_participant = {
        "connectionId": connection_id,
        "sdp": sdp,
        "peerId": peer_id,
        "name": name,
    }

    # Get all room members and send them some identifying info so the WebRTC process can begin.
    add_member_to_room(room_id, new_participant)
    existing_connections = get_room_members(room_id)
    print("Here are the existing connections", existing_connections)
    if existing_connections:
        clients_notified = _notify_existing_clients(
            new_participant, existing_connections, event["requestContext"]["domainName"]
        )
    if not clients_notified:
        print("Letting client known that they were the first to join")
        # Let the caller know that they are the first one to join the room
        send_payload_to_connection(
            connection_id,
            websocket_event("first_to_join", {"roomId": room_id}),
            event["requestContext"]["domainName"],
        )
    return http_response(200, "Success")


def _notify_existing_clients(new_participant, participants, domain):
    print("Sending SDPs to participants", new_participant, participants)
    clients_notified = 0
    for participant in participants:
        if participant["connectionId"] != new_participant["connectionId"]:
            try:
                # Send new SDP to all existing members
                send_payload_to_connection(
                    participant["connectionId"],
                    websocket_event(
                        "someone_joined",
                        {
                            **new_participant,
                            "ownId": participant["peerId"],
                            "offererId": new_participant["peerId"],
                        },
                    ),
                    domain,
                )
                clients_notified += 1
            except:
                pass
    return clients_notified
