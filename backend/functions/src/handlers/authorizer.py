import os
import jwt
from datetime import datetime


def handler(event, context):
  allowed = "Deny"
  try:
      client_name = event["queryStringParameters"]["client"]
      allowed = validate_chat_token(client_name, event["queryStringParameters"].get("token"))
  except Exception as e:
      print(f"Exception while authorizing. Exception:{e}Original event:{event}")
  return {
    "principalId": "me",
        "policyDocument": {
            "Version": "2012-10-17",
            "Statement": [
                {
                    "Action": "execute-api:Invoke",
                    "Effect": allowed,
                    "Resource": [
                        event["methodArn"]
                    ],
                }
            ],
        }
    }


def validate_chat_token(client_name, token):
    """Checks that a token was encoded using the expected key, that it's associated with the expected bot, and that it hasn't expired.
    Arguments:
    - bot_id {str}: The e-bot7 bot the visitor is trying to access
    - jwt {str}: The token the visitor is using to authenticate themselves
    """
    print("validating token", client_name, token)
    if token:
        decryption_key = os.environ[f"{client_name}_SECRET_KEY"]
        payload = _decode_token(decryption_key, token)
        if payload["client"] == client_name:
            if float(payload["expiresAt"]) > datetime.now().timestamp():
                is_allowed = "Allow"
            else:
                raise ExpiredToken(f"The token is expired as of {payload['expiresAt']}")
        else:
            raise MismatchingToken("This token does not belong to the given client")
    return "Allow"


def _decode_token(decryption_key, token):
    """Returns the decoded payload of a JWT

    Arguments:
    - decryption_key {str}: Used to decode the jwt
    - token {str}: The JWT being decoded. This is such a useful docstring, wow.
    """
    return jwt.decode(token, decryption_key, algorithms=["HS256"])


class ExpiredToken(Exception):
    pass

class MismatchingToken(Exception):
    pass

class InvalidToken(Exception):
    pass
