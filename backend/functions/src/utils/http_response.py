import json

def http_response(code, body):
  try:
    body = json.dumps(body)
  except:
    pass
  return {
    "statusCode": code,
    "body": body
  }