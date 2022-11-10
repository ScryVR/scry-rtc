import os
from functions.src.utils.get_client import get_client

def bulk_remove_by_index(key: str, field: str, indices: str, version: int, should_remove: bool=False):
    client = get_client()
    table_name = os.getenv("ROOM_MEMBERS_TABLE_NAME")
    remove_query = "REMOVE " + ",".join([f"{field}[{x}]" for x in indices])
    try:
        client.update_item(
            TableName=table_name,
            Key={ "room_id": { "S": key } },
            UpdateExpression=(
                f"{remove_query} ADD version :increment"
            ),
            ConditionExpression="version = :version OR attribute_not_exists(version)",
            ExpressionAttributeValues={
                ":version": { "N": str(version) },
                ":increment": { "N": "1" }
            }
        )
        if (should_remove):
            client.delete_item(
                TableName=table_name,
                Key={ "room_id": { "S": key } },
                ConditionExpression=f"size({field}) = :zero",
                ExpressionAttributeValues={
                    ":zero": { "N": "0" }
                }
            )
    except client.exceptions.ConditionalCheckFailedException:
        pass