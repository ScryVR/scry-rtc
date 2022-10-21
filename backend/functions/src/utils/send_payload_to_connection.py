import functools
import os
import boto3
from functions.src.utils.websocket_event import websocket_event


def send_payload_to_connection(connection_id, data, domain):
    client = _get_client(domain)
    client.post_to_connection(ConnectionId=connection_id, Data=data)


@functools.lru_cache
def _get_client(domain):
    return boto3.client(
        "apigatewaymanagementapi",
        endpoint_url=f"https://{domain}/{os.environ['STAGE']}",
    )
