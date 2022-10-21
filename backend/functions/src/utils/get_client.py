import boto3
import functools


@functools.lru_cache
def get_client():
    return boto3.client("dynamodb")