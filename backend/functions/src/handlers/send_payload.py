import json
from functions.src.utils.send_payload_to_connection import send_payload_to_connection

from functions.src.utils.http_response import http_response
from functions.src.utils.websocket_event import websocket_event


def handler(event, context):
    print("Send_payload handler", event)

    body = json.loads(event["body"])
    target = body.get("target")
    payload = body.get("payload")

    if not target or not payload:
        return http_response(
            200, {"success": False, "message": "must include a payload and a target"}
        )
    print("Posting payload to connection")
    event_type = payload.get("type", "payload")
    send_payload_to_connection(
        target,
        websocket_event(event_type, { "connectionId": event["requestContext"]["connectionId"], **payload }),
        event["requestContext"]["domainName"],
    )

    return http_response(200, {"success": True})
