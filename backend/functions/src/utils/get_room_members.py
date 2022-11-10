import json
import os


from functions.src.utils.get_client import get_client


def get_room_members(room_id: str):
    client = get_client()
    print("Trying to add member to", room_id)
    response = client.get_item(
      TableName=os.environ["ROOM_MEMBERS_TABLE_NAME"],
      Key={ "room_id": { "S": room_id } },
    )
    print("Got room members", response)
    try:
        item = response["Item"]
        return ([json.loads(room_member.get("S")) for room_member in item.get("room_members").get("L")], response.get("version", {}).get("N") or 0)
    except Exception as e:
        print("Got exception while getting room members", e)
        return ([], 0)

