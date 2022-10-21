import json
import os
import time

from functions.src.utils.get_client import get_client


def add_member_to_room(room_id: str, room_member: dict):
    room_member = json.dumps(room_member)
    client = get_client()
    client.update_item(
      TableName=os.environ["ROOM_MEMBERS_TABLE_NAME"],
      Key={ "room_id": { "S": room_id } },
      UpdateExpression="set #room_members = list_append(if_not_exists(#room_members, :empty_list), :room_member), #remove_from_room_at = :remove_timestamp",
      ExpressionAttributeNames={
        "#room_members": "room_members",
        "#remove_from_room_at": "remove_from_room_at",
      },
      ExpressionAttributeValues={
        ":room_member": {"L": [{ "S": room_member }]},
        ":empty_list": {"L": []},
        ":remove_timestamp": { "N": f"{int(time.time()) + (12 * 3600)}" }
      }
    )
